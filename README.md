# Agent workshop

A minimal Nuxt → n8n → OpenAI proof of concept. One form, one server endpoint, five sequential prompt roles, one JSON response. No database, queue, vector store, agent framework, or app history. Agents propose and review work; they do not execute code or perform external actions.

## Project map

- [Architecture, data flow, design decisions, and extension guide](docs/ARCHITECTURE.md)
- [Secure team hosting proposal](docs/HOSTING.md)
- [Importable n8n workflow](n8n/agent-team.json)
- [Environment template](.env.example)

## What you must provide

| Item | Configure it here |
| --- | --- |
| A strong shared team password | Set `NUXT_TEAM_PASSWORD` in production; browser username is `team` |
| An n8n instance reachable from your Nuxt server | Use your existing instance, n8n Cloud, or a local installation |
| A webhook shared secret you choose | n8n Header Auth credential with header name `X-Agent-Secret`; same value in Nuxt `NUXT_N8N_WEBHOOK_SECRET` |
| Published workflow's production webhook URL | Nuxt `NUXT_N8N_WEBHOOK_URL` |
| OpenAI API key with API billing/access | n8n Header Auth credential: name `Authorization`, value `Bearer YOUR_API_KEY` |
| A model ID available to your OpenAI project that supports Responses API structured outputs | Default: `gpt-4.1-mini`; edit the Configure model node to change it |

Do not paste credentials into chat or commit them. No OpenAI key belongs in Nuxt. Each successful run makes five OpenAI requests. Check your project's model access and spending settings before the first live run.

Hosting is the next phase; see [secure team hosting](docs/HOSTING.md). Local development needs no hosting account or domain. Before deployment, choose a Node-capable host, private access/authentication for the app, and a request timeout budget that fits five sequential calls. The webhook secret authenticates Nuxt to n8n. A separate `NUXT_TEAM_PASSWORD` protects the page and `/api/run` with a browser login (username `team`). Production refuses access if this password is missing. Use HTTPS when hosting.

## Run locally

Requires Node 24 and npm (see `.nvmrc`).

```sh
npm ci
cp .env.example .env
# Fill the webhook URL and secret in .env.
npm run dev
```

Open http://localhost:3000. With empty configuration, submitting an idea shows a helpful setup error. There is no simulated-success mode.

```sh
npm test
npm run typecheck
npm run build
npm run test:integration
npm run preview
```

Set `NUXT_TEAM_PASSWORD` before previewing a production build. Development allows no password when this setting is empty. Nuxt loads `.env` for development/preview. For the built Node server, set `NUXT_N8N_WEBHOOK_URL`, `NUXT_N8N_WEBHOOK_SECRET`, and optionally `NUXT_N8N_TIMEOUT_MS` in the host environment, then run `node .output/server/index.mjs`. A static-only host cannot run this endpoint.

## Configure n8n

1. Import `n8n/agent-team.json`. It imports inactive and without credentials.
2. Open **Webhook**. Select/create its Header Auth credential: name `X-Agent-Secret`, value your shared secret. It accepts POST and responds using the final Respond to Webhook node.
3. Open **Configure model** and confirm `gpt-4.1-mini` is available to your API project, or set another compatible model ID.
4. Create a separate Header Auth credential: name `Authorization`, value `Bearer YOUR_API_KEY`. Select this credential in **all five HTTP Request nodes**: Architect, Product manager, Developer, QA reviewer, Synthesizer. These call OpenAI's Responses API directly; no SDK is required.
5. Publish/activate the workflow. Copy its **Production URL** into `.env` and set the matching secret. Restart Nuxt after editing `.env`.
6. Submit a small idea. Inspect the n8n execution and compare the five results in the UI. This is the required live integration check; local tests cannot verify your n8n version, credentials, model access, or billing.

