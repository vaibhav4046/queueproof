# Deployment

> **Current runbook (7 August 2026).** QueueProof production runs as a native Next.js
> application on Vercel with Turso/libSQL. Earlier OpenAI Sites, D1, and R2 instructions are
> historical compatibility notes only; do not use them for the production release.

The canonical service is `https://queueproof.vercel.app`. Vercel must build the exact reviewed
GitHub commit and expose that SHA, ref, deployment ID, deployment URL, deployment timestamp, and
benchmark receipt version through `/api/health/live`.

## Required production values

- `QUEUEPROOF_ENCRYPTION_KEY`: at least 32 random characters.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: required together.
- The complete Auth0 web set (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
  `AUTH0_SECRET`) plus the production auth-mode boundary documented in `.env.example`.
- `QUEUEPROOF_MCP_RESOURCE=https://queueproof.vercel.app/mcp` and a separately configured Auth0
  API/client for ChatGPT OAuth.
- `QUEUEPROOF_PUBLIC_ACCESS=true` and an exact `QUEUEPROOF_PUBLIC_WORKSPACE_ID` only for the
  bounded judge workspace. That workspace must already have an explicit non-owner
  `user:public-access` membership.
- `QUEUEPROOF_TEST_MODE=false`, `QUEUEPROOF_LIVE_TEST=false`, and no trusted Sites identity proxy.

Do not place a HydraDB key in the deployment environment. Each user submits a newly generated key through the encrypted web flow.

Provision the deliberately public reviewer identity once, against the exact existing judge
workspace, before enabling public access:

```bash
pnpm public:provision -- --workspace ws_<exact-existing-id>
```

The command requires the selected Turso/libSQL credentials in the shell, creates no workspace,
and always persists the public identity as a non-owner member. Request handling never auto-grants
membership.

## Release gate

```bash
pnpm install --frozen-lockfile
pnpm audit:dependencies
pnpm scan:secrets
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark:router
pnpm build
pnpm deploy:check
```

Publish through a reviewed GitHub branch, then deploy that exact clean commit to the existing
Vercel project. Run `pnpm release:verify -- --url https://queueproof.vercel.app --sha <40-char-sha>`.
The gate checks release identity, the ready public workspace, at least three verified connectors,
an indexed document, public/legal routes, icons/manifest, OAuth metadata, and anonymous MCP
boundaries. `/api/mcp` remains a compatibility alias.

Deployment is not connector verification. After deployment, a user must authorise HydraDB and provider accounts, select resources, request sync, and run canary verification. Record the resulting connector receipt without copying private source data into public artifacts.

Rollback by promoting the last known-good Vercel production deployment. Database migrations are
forward-only; back up Turso before destructive schema work.

## Legacy compatibility

The vinext/Cloudflare build remains useful for local compatibility testing, but it is not the
production control plane. `.openai/hosting.json` and the original D1 migration are retained only
for provenance. Current architecture, security, OAuth, and release instructions live in
`README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/REMOTE_MCP_SETUP.md`.
