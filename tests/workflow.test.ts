import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const workflow = JSON.parse(readFileSync(new URL('../n8n/agent-team.json', import.meta.url), 'utf8'))

// Two request shapes exist. Four roles build their own body inline as an n8n expression. QA
// reviewer is a passthrough: the upstream Prepare QA code node assembles the request and hands it
// over as $json.requestBody, so its expression cannot be evaluated without that node's state.
const PASSTHROUGH_BODY = '={{ JSON.stringify($json.requestBody) }}'

const httpNodes = workflow.nodes.filter((n: { type: string }) => n.type.endsWith('httpRequest'))
const codeNodeSource = (id: string) =>
  workflow.nodes.find((n: { id: string }) => n.id === id).parameters.jsCode

test('every request node body matches its committed editor snippet', () => {
  assert.equal(httpNodes.length, 5)
  for (const node of httpNodes) {
    const snippet = readFileSync(new URL(`../n8n/${node.id}-body.txt`, import.meta.url), 'utf8').trim()
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

// The QA request is assembled in code, so assert the invariants at the source instead. This is a
// static check, weaker than the evaluation above; a fixture-driven evaluation of Prepare QA would
// be stronger if the QA schema keeps growing.
test('the code-built QA request keeps the same request invariants', () => {
  const passthrough = httpNodes.filter((n: { parameters: { body: string } }) => n.parameters.body === PASSTHROUGH_BODY)
  assert.equal(passthrough.length, 1)
  assert.equal(passthrough[0].id, 'qa-reviewer')
  const source = codeNodeSource('prepare-qa')
  assert.match(source, /store:\s*false/, 'Prepare QA must not persist requests at the provider')
  assert.match(source, /strict:\s*true/, 'Prepare QA must request strict structured output')
  assert.match(source, /requestBody:\s*makeRequest\(/, 'Prepare QA must expose the request as requestBody')
})

// Nodes reach each other by name, so a rename that misses a $('Other node') reference leaves an
// export that imports cleanly and then fails at runtime. Renaming is routine here, because n8n
// appends "1" to every name when a workflow is duplicated.
test('every cross-node reference resolves to a node in the export', () => {
  const names = new Set(workflow.nodes.map((n: { name: string }) => n.name))
  const reference = /\$\(\s*(["'])(.*?)\1\s*\)/g
  const collect = (value: unknown, found: Set<string>) => {
    if (typeof value === 'string') for (const [, , name] of value.matchAll(reference)) found.add(name)
    else if (value && typeof value === 'object') for (const child of Object.values(value)) collect(child, found)
  }
  for (const node of workflow.nodes) {
    const found = new Set<string>()
    collect(node.parameters, found)
    for (const name of found) assert.ok(names.has(name), `${node.name} references missing node ${name}`)
  }
})

test('portable workflow has no saved credentials or pinned execution data', () => {
  assert.equal(workflow.active, false)
  assert.deepEqual(workflow.pinData, {})
  for (const node of workflow.nodes) assert.equal(node.credentials, undefined)
})
