# Architecture and extension guide

## Working baseline

On September 8, 2026, a local Nuxt app completed a real run through n8n Cloud 2.39.0 and OpenAI `gpt-4.1-mini`. The test idea was: “Plan a simple book club app where members suggest books and vote.” The browser displayed a final recommendation and all four role reports. This establishes a working planning prototype, not autonomous code execution.

The exported workflow contains no credentials or deployment-specific URLs. The running n8n workflow is a separate deployment: editing this repository does not automatically update it. Import updates deliberately and reconnect credentials; never overwrite a configured workflow without reviewing the changes.

## Request lifecycle

```mermaid
sequenceDiagram
    participant U as Browser
    participant N as Nuxt server
    participant W as n8n workflow
    participant O as OpenAI Responses API
    U->>N: POST /api/run { idea }
    N->>N: Validate idea; generate runId
    N->>W: POST { runId, idea } + X-Agent-Secret
    W->>W: Configure model and initialize agents
    loop Architect, Product manager, Developer, QA, Synthesizer
        W->>O: Role prompt + idea + earlier results
        O-->>W: Structured summary and details
        W->>W: Parse output and carry state forward
    end
    W-->>N: { runId, status, agents, final }
    N->>N: Validate response and matching runId
    N-->>U: Sanitized structured result
```

## Ownership

| Component | Responsibility | Does not do |
| --- | --- | --- |
| `app/app.vue` | Input, loading/error states, escaped text rendering | Store secrets or persist runs |
| `server/middleware/team-auth.ts` | Shared browser password, cross-site mutation check, fail-closed production config | Individual accounts or rate limiting |
| `server/api/run.post.ts` | Validation, private config, one webhook call, error boundary | Call OpenAI directly or retry runs |
| `shared/contract.ts` | Shared types and runtime response validation | Trust arbitrary upstream fields |
| `n8n/agent-team.json` | Sequencing, prompts, model requests, aggregation | Execute generated code or deploy apps |
| n8n credentials | Webhook authentication and OpenAI key storage | Publish credentials with workflow exports |

## State and contract

Nuxt generates a UUID for correlation, not durable job lookup or deduplication. n8n carries `{ runId, idea, model, agents }` between stages. HTTP nodes replace their input with the OpenAI response; the following Collect node retrieves the previous state and appends the new result.

Each role emits `{ summary: string, details: string[] }` using Responses API JSON Schema structured outputs. Synthesizer writes `final`; the other roles populate `agents.architect`, `agents.productManager`, `agents.developer`, and `agents.qa`. See the README for the complete public contract.

Results live in browser memory. n8n execution retention is managed separately. Requests set OpenAI `store: false`; that is not a claim that all provider logs or retention disappear.

## Failure behavior

| Failure | App response |
| --- | --- |
| Invalid input / non-JSON content type | 400 / 415 |
| Missing or invalid server configuration | 503 |
| Upstream request failure | 502 with generic message |
| Malformed response or wrong run ID | 502 |
| App wait expires | 504; n8n may still be running |

There are no automatic Nuxt retries. A user retry starts a new run and may incur additional costs. The total default timeout is 120 seconds, while individual n8n HTTP nodes allow 90 seconds. Five slow sequential calls may exceed the total budget. Hosting proxies can impose lower limits.

## Lessons from setup

- Keep webhook Header Auth (`X-Agent-Secret`) separate from OpenAI Header Auth (`Authorization: Bearer …`).
- Publish the workflow and use its production webhook URL.
- The model setting is in the Configure model Code node.
- Separate adjacent closing braces inside n8n expressions so they cannot be mistaken for the expression closing delimiter. Regression tests evaluate every exported request body.
- A “too many requests” heading may wrap an insufficient-credit error; inspect the detailed provider message.
- Local mock tests do not prove model access, billing, or n8n compatibility. One real run confirmed the original baseline.

## Intentional limits and next steps

This is a sequential prompt pipeline with five roles. It has no tools, feedback loop, human approval stages, database, queue, vector store, or persistent memory. The successful book-club output assumed password accounts and one vote per book: role specialization alone does not eliminate shared assumptions.

Suggested extension order:

1. Require agents to label assumptions and distinguish requirements from suggestions; have QA challenge scope and ambiguities.
2. Configure the included shared-password gate over HTTPS for a small team; add server-side usage limits and individual identity when needed (see HOSTING.md).
3. Add real evaluation examples for usefulness, disagreement, and scope discipline.
4. Add persisted runs only when users need history; migrate to asynchronous jobs only when measured run duration requires it.
5. Introduce action-taking tools only with explicit authorization, constrained permissions, and reviewable outputs.

When changing result fields, update the shared validator, n8n schema/collection logic, UI, and tests together. When changing only role instructions, update the exported workflow and the matching `n8n/*-body.txt` editor snippets.

## Shared-password access

Production requires `NUXT_TEAM_PASSWORD`; missing configuration returns 503. HTTP Basic authentication uses username `team` and a constant-time digest comparison. Invalid credentials receive 401 with a browser authentication challenge. Every route passes through the middleware, including `/api/run`; protected HTML is not cached. Cross-site browser mutations are rejected. Development without a configured password remains available for local work. Basic authentication requires HTTPS in deployment. Browsers cache credentials; there is no dedicated logout, per-user revocation, or rate limiter. Restart the service after rotating the shared password.
