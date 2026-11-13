# Environment variables

Every environment variable this app reads, all server-side Nuxt runtime configuration. None are sent to the browser, and the app holds no credentials of its own.

Names only are documented here; see `.env.example` for a template and `render.yaml` for the Render blueprint. The values are set in the host's environment, never committed.

## Variables

| Name | Purpose | Required | Set where |
| --- | --- | --- | --- |
| `NUXT_TEAM_PASSWORD` | Shared password for the browser login (username `team`) that protects the page and `/api/run`. Required in production; a missing value returns HTTP 503. Optional in development. | Yes in production | Nuxt |
| `NUXT_N8N_WEBHOOK_URL` | Production webhook URL of the published n8n workflow. Must be an http(s) URL without credentials embedded. | Yes | Nuxt |
| `NUXT_N8N_WEBHOOK_SECRET` | Value of the n8n Header Auth credential named `X-Agent-Secret`, sent as that header on the webhook call. Must match n8n. | Yes | Nuxt |
| `NUXT_N8N_TIMEOUT_MS` | Total time in milliseconds the server waits for one n8n run. Must be between 100 and 300000; defaults to 120000. A timeout does not cancel the n8n execution. | No (default 120000) | Nuxt |
| `NUXT_RUN_LIMIT_PER_HOUR` | Runs allowed per client address per hour; the next request returns HTTP 429 with a `Retry-After` header. Anything but a positive whole number falls back to 10. Counts live in server memory only. | No (default 10) | Nuxt |

## Notes

- The app reads no OpenAI credentials. The OpenAI `Authorization` credential stays in n8n, and `render.yaml` does not set it.
- Nuxt exposes `NUXT_`-prefixed variables to `runtimeConfig`; the keys in `nuxt.config.ts` are `teamPassword`, `n8nWebhookUrl`, `n8nWebhookSecret`, `n8nTimeoutMs`, and `runLimitPerHour`.
- For local development, Nuxt loads `.env`; for the built Node server, set these variables in the host environment. The runtime does not read a laptop `.env` when deployed.
- `HOST` and `PORT` are supplied by the hosting provider, not by this app.