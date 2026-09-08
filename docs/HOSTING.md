# Secure team hosting with a shared password

Status: password protection implemented and tested; hosting not yet provisioned. The user chose a simple shared password for the first team prototype.

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

Build dependencies must be installed during the build. OpenAI credentials stay in n8n. The runtime does not read your laptop's `.env`; enter values in the hosting dashboard.

Choose a plan and confirm current costs and request timeout limits before creating the service. Hosting and API consumption are separate costs. Long requests must fit the host's end-to-end timeout; no hosted run has been verified yet.

## What the team sees

Opening the URL shows the browser's native login prompt. Username: **team**. Password: the value of `NUXT_TEAM_PASSWORD`. Share that password through your team's password manager, separately from the URL.

The server protects both the page and `/api/run`, including the hosting provider's default URL. If the password is missing, production returns 503 rather than exposing the app. Incorrect credentials return 401. Cross-site browser submissions are rejected. Always use HTTPS; Basic authentication is encoding, not encryption.

Use a health check that supports the protected service, or a TCP check. Do not disable authentication globally to satisfy an unauthenticated HTTP health check; an optional isolated health route would need to be added deliberately if required by the chosen host.

## Limitations

One shared login means no per-person audit or revocation. Rotating the password and restarting the service revokes the old password for everyone. Browsers may cache Basic credentials, so there is no reliable in-app logout button. This version has no brute-force protection, per-user budgets, or server-side concurrency limiter; use a strong random password and a small trusted group. Check provider usage limits and monitor executions. Timeout does not cancel an n8n run.

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

A hosting account/plan choice and the shared team password. A custom domain is optional for the first deployment. No hosting service has been created and no hosting purchase has been made.
