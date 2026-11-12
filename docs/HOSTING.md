# Secure team hosting with a shared password

Status: deployed successfully on Render Free on September 8, 2026. Anonymous page/API access and wrong passwords returned 401; authenticated page access returned 200; one hosted run returned all four role reports and a final recommendation. The user chose a simple shared password for the first team prototype.

## Recommended first deployment: Render Node web service

Use the existing n8n Cloud workflow and deploy only Nuxt. Render supports GitHub-connected Node services, environment secrets, HTTPS, and custom domains. [Render web services](https://render.com/docs/web-services)

Connect the GitHub repository and configure:

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Runtime | Node 24 (`.nvmrc`) |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Bind address | `HOST=0.0.0.0` |
| Port | Use Render's supplied `PORT` |
| Secret | `NUXT_TEAM_PASSWORD`: a strong random shared password |
| Secret | `NUXT_N8N_WEBHOOK_URL`: production webhook URL |
| Secret | `NUXT_N8N_WEBHOOK_SECRET`: n8n's X-Agent-Secret value |
| Timeout | `NUXT_N8N_TIMEOUT_MS=120000` |
| Run limit | `NUXT_RUN_LIMIT_PER_HOUR=10` (optional; 10 is the default) |

Build dependencies must be installed during the build. OpenAI credentials stay in n8n. The runtime does not read your laptop's `.env`; enter values in the hosting dashboard.

Choose a plan and confirm current costs and request timeout limits before creating the service. Hosting and API consumption are separate costs. Long requests must fit the host's end-to-end timeout; one hosted run has been verified end to end.

## What the team sees

Opening the URL shows the browser's native login prompt. Username: **team**. Password: the value of `NUXT_TEAM_PASSWORD`. Share that password through your team's password manager, separately from the URL.

The server protects both the page and `/api/run`, including the hosting provider's default URL. If the password is missing, production returns 503 rather than exposing the app. Incorrect credentials return 401. Cross-site browser submissions are rejected. Always use HTTPS; Basic authentication is encoding, not encryption.

Use a health check that supports the protected service, or a TCP check. Do not disable authentication globally to satisfy an unauthenticated HTTP health check; an optional isolated health route would need to be added deliberately if required by the chosen host.

## Limitations

One shared login means no per-person audit or revocation. Rotating the password and restarting the service revokes the old password for everyone. Browsers may cache Basic credentials, so there is no reliable in-app logout button. This version has no brute-force protection on the login and no per-user budgets; use a strong random password and a small trusted group. Check provider usage limits and monitor executions. Timeout does not cancel an n8n run.

## Run limit

Each run makes five OpenAI calls, so the server limits `/api/run` to 10 requests per hour per client address. The next request inside that hour returns HTTP 429 with a `Retry-After` header giving the seconds until the hour ends. Change the number with `NUXT_RUN_LIMIT_PER_HOUR` (default 10).

- Per client address: the first `X-Forwarded-For` address, else the socket address. Teammates behind one office or VPN address share one allowance.
- Only requests that passed the team password are counted. Every such POST counts, including ones that fail validation or fail in n8n.
- Counts are kept in server memory. They reset when the server restarts, which on Render Free includes waking from sleep and every deploy. Running more than one instance would give each its own count.
- It is a cost guard for a trusted group, not a security boundary: someone who has the password can send a different `X-Forwarded-For` value if the host does not overwrite that header. It does not cap total spend or concurrent runs.

## Checks before sharing

1. Signed-out requests to the page and `/api/run` receive 401.
2. The correct password unlocks both, including on the provider's default hostname.
3. A wrong password cannot trigger n8n.
4. The entire connection uses HTTPS.
5. One approved test completes across the deployed Nuxt → n8n → OpenAI path.
6. Secrets are absent from the repository and browser assets.
7. Review n8n execution retention and access before submitting internal team data.

## Future individual sign-in

Cloudflare Access can put an email allowlist or company identity provider in front of the app. If adopted, protect the full hostname including `/api/run`, and validate identity tokens at the origin or prevent direct-origin bypass. Protecting only a custom domain is insufficient when a provider URL remains open. [Cloudflare Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

An existing company Node host is also suitable if it provides HTTPS and compatible timeouts. No database is required for the shared-password approach.

## Still needed

The app is deployed on Render Free. A custom domain is optional. No paid compute plan was selected. Runtime passwords and webhook credentials are configured privately in Render.

## Free-tier deployment template

The repository includes `render.yaml` with `plan: free` and three secret inputs. In Render, create a Blueprint from this repository and supply the secret values privately. It provisions only the Nuxt web service. It does not provision n8n or fund OpenAI usage.

Free web services sleep after 15 minutes without traffic and take about a minute to wake. Render applies monthly instance-hour, bandwidth, and build limits. Keep paid upgrades and overage settings disabled if a strict zero hosting budget is required; review the account billing settings before deployment. [Free plan limits](https://render.com/docs/free)

## Current deployment

- App: https://agent-workshop-71tt.onrender.com
- Deployed source: `96f535a` on `main`.
- Login username: `team`; password distributed privately.
- Source was connected through the public repository URL. For future updates use Render **Manual Deploy → Deploy latest commit**; do not assume a GitHub push alone updates the service. The blueprint remains available for reproducible future deployments.
- n8n workflow changes must still be published separately in n8n.
