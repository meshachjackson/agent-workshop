import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value).digest()

export default defineEventHandler((event) => {
  const { teamPassword } = useRuntimeConfig(event)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (!teamPassword) {
    // Local development remains convenient; deployed builds fail closed.
    if (import.meta.dev) return
    throw createError({ statusCode: 503, statusMessage: 'Team password is not configured.' })
  }
  const authorization = getHeader(event, 'authorization') || ''
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)
  const supplied = match ? Buffer.from(match[1]!, 'base64').toString('utf8') : ''
  if (!timingSafeEqual(digest(supplied), digest(`team:${teamPassword}`))) {
    setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="Agent workshop", charset="UTF-8"')
    throw createError({ statusCode: 401, statusMessage: 'Sign in with the team password.' })
  }
  // Browsers may cache Basic credentials. Reject cross-site mutations even
  // when those credentials are automatically attached to a request.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) {
    const origin = getHeader(event, 'origin')
    const fetchSite = getHeader(event, 'sec-fetch-site')
    let foreignOrigin = false
    if (origin) {
      try { foreignOrigin = new URL(origin).host !== getHeader(event, 'host') }
      catch { foreignOrigin = true }
    }
    if (fetchSite === 'cross-site' || foreignOrigin) {
      throw createError({ statusCode: 403, statusMessage: 'Cross-site requests are not allowed.' })
    }
  }
})
