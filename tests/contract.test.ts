import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIdea, parseResult, roles } from '../shared/contract.ts'
test('idea validation trims valid input and rejects malformed input', () => {
  assert.equal(parseIdea({ idea: '  Book club  ' }), 'Book club')
  for (const value of [null, {}, { idea: 2 }, { idea: '  ' }, { idea: 'x'.repeat(5001) }]) assert.throws(() => parseIdea(value))
})
test('result contract requires every role, final result, and matching run ID', () => {
  const agent = { summary: 'Plan', details: ['Next step'] }
  const good = { runId: 'test', status: 'complete', agents: Object.fromEntries(roles.map(r => [r, agent])), final: agent, secret: 'must not escape' }
  assert.equal(parseResult(good, 'test').final.summary, 'Plan')
  assert.equal('secret' in parseResult(good, 'test'), false)
  for (const bad of [null, { ...good, runId: 'other' }, { ...good, agents: {} }, { ...good, final: { summary: '', details: [] } }, { ...good, status: 'running' }]) assert.throws(() => parseResult(bad, 'test'))
})
