import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
let mode = 'success', calls = 0
const mock = createServer(async (req,res) => {
  calls++
  assert.equal(req.headers['x-agent-secret'], 'test-secret')
  let raw = ''; for await (const chunk of req) raw += chunk
  const { runId, idea } = JSON.parse(raw); assert.equal(idea, 'Book club')
  if (mode === 'timeout') { setTimeout(() => res.end('{}'), 1000); return }
  if (mode === 'failure') { res.writeHead(500); res.end('private upstream failure'); return }
  const agent = { summary: 'A small plan', details: ['One step'] }
  res.setHeader('Content-Type','application/json')
  res.end(JSON.stringify(mode === 'malformed' ? {} : { runId, status: 'complete', agents: Object.fromEntries(['architect','productManager','developer','qa'].map(r=>[r,agent])), final: agent }))
})
await new Promise(r=>mock.listen(0,'127.0.0.1',r))
const child = spawn(process.execPath, ['.output/server/index.mjs'], {env:{...process.env,HOST:'127.0.0.1',PORT:'3199',NUXT_N8N_WEBHOOK_URL:`http://127.0.0.1:${mock.address().port}`,NUXT_N8N_WEBHOOK_SECRET:'test-secret',NUXT_N8N_TIMEOUT_MS:'200'},stdio:'pipe'})
try {
  let ready = false
  for (let i=0;i<100;i++) { try { if ((await fetch('http://127.0.0.1:3199')).ok) {ready=true;break} } catch {} await new Promise(r=>setTimeout(r,100)) }
  assert.ok(ready,'production server starts')
  const post = idea => fetch('http://127.0.0.1:3199/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idea})})
  assert.equal((await post(' ')).status,400); assert.equal(calls,0)
  const success=await post(' Book club '); assert.equal(success.status,200); assert.equal((await success.json()).final.summary,'A small plan')
  mode='malformed'; assert.equal((await post('Book club')).status,502)
  mode='failure'; const failed=await post('Book club'); assert.equal(failed.status,502); assert.ok(!(await failed.text()).includes('private upstream failure'))
  mode='timeout'; assert.equal((await post('Book club')).status,504)
  assert.equal(calls,4,'no retries')
  console.log('PASS: production page, input validation, authenticated webhook, results, malformed response, sanitized failure, timeout, no retries')
} finally {child.kill(); mock.closeAllConnections(); await new Promise(r=>mock.close(r))}
