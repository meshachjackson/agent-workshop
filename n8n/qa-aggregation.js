const version = "structured-qa-1.8.0";
const checks = ["workflow_separation","source_identity","data_preserving_rollback","infrastructure","schema_acceptance","write_failures","evidence_integrity"];
const statuses = ["PASS","FAIL","UNKNOWN","NOT_APPLICABLE"];
const owners = ["architect","productManager","developer"];
const schema = {"type":"object","additionalProperties":false,"required":["workflowDeclaration","scope","identityColumns","riskScan","findings"],"properties":{"workflowDeclaration":{"type":"object","additionalProperties":false,"required":["placement","name","trigger","evidenceId"],"properties":{"placement":{"type":"string","enum":["SEPARATE_OPERATIONAL","PLANNING_WORKFLOW","CONTRADICTORY","UNSPECIFIED","NOT_APPLICABLE"]},"name":{"type":"string","maxLength":120},"trigger":{"type":"string","enum":["EXPLICIT","UNSPECIFIED","NOT_APPLICABLE"]},"evidenceId":{"type":"integer","minimum":0}}},"scope":{"type":"object","additionalProperties":false,"required":["kind","documentationSufficiency","changeEvidenceId","acceptanceEvidenceId"],"properties":{"kind":{"type":"string","enum":["DOCUMENTATION_ONLY","OTHER"]},"documentationSufficiency":{"type":"string","enum":["CONCRETE","INCOMPLETE","NOT_APPLICABLE"]},"changeEvidenceId":{"type":"integer","minimum":0},"acceptanceEvidenceId":{"type":"integer","minimum":0}}},"identityColumns":{"type":"object","additionalProperties":false,"required":["architect","productManager","developer"],"properties":{"architect":{"type":"object","additionalProperties":false,"required":["mailboxColumn","messageColumn"],"properties":{"mailboxColumn":{"type":"string","maxLength":64},"messageColumn":{"type":"string","maxLength":64}}},"productManager":{"type":"object","additionalProperties":false,"required":["mailboxColumn","messageColumn"],"properties":{"mailboxColumn":{"type":"string","maxLength":64},"messageColumn":{"type":"string","maxLength":64}}},"developer":{"type":"object","additionalProperties":false,"required":["mailboxColumn","messageColumn"],"properties":{"mailboxColumn":{"type":"string","maxLength":64},"messageColumn":{"type":"string","maxLength":64}}}}},"riskScan":{"type":"object","additionalProperties":false,"required":["destructiveRollback"],"properties":{"destructiveRollback":{"type":"object","additionalProperties":false,"required":["assessment","reason","evidenceIds"],"properties":{"assessment":{"type":"string","enum":["DELETE_STORED_DATA","PRESERVE_STORED_DATA","UNSPECIFIED","NOT_APPLICABLE"]},"reason":{"type":"string","maxLength":120},"evidenceIds":{"type":"array","maxItems":3,"items":{"type":"integer","minimum":1}}}}}},"findings":{"type":"array","minItems":7,"maxItems":7,"items":{"type":"object","additionalProperties":false,"required":["checkId","status","evidence","explanation","responsibleRole","requiredCorrection"],"properties":{"checkId":{"type":"string","enum":["workflow_separation","source_identity","data_preserving_rollback","infrastructure","schema_acceptance","write_failures","evidence_integrity"]},"status":{"type":"string","enum":["PASS","FAIL","UNKNOWN","NOT_APPLICABLE"]},"evidence":{"type":"string","maxLength":600},"explanation":{"type":"string","maxLength":160},"responsibleRole":{"type":"string","enum":["architect","productManager","developer"]},"requiredCorrection":{"type":"string","maxLength":120}}}}}};
function evidenceCatalogFor(state) {
  // Preserve complete source sentences so citations retain actions and qualifications.
  return owners.flatMap(role => [state.agents[role].summary, ...state.agents[role].details].flatMap(text => text.split(/(?<=[.!?])\s+/).flatMap(sentence => {
    const spans=[];
    for(let offset=0;offset<sentence.length;){
      const end=Math.min(offset+600,sentence.length);
      const boundary=end<sentence.length?sentence.lastIndexOf(' ',end):end;
      const next=boundary>offset?boundary:end;
      spans.push({role,excerpt:sentence.slice(offset,next)});
      offset=next;while(sentence[offset]===' ')offset++;
    }
    return spans;
  }))).map((item,index)=>({id:index+1,...item}));
}
function infrastructureStatementsFor(state) {
  return owners.flatMap(role => [state.agents[role].summary, ...state.agents[role].details].flatMap(text => text.split(/(?<=[.!?])\s+/)).filter(text => /postgresql/i.test(text)).map(text => ({role,text}))).map((item,index)=>({id:'s'+index,...item}));
}
function verificationStatementsFor(state) {
  return owners.flatMap(role => [state.agents[role].summary, ...state.agents[role].details].flatMap(text => text.split(/(?<=[.!?])\s+/)).filter(text => /inspect|executed|passed|implemented|review (?:of )?(?:the )?(?:repository|workflow exports?)|repository review/i.test(text)).map(text => ({role,text}))).map((item,index)=>({id:'v'+index,...item}));
}
function isPlannedVerification(text) {
  const instruction=/^(?:(?:VALIDATION|ACCEPTANCE(?: CRITERIA)?|TEST(?: PLAN|S)?|STEPS):\s*)?(?:\d+[.)]\s*)?(?:Confirm|Verify|Check|Run|Inspect|Review|Ensure|Conduct|Validate)\b/.test(text.trim());
  const plannedCheck=/^(?:VALIDATION|ACCEPTANCE(?: CRITERIA)?|TEST(?: PLAN|S)?):\s*(?:Manual|Automated|Code|Schema|Unit|Integration|Regression|Acceptance|Smoke)\b/.test(text.trim()) && /\b(?:review|tests?|checks?|verification|validation)\b/i.test(text) && !/\b(?:already|done|finished|passed|completed|executed|performed|confirmed|verified|inspected|reviewed)\b/i.test(text);
  return !/[;]/.test(text) && !/\b(?:I|we)\s+(?:have|already|ran|executed|implemented|inspected|reviewed|tested|verified)\b/i.test(text) && (instruction || plannedCheck);
}
function schemaEvidenceFor(state) {
  return evidenceCatalogFor(state).flatMap(source=>source.excerpt.split(/[;,"\\\u0000-\u001f]/).map(text=>text.trim()).filter(text=>text.length>0 && text.length<=120 && /schema|field|column|type|transaction|migration|TBD|enum|boolean|json|text|varchar|uuid|integer|timestamp|string|null/i.test(text)).map(text=>({id:source.id,role:source.role,text})));
}
function identityChoicesFor(state,role) {
    const texts=[state.agents[role].summary,...state.agents[role].details];
    const candidates=new Set(['']);
    for(const text of texts){
      for(const token of text.match(/[A-Za-z_][A-Za-z0-9_]*/g)||[]) if(token.length<=64 && /[a-z][A-Z][a-z]|_/.test(token)) candidates.add(token);
      for(const match of text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s+(?:text|varchar|uuid|bigint|integer|int|citext)\b/gi)) if(match[1].length<=64)candidates.add(match[1]);
      for(const match of text.matchAll(/(?:PRIMARY KEY|UNIQUE)\s*\(([^)]+)\)/gi))for(const name of match[1].split(',').map(name=>name.trim()))if(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name))candidates.add(name);
      for(const match of text.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)) if(match[1].length<=64)candidates.add(match[1]);
    }
    const tableNames=new Set(texts.flatMap(text=>[...text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s+(?:text|varchar|uuid|integer|bigint|jsonb|timestamp)/gi)].map(m=>m[1])));
    const columns={};
    for(const key of ['mailboxColumn','messageColumn']){
      const naming=key==='mailboxColumn'?/mailbox|account|userId|ownerId|address/i:/message.*(?:id|key)$|mailId$|sourceId$/i;
      const context=key==='mailboxColumn'?/\b(?:mailbox|account)(?: identity)? (?:column|field)(?: name)?(?: is|:)?\s+[`'"]?([A-Za-z_][A-Za-z0-9_]*)/gi:/\b(?:message|source)(?: identity)? (?:column|field)(?: name)?(?: is|:)?\s+[`'"]?([A-Za-z_][A-Za-z0-9_]*)/gi;
      const explicit=texts.flatMap(text=>[...text.matchAll(context)].map(m=>m[1]));
      const fieldChoices=[...new Set(['',...[...candidates].filter(name=>naming.test(name)&&!tableNames.has(name)),...explicit])];
      columns[key]=fieldChoices;
    }
  return {candidates:[...candidates],columns};
}
function parseResponse(response) {
  const fail = message => { throw new Error('QA reviewer: ' + message); };
  if (response?.status !== 'completed') fail('OpenAI response was not completed');
  if (!Array.isArray(response.output)) fail('missing output array');
  const content = response.output.flatMap(item => Array.isArray(item?.content) ? item.content : []);
  if (content.some(item => item?.type === 'refusal')) fail('agent declined request');
  const texts = content.filter(item => item?.type === 'output_text');
  if (!texts.length || !texts.every(item => typeof item.text === 'string')) fail('missing or invalid output text');
  try { return JSON.parse(texts.map(item => item.text).join('')); }
  catch { fail('agent returned invalid JSON'); }
}
function aggregate(result, state) {
  const fail = message => { throw new Error('QA reviewer: ' + message); };
  const exact = (value, keys, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(label + ': invalid object fields');
  };
  exact(result, ['workflowDeclaration','scope','identityColumns','verificationClaims','infrastructureClaims','riskScan', 'findings'], 'result');
  const verificationStatements=verificationStatementsFor(state);
  exact(result.verificationClaims,verificationStatements.map(s=>s.id),'verificationClaims');
  if(Object.values(result.verificationClaims).some(value=>!['PERSONAL_EXECUTION_CLAIM','NO_PERSONAL_EXECUTION_CLAIM'].includes(value))) fail('invalid verification claim classification');
  const statements = infrastructureStatementsFor(state);
  exact(result.infrastructureClaims, statements.map(s=>s.id), 'infrastructureClaims');
  if (Object.values(result.infrastructureClaims).some(value=>!['ABSENT_RESOURCE','EXISTING_RESOURCE_CLAIM','FUTURE_OR_UNVERIFIED','QUESTION','DESIGN_REQUIREMENT'].includes(value))) fail('invalid infrastructure claim classification');
  exact(result.riskScan, result.riskScan?.infrastructureAssertion ? ['destructiveRollback','schemaDecision','infrastructureAssertion'] : result.riskScan?.schemaDecision ? ['destructiveRollback','schemaDecision'] : ['destructiveRollback'], 'riskScan');
  const catalog = evidenceCatalogFor(state);
  exact(result.workflowDeclaration,Object.hasOwn(result.workflowDeclaration,'placementQuote')?['placement','name','trigger','evidenceId','triggerQuote','placementQuote']:Object.hasOwn(result.workflowDeclaration,'triggerQuote')?['placement','name','trigger','evidenceId','triggerQuote']:['placement','name','trigger','evidenceId'],'workflowDeclaration');
  const declaration=result.workflowDeclaration;
  if(!['SEPARATE_OPERATIONAL','PLANNING_WORKFLOW','CONTRADICTORY','UNSPECIFIED','NOT_APPLICABLE'].includes(declaration.placement)|| !['EXPLICIT','UNSPECIFIED','NOT_APPLICABLE'].includes(declaration.trigger)||typeof declaration.name!=='string'||declaration.name.length>120||!Number.isInteger(declaration.evidenceId)||declaration.evidenceId<0||declaration.evidenceId>catalog.length)fail('invalid workflow declaration');
  exact(result.scope,['kind','documentationSufficiency','changeEvidenceId','acceptanceEvidenceId'],'scope');
  if(!['DOCUMENTATION_ONLY','OTHER'].includes(result.scope.kind) || !['CONCRETE','INCOMPLETE','NOT_APPLICABLE'].includes(result.scope.documentationSufficiency)) fail('invalid scope');
  for(const key of ['changeEvidenceId','acceptanceEvidenceId']) if(!Number.isInteger(result.scope[key]) || result.scope[key]<0 || result.scope[key]>catalog.length) fail('invalid scope evidence');
  if(result.scope.kind==='DOCUMENTATION_ONLY' && (result.scope.documentationSufficiency==='NOT_APPLICABLE' || (result.scope.documentationSufficiency==='CONCRETE' && (!result.scope.changeEvidenceId || !result.scope.acceptanceEvidenceId)))) fail('documentation assessment requires change and acceptance evidence');
  if(result.scope.kind==='OTHER' && result.scope.documentationSufficiency!=='NOT_APPLICABLE') fail('documentation sufficiency only applies to documentation');
  exact(result.identityColumns,owners,'identityColumns');
  for(const role of owners){
    exact(result.identityColumns[role],['mailboxColumn','messageColumn'],'identity columns');
    const source=[state.agents[role].summary,...state.agents[role].details];
    for(const column of Object.values(result.identityColumns[role])) if(typeof column!=='string' || column.length>64 || (column && !source.some(text=>text.includes(column)))) fail('identity column not found in role report');
  }
  const observations = [{hazard:'destructiveRollback',observation:result.riskScan.destructiveRollback,definition:schema.properties.riskScan.properties.destructiveRollback}];
  for (const {hazard, role, observation, definition} of observations) {
    exact(observation, Object.hasOwn(observation,'actionQuote')?['assessment','reason','evidenceIds','actionQuote']:['assessment','reason','evidenceIds'], hazard);
    if (!definition.properties.assessment.enum.includes(observation.assessment) || typeof observation.reason !== 'string' || !observation.reason.trim() || observation.reason.length > 120) fail(hazard + ': invalid assessment or reason');
    const ids = observation.evidenceIds;
    if (!Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length ||
        ids.some(id => !Number.isInteger(id) || id < 1 || id > catalog.length)) fail(hazard + ': invalid evidence IDs');
    if (role && ids.some(id => catalog[id-1].role !== role)) fail(hazard + ': evidence belongs to another role');
    if (['DELETE_STORED_DATA','CLAIMS_DATABASE_EXISTS_NOW'].includes(observation.assessment) && !ids.length) fail(hazard + ': hazard requires evidence');
  }
  if(!Array.isArray(result.findings)){
    exact(result.findings,checks,'findings');
    result={...result,findings:checks.map(checkId=>{
      const f=result.findings[checkId];exact(f,['status','evidenceId','missingInformationOwner','explanation','requiredCorrection'],'finding');
      if(!Number.isInteger(f.evidenceId)||f.evidenceId<0||f.evidenceId>catalog.length||!owners.includes(f.missingInformationOwner))fail('invalid finding source reference');
      const cited=catalog[f.evidenceId-1];return {checkId,status:f.status,evidence:cited?.excerpt||'',responsibleRole:cited?.role||f.missingInformationOwner,explanation:f.explanation,requiredCorrection:f.requiredCorrection};
    })};
  }
  if (!Array.isArray(result.findings) || result.findings.length !== checks.length) fail('expected exactly ' + checks.length + ' findings');
  result={...result,findings:result.findings.map(f=>{
    if(f && typeof f==='object' && Object.prototype.hasOwnProperty.call(f,'decision')){
      exact(f,['decision','evidence','explanation','responsibleRole','requiredCorrection'],'finding');
      if(typeof f.decision!=='string'||f.decision.split('|').length!==2)fail('invalid check/status decision');
      const {decision,...rest}=f;const [checkId,status]=decision.split('|');return {...rest,checkId,status};
    }
    return f;
  })};
  const seen = new Set();
  for (const f of result.findings) {
    exact(f, schema.properties.findings.items.required, 'finding');
    if (!checks.includes(f.checkId) || seen.has(f.checkId)) fail('unknown or duplicate checkId: ' + f.checkId);
    seen.add(f.checkId);
    if (!statuses.includes(f.status)) fail(f.checkId + ': invalid status');
    if (!owners.includes(f.responsibleRole)) fail(f.checkId + ': invalid responsibleRole');
    for (const [key, max] of Object.entries({ evidence: 600, explanation: 160, requiredCorrection: 120 })) {
      if (typeof f[key] !== 'string') fail(f.checkId + '.' + key + ': must be a string');
      if (f[key].length > max) fail(f.checkId + '.' + key + ': ' + f[key].length + ' characters; maximum ' + max);
    }
    if (!f.explanation.trim()) fail(f.checkId + ': explanation/applicability reason required');
    const blocking = ['FAIL', 'UNKNOWN'].includes(f.status);
    if (blocking !== Boolean(f.requiredCorrection.trim())) fail(f.checkId + ': correction required only for FAIL/UNKNOWN');
    if (['schema_acceptance', 'evidence_integrity'].includes(f.checkId) && f.status === 'NOT_APPLICABLE') fail(f.checkId + ': always applicable');
    const report = state.agents[f.responsibleRole];
    const source = [report?.summary, ...(report?.details || [])].filter(s => typeof s === 'string');
    if (f.evidence && !source.some(s => s.includes(f.evidence))) fail(f.checkId + ': evidence not found in responsible role report');
    if (f.status === 'PASS' && !f.evidence.trim()) fail(f.checkId + ': PASS requires evidence');
  }
  // Documentation scope requires safe rollback and no source persistence or writes; artifact names alone do not establish operations.
  const documentationOnly=result.scope.kind==='DOCUMENTATION_ONLY' && (result.riskScan.destructiveRollback.assessment==='NOT_APPLICABLE' || (result.riskScan.destructiveRollback.assessment==='PRESERVE_STORED_DATA' && result.findings.find(f=>f.checkId==='source_identity')?.status==='NOT_APPLICABLE' && result.findings.find(f=>f.checkId==='write_failures')?.status==='NOT_APPLICABLE')) && owners.every(role=>Object.values(result.identityColumns[role]).every(column=>column===''));
  const declaredNameExists=Boolean(declaration.name)&&owners.some(role=>[state.agents[role].summary,...state.agents[role].details].some(text=>text.includes(declaration.name)));
  const findings = checks.map(id => ({ ...result.findings.find(f => f.checkId === id) }));
  if(documentationOnly){
    const change=catalog[result.scope.changeEvidenceId-1], acceptance=catalog[result.scope.acceptanceEvidenceId-1];
    for(const id of ['workflow_separation','source_identity','data_preserving_rollback','infrastructure','write_failures']) Object.assign(findings.find(f=>f.checkId===id),{status:'NOT_APPLICABLE',evidence:change?.excerpt||'',responsibleRole:change?.role||'architect',explanation:'Documentation-only scope changes no executable workflow, persistence or infrastructure.',requiredCorrection:''});
    Object.assign(findings.find(f=>f.checkId==='schema_acceptance'),{status:result.scope.documentationSufficiency==='CONCRETE'?'PASS':'FAIL',evidence:acceptance?.excerpt||'',responsibleRole:acceptance?.role||'developer',explanation:result.scope.documentationSufficiency==='CONCRETE'?'Specific documentation change and observable manual acceptance check are supplied.':'Documentation change or observable acceptance criterion is missing.',requiredCorrection:result.scope.documentationSufficiency==='CONCRETE'?'':'Specify the intended documentation change and an observable review check.'});
  }
  if(!documentationOnly){
    const triggerQuote=declaration.triggerQuote;
    const triggerSupported=triggerQuote===undefined || (typeof triggerQuote==='string' && triggerQuote.length<=100 && !/agent-team|\/api\/run/i.test(triggerQuote) && /manual|webhook|schedule|cron|on demand|on-demand|event|poll|POST|GET|button|form submission/i.test(triggerQuote) && catalog.some(s=>s.excerpt.includes(triggerQuote)));
    const declarationSupported=triggerQuote===undefined || catalog[declaration.evidenceId-1]?.excerpt.includes(declaration.name);
    const separate=declaration.placement==='SEPARATE_OPERATIONAL'&&declaredNameExists&&declaration.trigger==='EXPLICIT'&&triggerSupported&&declarationSupported;
    const na=declaration.placement==='NOT_APPLICABLE';
    const placementQuote=declaration.placementQuote;
    if(placementQuote!==undefined && (typeof placementQuote!=='string'||placementQuote.length>200||(placementQuote&&!catalog.some(s=>s.excerpt.includes(placementQuote)))))fail('placement quote must match source');
    const cited=placementQuote===undefined?catalog[declaration.evidenceId-1]:placementQuote?catalog.find(s=>s.excerpt.includes(placementQuote)):separate?catalog[declaration.evidenceId-1]:undefined;
    const nameOwner=owners.find(role=>declaration.name&&[state.agents[role].summary,...state.agents[role].details].some(text=>text.includes(declaration.name)));
    Object.assign(findings.find(f=>f.checkId==='workflow_separation'),{status:separate?'PASS':na?'NOT_APPLICABLE':'FAIL',evidence:cited?.excerpt||'',responsibleRole:cited?.role||'architect',explanation:separate?(triggerQuote?'Named separate workflow. Trigger evidence: '+triggerQuote:'A separately named operational workflow and explicit trigger are supplied.'):na?'No business operation requires a separate workflow.':'The operational workflow is unnamed, lacks a trigger, or conflicts with planning separation.',requiredCorrection:separate||na?'':'Specify a separate operational workflow and its trigger consistently across all reports.'});
  }
  for (const [hazard, checkId, explanation, requiredCorrection] of [
    ['destructiveRollback', 'data_preserving_rollback', 'Rollback proposes removing persisted data or integrity constraints.', 'Disable or revert execution while retaining stored records and constraints.'],
  ]) {
    const observation = observations.find(item => item.hazard === hazard && ['DELETE_STORED_DATA','CLAIMS_DATABASE_EXISTS_NOW'].includes(item.observation.assessment))?.observation;
    if (!observation) continue;
    if (!['DELETE_STORED_DATA','CLAIMS_DATABASE_EXISTS_NOW'].includes(observation.assessment)) continue;
    const ids = observation.evidenceIds;
    const quote=observation.actionQuote;
    if(quote!==undefined && (typeof quote!=='string'||quote.length>200||!quote||!catalog.some(s=>s.excerpt.includes(quote))))fail('rollback action quote must match source');
    const cited = quote===undefined?catalog[ids[0]-1]:catalog.find(s=>s.excerpt.includes(quote));
    Object.assign(findings.find(f => f.checkId === checkId), {status:'FAIL', evidence:cited.excerpt,
      responsibleRole:cited.role, explanation, requiredCorrection});
  }
  const assertion=result.riskScan.infrastructureAssertion;
  if(assertion){exact(assertion,['quote'],'infrastructureAssertion');if(typeof assertion.quote!=='string'||assertion.quote.length>200|| (assertion.quote && !statements.some(s=>s.text.includes(assertion.quote))))fail('infrastructure assertion quote must match source');}
  const existing = assertion ? statements.find(s=>assertion.quote && s.text.includes(assertion.quote) && result.infrastructureClaims[s.id]==='EXISTING_RESOURCE_CLAIM') : statements.find(s=>result.infrastructureClaims[s.id]==='EXISTING_RESOURCE_CLAIM');
  if(existing) Object.assign(findings.find(f=>f.checkId==='infrastructure'),{status:'FAIL',evidence:(catalog.find(s=>s.role===existing.role && existing.text.includes(s.excerpt) && /postgresql/i.test(s.excerpt))?.excerpt || ''),responsibleRole:existing.role,explanation:'A report asserts availability of unverified future PostgreSQL infrastructure.',requiredCorrection:'Remove unsupported existence claims; specify provisioning and private connectivity verification prerequisites.'});
  if(assertion && !existing && statements.length){
    const prerequisite=statements.find(s=>result.infrastructureClaims[s.id]==='ABSENT_RESOURCE')||statements.find(s=>['FUTURE_OR_UNVERIFIED','QUESTION'].includes(result.infrastructureClaims[s.id]))||statements[0];
    const cited=catalog.find(s=>s.role===prerequisite.role && prerequisite.text.includes(s.excerpt) && /postgresql/i.test(s.excerpt));
    Object.assign(findings.find(f=>f.checkId==='infrastructure'),{status:'UNKNOWN',evidence:cited?.excerpt||'',responsibleRole:prerequisite.role,explanation:'PostgreSQL provisioning and private connectivity are prerequisites; availability is not verified by this planning review.',requiredCorrection:'Verify provisioning, credentials and private connectivity before live execution.'});
  }
  const allegedClaims=verificationStatements.filter(s=>result.verificationClaims[s.id]==='PERSONAL_EXECUTION_CLAIM');
  const personalClaim=verificationStatements.find(s=>result.verificationClaims[s.id]==='PERSONAL_EXECUTION_CLAIM' && !isPlannedVerification(s.text));
  if(personalClaim) Object.assign(findings.find(f=>f.checkId==='evidence_integrity'),{status:'FAIL',evidence:(catalog.find(s=>s.role===personalClaim.role && personalClaim.text.includes(s.excerpt) && /inspect|executed|passed|implemented|review (?:of )?(?:the )?(?:repository|workflow exports?)|repository review/i.test(s.excerpt))?.excerpt || ''),responsibleRole:personalClaim.role,explanation:'A planning report claims inspection or execution without supporting tool evidence.',requiredCorrection:'Remove unsupported execution claims; attribute supplied evidence and describe tests as planned.'});
  for(const key of ['mailboxColumn','messageColumn']){
    const declarations=result.riskScan.schemaDecision ? owners.flatMap(role=>identityChoicesFor(state,role).columns[key].filter(Boolean).map(column=>({role,column}))) : owners.filter(role=>result.identityColumns[role][key]).map(role=>({role,column:result.identityColumns[role][key]}));
    if(new Set(declarations.map(d=>d.column)).size<=1) continue;
    const conflict=declarations.find(d=>d.column!==declarations[0].column);
    const cited=catalog.find(s=>s.role===conflict.role && s.excerpt.includes(conflict.column));
    const finding={status:'FAIL',evidence:cited?.excerpt||conflict.column,responsibleRole:conflict.role,explanation:'Identity field names conflict across role reports.',requiredCorrection:'Align mailbox/message identity fields, keys and mappings consistently across all reports.'};
    Object.assign(findings.find(f=>f.checkId==='source_identity'),finding);
    if(findings.find(f=>f.checkId==='schema_acceptance').status!=='FAIL') Object.assign(findings.find(f=>f.checkId==='schema_acceptance'),finding);
  }
  if(!documentationOnly && result.riskScan.schemaDecision && result.riskScan.schemaDecision.assessment!=='NOT_APPLICABLE' && !owners.some(role=>result.identityColumns[role].mailboxColumn)){
    const owner=owners.find(role=>result.identityColumns[role].messageColumn)||'developer';
    const column=result.identityColumns[owner].messageColumn;
    const cited=catalog.find(s=>s.role==='developer' && column && s.excerpt.includes(column) && /key|unique|schema|column/i.test(s.excerpt)) || catalog.find(s=>column && s.excerpt.includes(column));
    Object.assign(findings.find(f=>f.checkId==='source_identity'),{status:'FAIL',evidence:cited?.excerpt||'',responsibleRole:cited?.role||owner,explanation:'No mailbox/account identity column is specified for persisted source records.',requiredCorrection:'Specify mailbox/account and message columns together in the atomic uniqueness key.'});
  }
  const identityResult=findings.find(f=>f.checkId==='source_identity');
  if(result.riskScan.schemaDecision && identityResult.status==='FAIL' && !identityResult.evidence){
    const mailboxNames=[...new Set(owners.flatMap(role=>identityChoicesFor(state,role).columns.mailboxColumn.filter(Boolean)))];
    const messageNames=[...new Set(owners.flatMap(role=>identityChoicesFor(state,role).columns.messageColumn.filter(Boolean)))];
    if(mailboxNames.length===1 && messageNames.length===1){
      const keySource=catalog.find(s=>[...s.excerpt.matchAll(/(?:PRIMARY KEY|UNIQUE)\s*\(([^)]+)\)/gi)].some(m=>{const names=m[1].split(',').map(x=>x.trim());return names.includes(mailboxNames[0])&&names.includes(messageNames[0]);}));
      const text=owners.flatMap(role=>[state.agents[role].summary,...state.agents[role].details]).join(' ');
      if(keySource && /ON CONFLICT/i.test(text) && /concurren/i.test(text) && /replay/i.test(text))Object.assign(identityResult,{status:'PASS',evidence:keySource.excerpt,responsibleRole:keySource.role,explanation:'Combined handoff specifies mailbox/message composite uniqueness, atomic conflict handling and planned replay/concurrency checks.',requiredCorrection:''});
    }
  }
  const integrity=findings.find(f=>f.checkId==='evidence_integrity');
  if(integrity.status==='FAIL' && !personalClaim && (isPlannedVerification(integrity.evidence) || (allegedClaims.length && allegedClaims.every(s=>isPlannedVerification(s.text))))) {
    const planned=allegedClaims[0];
    Object.assign(integrity,{status:'PASS',requiredCorrection:'',...(planned?{evidence:catalog.find(s=>s.role===planned.role && planned.text.includes(s.excerpt))?.excerpt||'',responsibleRole:planned.role}:{})});
  }
  if(integrity.status==='PASS')integrity.explanation='Review uses supplied reports and architecture only; this workflow did not inspect a repository, implement changes or execute tests.';
  const identityFinding=findings.find(f=>f.checkId==='source_identity');
  if(identityFinding.status==='FAIL' && findings.find(f=>f.checkId==='schema_acceptance').status!=='FAIL')Object.assign(findings.find(f=>f.checkId==='schema_acceptance'),{status:'FAIL',evidence:identityFinding.evidence,responsibleRole:identityFinding.responsibleRole,explanation:'Essential source identity requirements are unresolved, so the handoff is incomplete.',requiredCorrection:identityFinding.requiredCorrection});
  const decision=result.riskScan.schemaDecision;
  if(decision){
    exact(decision,Object.hasOwn(decision,'unresolvedQuote')?['assessment','reason','evidenceIds','unresolvedQuote']:['assessment','reason','evidenceIds'],'schemaDecision');
    if(!['UNRESOLVED','RESOLVED','NOT_APPLICABLE'].includes(decision.assessment)||typeof decision.reason!=='string'||decision.reason.length>120||!Array.isArray(decision.evidenceIds)||decision.evidenceIds.length>2||decision.evidenceIds.some(id=>!Number.isInteger(id)||id<1||id>catalog.length))fail('invalid schema decision');
    if(decision.assessment==='UNRESOLVED'){
      const alternative=schemaEvidenceFor(state).find(s=>/\w+\s*\([^)]*\b(?:enum|boolean|jsonb?|text|varchar|uuid|integer|bigint|timestamp|string)\s*(?:or|\/)\s*(?:enum|boolean|jsonb?|text|varchar|uuid|integer|bigint|timestamp|string)\b/i.test(s.text));
      const typeChoice=schemaEvidenceFor(state).find(s=>/\b(?:enum|boolean|jsonb?|text|varchar|uuid|integer|bigint|timestamp|string)\s*(?:or|\/)\s*(?:enum|boolean|jsonb?|text|varchar|uuid|integer|bigint|timestamp|string)\b/i.test(s.text));
      const quote=alternative?.text||typeChoice?.text||decision.unresolvedQuote;
      if(quote!==undefined && (typeof quote!=='string'||quote.length>120||(quote&&!schemaEvidenceFor(state).some(s=>s.text===quote))))fail('invalid unresolved schema quote');
      const cited=quote===undefined?catalog[decision.evidenceIds[0]-1]:catalog.find(s=>quote && s.excerpt.includes(quote));
      Object.assign(findings.find(f=>f.checkId==='schema_acceptance'),{status:'FAIL',evidence:cited?.excerpt||'',responsibleRole:cited?.role||'developer',explanation:'Unresolved schema decision: '+(quote||decision.reason).slice(0,120),requiredCorrection:'Specify exact field types, constraints, migration and transaction behavior before implementation.'});
    }
  }
  const implementationBlockers = findings.filter(f => f.status === 'FAIL' || (f.status === 'UNKNOWN' && f.checkId !== 'infrastructure')).map(f => f.checkId);
  const executionBlockers = findings.filter(f => ['FAIL', 'UNKNOWN'].includes(f.status)).map(f => f.checkId);
  const verdict = implementationBlockers.length ? 'NEEDS REVISION' : 'READY FOR IMPLEMENTATION';
  const summary = verdict + ': ' + (implementationBlockers.length ? 'Resolve ' + implementationBlockers.join(', ') + '.' : 'Planning handoff is sufficiently specified; implementation and tests are not executed.') +
    (executionBlockers.length ? ' Live execution blocked: ' + executionBlockers.join(', ') + '.' : ' Live execution is not certified by this planning review.');
  return { version, effectiveScope:documentationOnly?'DOCUMENTATION_ONLY':'OTHER', workflowDeclaration:{...result.workflowDeclaration}, scope:{...result.scope}, identityColumns:JSON.parse(JSON.stringify(result.identityColumns)), verificationClaims:{...result.verificationClaims}, infrastructureClaims:{...result.infrastructureClaims}, riskScan: JSON.parse(JSON.stringify(result.riskScan)), findings, implementationBlockers, executionBlockers, verdict,
    report: { summary, details: findings.map(f => `${f.checkId}: ${f.status}. Evidence: ${f.evidence || '[not supplied]'}. ${f.explanation} Owner: ${f.responsibleRole}. Correction: ${f.requiredCorrection || 'None.'}`) } };
}

// Entry point. Two modes, because the parent workflow needs this logic twice:
//   review — Prepare QA and the QA reviewer ran first, so $json holds the raw OpenAI reply
//   result — no model call; the caller supplies an already-parsed QA object to re-aggregate
// Both read their arguments from the trigger, which is the only node on both paths.
const call = $('When executed by another workflow').first().json;
if (call.mode !== 'review' && call.mode !== 'result') throw new Error('QA aggregation: unknown mode ' + call.mode);
const qaReview = aggregate(call.mode === 'review' ? parseResponse($json) : call.payload, call.state);
if (call.mode === 'review') qaReview.configHash = "96a5b2167959644dbc8b8da120715af5cd488f4c3df9d50000ab9c80be891a8d";
return [{json: qaReview}];
