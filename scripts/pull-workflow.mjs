// Turn a raw n8n workflow payload into the committed export, so that `git diff` says exactly how
// the running workflow differs from this repo.
//
//   npm run wf:pull -- <raw-payload.json> <n8n/agent-team.json>
//
// This script deliberately does not talk to n8n. Whoever has access fetches the payload — an agent
// through the n8n MCP tools, or a person using Download in the editor — and saves it to a file.
// Adding an API key here would mean another credential to manage for no gain, since the fetch
// already happens somewhere that is authenticated.
//
// Nothing is pushed. Review the diff, run `npm test`, then apply changes to n8n one node at a time.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { normalize, readWorkflow } from './normalize-workflow.mjs'

const [rawPath, outPath] = process.argv.slice(2)
if (!rawPath || !outPath) {
  console.error('usage: npm run wf:pull -- <raw-payload.json> <n8n/target.json>')
  process.exit(2)
}

const workflow = normalize(readWorkflow(rawPath))
writeFileSync(outPath, JSON.stringify(workflow, null, 2) + '\n')

// The editor snippets are generated, not authored: tests compare each request node's body against
// its own file, so regenerating them here keeps a pull from failing on its own output.
const snippets = workflow.nodes
  .filter(node => node.type.endsWith('httpRequest') && typeof node.parameters.body === 'string')
  .map(node => {
    // Alongside the export being written, not always in n8n/, so pulling to a scratch path for
    // comparison cannot overwrite the committed snippets.
    writeFileSync(join(dirname(outPath), `${node.id}-body.txt`), node.parameters.body.slice(1) + '\n')
    return `${node.id}-body.txt`
  })

const biggest = workflow.nodes
  .map(node => ({ name: node.name, size: JSON.stringify(node).length }))
  .sort((a, b) => b.size - a.size)[0]

console.log(`${outPath}: ${workflow.nodes.length} nodes, ${JSON.stringify(workflow).length} characters`)
console.log(`largest node: ${biggest.name} at ${biggest.size} characters`)
if (snippets.length) console.log(`regenerated: ${snippets.join(', ')}`)
console.log('\nnext: git diff, then npm test. Nothing has been pushed to n8n.')
