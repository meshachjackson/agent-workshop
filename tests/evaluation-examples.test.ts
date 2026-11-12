import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const path = new URL('../docs/evaluation-examples.json', import.meta.url)
const KINDS = ['usefulness', 'disagreement', 'scope_discipline']

test('evaluation examples file has the three required kinds with complete fields', () => {
  const examples = JSON.parse(readFileSync(path, 'utf8'))
  assert.ok(Array.isArray(examples), 'file must be a JSON array')
  assert.equal(examples.length, 3, 'exactly three examples')
  assert.deepEqual(examples.map((e: { kind: string }) => e.kind).sort(), [...KINDS].sort())
  for (const e of examples) {
    assert.equal(typeof e.input, 'string', `${e.kind}: input`)
    assert.ok(e.input.trim().length > 0, `${e.kind}: input is empty`)
    assert.ok(Array.isArray(e.expectations) && e.expectations.length >= 2, `${e.kind}: needs at least 2 expectations`)
    for (const x of e.expectations) assert.ok(typeof x === 'string' && x.trim().length > 0, `${e.kind}: blank expectation`)
    assert.equal(typeof e.why, 'string', `${e.kind}: why`)
    assert.ok(e.why.trim().length > 0, `${e.kind}: why is empty`)
  }
})
