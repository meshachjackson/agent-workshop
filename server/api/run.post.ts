import { randomUUID } from 'node:crypto'
import { parseIdea, parseResult } from '#shared/contract'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!getHeader(event, 'content-type')?.toLowerCase().startsWith('application/json')) throw createError({ statusCode: 415, statusMessage: 'Send JSON with an idea field.' })
  let idea: string
  try { idea = parseIdea(await readBody(event)) } catch { throw createError({ statusCode: 400, statusMessage: 'Enter an idea between 1 and 5,000 characters.' }) }
  const config = useRuntimeConfig(event)
  let url: URL
  try {
    url = new URL(config.n8nWebhookUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !config.n8nWebhookSecret) throw new Error()
  } catch { throw createError({ statusCode: 503, statusMessage: 'Configure the n8n webhook URL and secret on the server. See README.' }) }
  const timeout = Number(config.n8nTimeoutMs)
  if (!Number.isFinite(timeout) || timeout < 100 || timeout > 300000) throw createError({ statusCode: 503, statusMessage: 'Configure NUXT_N8N_TIMEOUT_MS between 100 and 300000.' })
  const runId = randomUUID()
  let response: unknown
  try {
    response = await $fetch(url.toString(), {
      method: 'POST', body: { runId, idea },
      headers: { 'X-Agent-Secret': config.n8nWebhookSecret },
      timeout, retry: 0, redirect: 'error'
    })
  } catch (error: unknown) {
    const e = error as { name?: string; cause?: { name?: string } }
    const timedOut = [e.name, e.cause?.name].some(n => n === 'TimeoutError' || n === 'AbortError')
    throw createError({ statusCode: timedOut ? 504 : 502, statusMessage: timedOut ? 'The workflow timed out. It may still be running in n8n; check its execution before trying again.' : 'The n8n request failed. Check the workflow execution, URL, and credentials.' })
  }
  try { return parseResult(response, runId) } catch { throw createError({ statusCode: 502, statusMessage: 'n8n returned an unexpected result. Check the response contract in README.' }) }
})
