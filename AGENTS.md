# Working on this repo as an agent

Read this before touching the n8n workflows. It applies to any agent — Claude, GPT, Cursor,
whatever — and to people too.

An agent once spent about $100 in under an hour here and produced two saved workflow versions and
one failed execution. Nothing was wrong with the model or the prompts. The workflow had no source
of truth, so changing anything meant loading all 157,239 characters of it into context, and it sat
there being re-sent on every turn. The rules below exist to stop that recurring.

## 1. The repo is the source of truth

Edit files here, run `npm test`, then apply the change to n8n. Never edit in the n8n UI and treat
the result as canonical, and never treat a live workflow as the thing to copy from.

That is how this got bad: the exports fell about ten times behind the running workflows, and the QA
aggregation logic ended up as three byte-identical copies free to drift apart.

To compare the repo against what is actually running:

```bash
npm run wf:pull -- <raw-payload.json> n8n/agent-team.json
git diff
```

`wf:pull` does not talk to n8n. Fetch the payload with whatever is already authenticated — the n8n
MCP tools, or Download in the editor — save it to a file, and point the script at it. The output is
deterministic (slug ids from node names, sorted keys, credentials stripped), so an empty `git diff`
is proof the repo and the live workflow agree.

## 2. Never pull a whole workflow into context

Check the size first. If the payload is large, let the tool spill it to a file and query that file
with `jq`. Do not read it whole, and do not "read it in chunks until complete" — that is the same
tokens, paid slowly.

```bash
jq -r '.workflow.nodes[]|"\(.id)\t\(tostring|length)"' spilled.json | sort -t$'\t' -k2 -rn
```

Both workflows are now small enough to read in one call, and tests enforce ceilings to keep them
that way. If a read ever spills again, something regressed — fix that rather than working around it.

## 3. Write one node at a time

`update_workflow` takes surgical operations: `setNodeParameter` with a JSON Pointer path,
`updateNodeParameters`, `addNode`, `addConnection`, `setWorkflowSettings`. Use them.

Never replace a whole workflow to change one node. Writes were never the reason this got expensive;
full-payload reads before every write were.

## 4. Store shared text and logic exactly once

Adding a second copy of a prompt, schema, or function is a bug, not a shortcut.

- The QA reviewer lives in `n8n/qa-review.json`, generated from `n8n/qa-prepare.js` and
  `n8n/qa-aggregation.js`. Those two files are the source; edit them, not the JSON.
- The five request bodies are generated into `n8n/<node-id>-body.txt`.
- Shared configuration belongs in the `Configure model` node, referenced by expression.

`tests/workflow.test.ts` asserts the aggregation block exists in exactly one node and that every
generated file matches its export. If you need the same logic in two places, call the sub-workflow
twice; that is what its `mode` argument is for.

## 5. Stop and report instead of grinding

If you have gone several turns without a committed change or a saved n8n version, stop and say
where you are. Two saves in an hour was the failure signature last time. Long silent loops are the
expensive failure mode, not any single operation.

## Traps specific to this repo

- **Duplicating a workflow in n8n renames every node.** n8n appends `1`, so `Collect Developer`
  becomes `Collect Developer1`. The normalizer strips that, and it also rewrites the
  `$('Collect Developer1')` lookups that would otherwise dangle. A test checks every `$('...')`
  resolves. Do not rename a node without rewriting its references.
- **Node 24 is required** (`.nvmrc`), because the tests use `--experimental-strip-types`. On an
  older Node, `npm test` fails with `bad option`.
- **The sub-workflow id is assigned on import.** Both exports ship with an empty reference on
  `Call QA review` and `Call QA recheck`. It is wired by hand; README step 5 covers it.
- **The QA reviewer runs `gpt-4.1` on purpose**, pinned in `n8n/qa-prepare.js`. The other five roles
  read `gpt-4.1-mini` from `Configure model`. This is deliberate. Do not "fix" it.
- **The isolated QA evaluation workflow is live-only.** It calls the QA review sub-workflow now, so
  it regression-tests the real code rather than a copy, but it is not exported into this repo and
  nothing here guards it. Its fixture passed on 2026-09-11 (execution 183, verdict NEEDS REVISION,
  no mismatches, configHash 96a5b216…), which is the evidence that extracting the QA reviewer did
  not change its behavior. Re-run it after any change to `n8n/qa-aggregation.js` or
  `n8n/qa-prepare.js`.

## Before you say it works

```bash
npm test && npm run typecheck && npm run build && npm run test:integration
```

Both workflows have been proven by execution, not just by tests. The QA evaluation harness passed
its fixture on 2026-09-11 (execution 183), and a staging copy of the planning workflow ran a full
request end to end the same day (execution 185, 51 seconds, contract-shaped response, QA verdict
NEEDS REVISION, ~29K tokens across five calls). That staging run is what exercised the Collect
Synthesizer split, the result-mode recheck and the Finalize synthesis blocker branch. Stage a
duplicate and run it the same way before changing the live workflow again.

None of that proves the workflow runs. Local tests cannot check your n8n version, credentials,
model access, or billing. The planning workflow is live on the `agent-team` webhook and wired to
Nuxt, so a real execution is the only evidence that counts — and each successful run makes five
OpenAI requests. Say plainly which checks you ran and which you did not.
