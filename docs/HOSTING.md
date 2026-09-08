# Secure team hosting: proposed next phase

Status: researched and documented; no hosted instance has been created. The app currently has no user authentication or rate limiter. Public source code is fine; an unrestricted running `/api/run` would let visitors spend your API credits.

## Recommended direction

Use a Node web service on Render with a custom team hostname protected by Cloudflare Access. Keep n8n Cloud as the workflow host. Team members sign in through your identity provider or an explicit email allowlist. This preserves the current Nuxt → n8n → OpenAI application architecture; identity protection sits in front of Nuxt.

Render supports GitHub-connected web services, build/start commands, environment secrets, and custom domains. Its default provider URL is publicly reachable. Source: [Render web services](https://render.com/docs/web-services).

Cloudflare Access supports policies for self-hosted applications. Configure the entire hostname, including `/api/run`, and validate Access tokens at the origin or otherwise prevent direct-origin bypass. Merely protecting the custom domain leaves a provider URL exposed. Source: [Cloudflare Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

This is a recommendation, not a completed or tested deployment. Check current plan prices and end-to-end request limits before selecting a plan. A proxy timeout may be shorter than Nuxt's 120-second wait.

## Alternatives

| Option | Fit | Work still required |
| --- | --- | --- |
| Render + Cloudflare Access | Managed Node hosting and team identity policy | Custom domain, policy, origin JWT verification/bypass prevention |
| Existing company Node host + existing SSO gateway | Best if the team already has this infrastructure | Verify protection of every route and direct origin |
| Private server + Cloudflare Tunnel/Access | Avoids a public origin listener | Maintain the server and tunnel; configure access policies |

Prefer reusing an existing company identity/hosting setup if one is already available. Do not add a database just to get team sign-in.

## Deployment settings once access protection is implemented

- Runtime: Node 24; repository branch: `main`.
- Build: `npm ci && npm run build` (build dependencies must be installed).
- Start: `npm start`.
- Host binding: `HOST=0.0.0.0`; use the host-provided `PORT`.
- Runtime secrets: `NUXT_N8N_WEBHOOK_URL`, `NUXT_N8N_WEBHOOK_SECRET`.
- Timeout: `NUXT_N8N_TIMEOUT_MS=120000`, aligned with every proxy and workflow limit.
- OpenAI key stays in n8n; no build-time or public browser variables contain credentials.
- Do not upload `.env`, `.nuxt`, `.output`, or local execution exports.

Build and verify the access layer before attaching live webhook credentials. Treat health-check exceptions carefully: never exempt `/api/run` or the whole app from authentication.

## Acceptance checks before sharing

- Signed-out and unapproved users cannot access the app or call `/api/run`.
- Direct provider URL and alternate hostnames cannot bypass the access gate.
- Missing, forged, expired, and wrong-audience identity tokens are rejected at the origin when using JWT validation.
- Approved team members can submit one idea and see all five results.
- A server-side request/concurrency limit prevents repeated submissions from creating unbounded cost; UI button disabling alone is not sufficient.
- n8n execution access and retention match the team's data expectations.
- Long-running requests and timeouts have been tested across the actual hosting/proxy path.
- Runtime secrets are private and not bundled into browser assets.

## Decisions needed

Choose the host/account and budget, team hostname/domain, authorized member emails or identity group, and expected usage. No deployment or billing purchase should be inferred from publication of the source repository.
