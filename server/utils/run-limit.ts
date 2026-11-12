// In-memory usage limit for /api/run. State lives in this process only, so it
// resets on restart and is not shared between instances.
export const DEFAULT_RUN_LIMIT_PER_HOUR = 10
export const RUN_WINDOW_MS = 60 * 60 * 1000
const MAX_TRACKED_CLIENTS = 10000

export type RunLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/** Reads NUXT_RUN_LIMIT_PER_HOUR; anything but a positive whole number falls back to 10. */
export function resolveRunLimit(value: unknown): number {
  const limit = typeof value === 'string' && value.trim() ? Number(value) : value
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 ? limit : DEFAULT_RUN_LIMIT_PER_HOUR
}

/** First x-forwarded-for address, else the socket address. */
export function clientAddress(forwardedFor: string | string[] | undefined, socketAddress: string | undefined): string {
  const header = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  return header?.split(',')[0]?.trim() || socketAddress || 'unknown'
}

export function createRunLimiter(windowMs = RUN_WINDOW_MS) {
  const windows = new Map<string, { count: number; resetAt: number }>()
  return {
    /** Counts one request for `key`. The window starts at a client's first request. */
    check(key: string, limit: number, now = Date.now()): RunLimitDecision {
      let entry = windows.get(key)
      if (!entry || entry.resetAt <= now) {
        if (windows.size >= MAX_TRACKED_CLIENTS) {
          for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k)
          // Still full of live windows: drop the oldest so memory stays bounded.
          if (windows.size >= MAX_TRACKED_CLIENTS) windows.delete(windows.keys().next().value!)
        }
        windows.delete(key)
        entry = { count: 0, resetAt: now + windowMs }
        windows.set(key, entry)
      }
      if (entry.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
      entry.count++
      return { allowed: true }
    }
  }
}

export const runLimiter = createRunLimiter()
