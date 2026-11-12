import test from 'node:test'
import assert from 'node:assert/strict'
import { clientAddress, createRunLimiter, resolveRunLimit, RUN_WINDOW_MS } from '../server/utils/run-limit.ts'

test('rate limit allows 10 runs per client address per hour and rejects the 11th with a retry delay', () => {
  const limiter = createRunLimiter()
  const start = 1_000_000
  for (let i = 0; i < 10; i++) assert.deepEqual(limiter.check('203.0.113.7', 10, start + i * 1000), { allowed: true })
  // 11th request, 10 minutes into the window: 50 minutes remain.
  assert.deepEqual(limiter.check('203.0.113.7', 10, start + 600_000), { allowed: false, retryAfterSeconds: 3000 })
  // Rejected requests do not extend the window, and other clients are unaffected.
  assert.deepEqual(limiter.check('203.0.113.7', 10, start + RUN_WINDOW_MS - 1), { allowed: false, retryAfterSeconds: 1 })
  assert.deepEqual(limiter.check('203.0.113.8', 10, start + 600_000), { allowed: true })
  // A new window opens one hour after the first request.
  assert.deepEqual(limiter.check('203.0.113.7', 10, start + RUN_WINDOW_MS), { allowed: true })
})

test('rate limit reads the configured value and defaults to 10', () => {
  assert.equal(resolveRunLimit(undefined), 10)
  assert.equal(resolveRunLimit(''), 10)
  assert.equal(resolveRunLimit('abc'), 10)
  assert.equal(resolveRunLimit(0), 10)
  assert.equal(resolveRunLimit(-3), 10)
  assert.equal(resolveRunLimit(2.5), 10)
  assert.equal(resolveRunLimit(10), 10)
  assert.equal(resolveRunLimit('25'), 25)
  assert.equal(resolveRunLimit(3), 3)
})

test('rate limit keys by the first x-forwarded-for address, else the socket address', () => {
  assert.equal(clientAddress('203.0.113.7, 10.0.0.1, 10.0.0.2', '127.0.0.1'), '203.0.113.7')
  assert.equal(clientAddress(' 203.0.113.9 ', '127.0.0.1'), '203.0.113.9')
  assert.equal(clientAddress(['198.51.100.4, 10.0.0.1', '10.0.0.2'], '127.0.0.1'), '198.51.100.4')
  assert.equal(clientAddress(undefined, '127.0.0.1'), '127.0.0.1')
  assert.equal(clientAddress('', '127.0.0.1'), '127.0.0.1')
  assert.equal(clientAddress(undefined, undefined), 'unknown')
})
