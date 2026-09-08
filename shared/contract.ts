export const roles = ['architect', 'productManager', 'developer', 'qa'] as const
export type AgentResult = { summary: string; details: string[] }
export type RunResult = { runId: string; status: 'complete'; agents: Record<typeof roles[number], AgentResult>; final: AgentResult }
export function parseIdea(value: unknown): string {
  const idea = (value as { idea?: unknown } | null)?.idea
  if (typeof idea !== 'string' || !idea.trim() || idea.trim().length > 5000) throw new Error('Enter an idea between 1 and 5,000 characters.')
  return idea.trim()
}
function isResult(value: unknown): value is AgentResult {
  if (!value || typeof value !== 'object') return false
  const v = value as AgentResult
  return typeof v.summary === 'string' && v.summary.trim().length > 0 && v.summary.length <= 20000 && Array.isArray(v.details) && v.details.length <= 50 && v.details.every(d => typeof d === 'string' && d.length <= 20000)
}
export function parseResult(value: unknown, runId: string): RunResult {
  const v = value as RunResult | null
  if (!v || v.runId !== runId || v.status !== 'complete' || !v.agents || !roles.every(r => isResult(v.agents[r])) || !isResult(v.final)) throw new Error('Invalid workflow response')
  // Only return contract fields, never arbitrary upstream metadata.
  const clean = (r: AgentResult) => ({ summary: r.summary, details: r.details })
  return { runId, status: 'complete', agents: Object.fromEntries(roles.map(r => [r, clean(v.agents[r])])) as RunResult['agents'], final: clean(v.final) }
}
