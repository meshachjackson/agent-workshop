import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const workflow = JSON.parse(readFileSync(new URL('../n8n/agent-team.json', import.meta.url), 'utf8'))
test('exported workflow request expressions evaluate and preserve structured output schema', () => {
  const nodes = workflow.nodes.filter((n: { type: string }) => n.type.endsWith('httpRequest'))
  assert.equal(nodes.length, 5)
  for (const node of nodes) {
    const body = node.parameters.body
    assert.ok(body.startsWith('={{') && body.endsWith('}}'))
    const expression = body.slice(3, -2).trim()
    assert.ok(!expression.includes('}}'), `${node.name}: premature expression delimiter`)
    const input = { model: 'gpt-4.1-mini', idea: 'A "quoted" idea\nwith a newline', agents: { architect: { summary: 'Prior work', details: [] } } }
    const result = JSON.parse(new Function('$json', `return (${expression})`)(input))
    assert.deepEqual(JSON.parse(result.input), { idea: input.idea, previousAgents: input.agents })
    assert.equal(result.model, input.model)
    assert.equal(result.store, false)
    assert.equal(result.text.format.strict, true)
    assert.deepEqual(result.text.format.schema.required, ['summary', 'details'])
    const snippet = readFileSync(new URL(`../n8n/${node.id}-body.txt`, import.meta.url), 'utf8').trim()
    assert.equal(snippet, body.slice(1))
  }
})
test('portable workflow has no saved credentials or pinned execution data', () => {
  assert.equal(workflow.active, false)
  assert.deepEqual(workflow.pinData, {})
  for (const node of workflow.nodes) assert.equal(node.credentials, undefined)
})
