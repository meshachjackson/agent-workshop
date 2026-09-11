import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../n8n/${name}`, import.meta.url), 'utf8'))
const read = (name: string) => readFileSync(new URL(`../n8n/${name}`, import.meta.url), 'utf8')

const workflow = load('agent-team.json')
const qaReview = load('qa-review.json')
const workflows = [
  { name: 'agent-team.json', export: workflow },
  { name: 'qa-review.json', export: qaReview },
]

// Four roles build their own request body inline as an n8n expression. QA reviewer is a passthrough:
// Prepare QA assembles its request in code and hands it over as $json.requestBody, so its expression
// cannot be evaluated without that node's state. Both live in qa-review.json now.
const PASSTHROUGH_BODY = '={{ JSON.stringify($json.requestBody) }}'
const httpNodes = workflows.flatMap(w => w.export.nodes.filter((n: { type: string }) => n.type.endsWith('httpRequest')))
const nodeById = (wf: { nodes: { id: string }[] }, id: string) => wf.nodes.find(n => n.id === id)

test('the five roles are spread across the planning workflow and the QA sub-workflow', () => {
  assert.equal(httpNodes.length, 5)
  assert.equal(workflow.nodes.filter((n: { type: string }) => n.type.endsWith('httpRequest')).length, 4)
  assert.ok(nodeById(qaReview, 'qa-reviewer'), 'QA reviewer belongs to the QA sub-workflow')
})

test('every request node body matches its committed editor snippet', () => {
  for (const node of httpNodes) {
    const snippet = read(`${node.id}-body.txt`).trim()
    assert.equal(snippet, node.parameters.body.slice(1), `${node.name}: snippet drifted from export`)
  }
})

test('inline request expressions evaluate and preserve structured output schema', () => {
  const inline = httpNodes.filter((n: { parameters: { body: string } }) => n.parameters.body !== PASSTHROUGH_BODY)
  assert.equal(inline.length, 4)
  for (const node of inline) {
    const body = node.parameters.body
    assert.ok(body.startsWith('={{') && body.endsWith('}}'), `${node.name}: not a bare expression`)
    const expression = body.slice(3, -2).trim()
    assert.ok(!expression.includes('}}'), `${node.name}: premature expression delimiter`)
    const input = { model: 'gpt-4.1-mini', idea: 'A "quoted" idea\nwith a newline', agents: { architect: { summary: 'Prior work', details: [] } } }
    const result = JSON.parse(new Function('$json', `return (${expression})`)(input))
    assert.equal(result.model, input.model, `${node.name}: model is not taken from Configure model`)
    assert.equal(result.store, false)
    assert.equal(result.text.format.strict, true)
    assert.deepEqual(result.text.format.schema.required, ['summary', 'details'])
  }
})

// The QA request is assembled in code, so assert the invariants at the source instead. Its model is
// deliberately pinned to gpt-4.1 rather than the Configure model value the other five roles read.
test('the code-built QA request keeps the same request invariants', () => {
  const source = read('qa-prepare.js')
  assert.match(source, /store:\s*false/, 'Prepare QA must not persist requests at the provider')
  assert.match(source, /strict:\s*true/, 'Prepare QA must request strict structured output')
  assert.match(source, /model:\s*'gpt-4\.1'/, 'Prepare QA runs a deliberately pinned model')
  assert.equal(nodeById(qaReview, 'prepare-qa').parameters.jsCode, source, 'Prepare QA drifted from n8n/qa-prepare.js')
})

test('the QA sub-workflow matches its committed sources', () => {
  assert.equal(nodeById(qaReview, 'aggregate-qa-review').parameters.jsCode, read('qa-aggregation.js'))
})

// The QA aggregation block used to exist as three byte-identical copies: both collectors in the
// planning workflow and Collect QA reviewer in the isolated QA evaluation workflow. It now lives
// only in the sub-workflow, so no other node may carry a copy.
test('the QA aggregation block exists in exactly one node', () => {
  const carriers = workflows.flatMap(w =>
    w.export.nodes
      .filter((n: { parameters: { jsCode?: string } }) => n.parameters.jsCode?.includes('function aggregate('))
      .map((n: { name: string }) => `${w.name}:${n.name}`),
  )
  assert.deepEqual(carriers, ['qa-review.json:Aggregate QA review'])
})

// Nodes reach each other by name, so a rename that misses a $('Other node') reference leaves an
// export that imports cleanly and then fails at runtime. Renaming is routine here, because n8n
// appends "1" to every name when a workflow is duplicated.
test('every cross-node reference resolves to a node in its own export', () => {
  const reference = /\$\(\s*(["'])(.*?)\1\s*\)/g
  const collect = (value: unknown, found: Set<string>) => {
    if (typeof value === 'string') for (const [, , name] of value.matchAll(reference)) found.add(name)
    else if (value && typeof value === 'object') for (const child of Object.values(value)) collect(child, found)
  }
  for (const { name: file, export: wf } of workflows) {
    const names = new Set(wf.nodes.map((n: { name: string }) => n.name))
    for (const node of wf.nodes) {
      const found = new Set<string>()
      collect(node.parameters, found)
      for (const ref of found) assert.ok(names.has(ref), `${file}: ${node.name} references missing node ${ref}`)
    }
  }
})

// The whole point of the split: an agent has to be able to read a workflow in one call. These
// ceilings are the regression test for the bloat that made that impossible.
test('no workflow or node grows back past the size it can be read at', () => {
  for (const { name, export: wf } of workflows) {
    assert.ok(JSON.stringify(wf).length < 70_000, `${name} is too large to read in one call`)
    for (const node of wf.nodes) {
      const size = JSON.stringify(node).length
      assert.ok(size < 35_000, `${name}: node ${node.name} is ${size} characters`)
    }
  }
})

test('portable workflows have no saved credentials or pinned execution data', () => {
  for (const { name, export: wf } of workflows) {
    assert.equal(wf.active, false, name)
    assert.deepEqual(wf.pinData, {}, name)
    for (const node of wf.nodes) assert.equal(node.credentials, undefined, `${name}: ${node.name}`)
  }
})
