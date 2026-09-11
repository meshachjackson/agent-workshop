// Normalize a raw n8n workflow payload into the portable export committed at n8n/agent-team.json.
// Reads the raw JSON (either a bare workflow or a { workflow: ... } wrapper) and writes a
// deterministic export: stable slug ids, no credentials, inactive, no pinned data. Deterministic
// output is what lets `git diff` prove the repo and the live workflow agree.
import { readFileSync } from 'node:fs'

const slug = name =>
  name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')

// n8n appends "1" to every node name when a workflow is duplicated by pasting. Strip it so the
// export keeps the original names and the ids stay stable across duplications.
const canonicalName = name => name.replace(/1$/, '')

// Editing a parameter in the n8n UI can leave trailing whitespace after an expression's closing
// braces. It is inert at runtime but makes the export non-deterministic, so drop it.
const trimExpression = value =>
  typeof value === 'string' && value.startsWith('={{') ? value.trimEnd() : value

const mapStrings = (value, fn) => {
  if (Array.isArray(value)) return value.map(item => mapStrings(item, fn))
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]))
  return fn(value)
}

const sortKeys = value => {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]))
  return trimExpression(value)
}

// Code nodes and expressions reach other nodes by name, as $('Collect Developer'). Renaming a node
// without rewriting those references leaves the export importable but broken at runtime, so the
// rename and the reference rewrite have to happen together.
const rewriteReferences = (value, names) =>
  typeof value === 'string'
    ? value.replace(/\$\(\s*(["'])(.*?)\1\s*\)/g, (match, quote, name) =>
        names.has(name) ? `$(${quote}${names.get(name)}${quote})` : match,
      )
    : value

export function normalize(raw) {
  const workflow = raw.workflow ?? raw
  const names = new Map(workflow.nodes.map(node => [node.name, canonicalName(node.name)]))

  const nodes = workflow.nodes.map(node => {
    const name = names.get(node.name)
    return sortKeys({
      id: slug(name),
      name,
      parameters: mapStrings(node.parameters ?? {}, value => rewriteReferences(value, names)),
      position: node.position,
      type: node.type,
      typeVersion: node.typeVersion,
    })
  })

  const connections = Object.fromEntries(
    Object.entries(workflow.connections ?? {})
      .map(([source, outputs]) => [
        names.get(source) ?? source,
        Object.fromEntries(
          Object.entries(outputs).map(([type, branches]) => [
            type,
            branches.map(targets =>
              targets.map(target => ({ ...target, node: names.get(target.node) ?? target.node })),
            ),
          ]),
        ),
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  )

  return {
    active: false,
    connections,
    name: workflow.name,
    nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)),
    pinData: {},
    settings: sortKeys(workflow.settings ?? { executionOrder: 'v1' }),
  }
}

const [input] = process.argv.slice(2)
if (input) process.stdout.write(JSON.stringify(normalize(JSON.parse(readFileSync(input, 'utf8'))), null, 2) + '\n')