The test webhook URL only works while n8n is listening for a test event. Use the production URL for normal use. The workflow's HTTP Request nodes use a 90-second per-call limit; Nuxt waits 120 seconds total by default. Keep outputs concise. A timeout does not cancel the n8n run; inspect its execution before resubmitting to avoid duplicate cost. The app does not retry automatically. Workflow errors may surface as either a failed request or a timeout depending on n8n's response behavior.

## How the pieces fit

- `app/app.vue`: sends `{ idea }` to `/api/run`; disables duplicate submissions; renders waiting, errors, the final recommendation, and each agent's summary/details. Model text is escaped as ordinary text, never rendered as HTML.
- `server/api/run.post.ts`: validates input, reads private runtime configuration, generates a run ID, calls n8n once, validates its response, and returns only contract fields. Upstream error bodies and secrets are not forwarded to the browser.
- `shared/contract.ts`: defines and validates the contract so a malformed or mismatched workflow response becomes an actionable error.
- `n8n/agent-team.json`: passes the idea and accumulated agent outputs through Architect → Product manager → Developer → QA reviewer → Synthesizer. Each collection node retains prior results before moving to the next role.

Nuxt sends:

```json
{ "runId": "server-generated-uuid", "idea": "Plan a book club app" }
```

n8n must return a single JSON object, not an array or JSON encoded as a string:

```json
{
  "runId": "server-generated-uuid",
  "status": "complete",
  "agents": {
    "architect": { "summary": "Architecture", "details": ["One page"] },
    "productManager": { "summary": "Scope", "details": ["Define voting"] },
    "developer": { "summary": "Implementation", "details": ["Build the form"] },
    "qa": { "summary": "Review", "details": ["Test empty submissions"] }
  },
  "final": { "summary": "Start with a voting prototype", "details": ["Confirm the rules"] }
}
```

Each summary must be nonempty and at most 20,000 characters. Details must be an array of at most 50 strings, each at most 20,000 characters. Ideas are trimmed and limited to 5,000 characters. Results exist only in page memory; refreshing clears them. n8n may retain execution data according to its own settings, and OpenAI processing is subject to your account's data controls (`store: false` is set in the requests).

## Troubleshooting

- **401 sign-in:** username is `team`; password is the server's `NUXT_TEAM_PASSWORD`.
- **503 team password error:** configure `NUXT_TEAM_PASSWORD` and restart the production server.
- **503 setup error:** fill the server environment URL and secret; timeout must be 100–300000 ms.
- **502 request failed:** check URL, workflow publication, webhook credential, OpenAI credential/model, and n8n execution logs.
- **502 unexpected result:** return the exact contract above, including the original run ID. Do not use Webhook's immediate-response mode.
- **504 timeout:** inspect n8n before retrying. Align Nuxt, n8n, and any hosting proxy timeouts.

## Official references

- [Nuxt private runtime configuration](https://nuxt.com/docs/4.x/guide/going-further/runtime-config)
- [n8n webhook authentication and response modes](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [OpenAI API quickstart](https://developers.openai.com/api/docs/quickstart)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## Verification performed

Production build, TypeScript checks, contract tests, and production-server integration checks passed locally. Integration checks use a temporary local webhook and verify authentication, success, invalid input, malformed upstream data, sanitized failures, timeouts, and no automatic retries. The original prototype also completed a real end-to-end run on September 8, 2026 using n8n Cloud 2.39.0 and `gpt-4.1-mini`. New installations still need their own live verification.

## Development and versioning

GitHub Actions runs contract/workflow tests, type checking, a production build, and a local mock-webhook integration check. It needs no n8n or OpenAI secrets. `npm start` runs a previously built server; to load a local `.env` without development file watchers, use `node --env-file=.env .output/server/index.mjs`.

Commit changes and push to `main` to sync source to GitHub. Workflow edits must also be applied and published in n8n separately. Keep credentials and execution exports out of commits. This public prototype does not yet grant an explicit open-source license; choose a license before promising reuse rights to others.
