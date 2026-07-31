# Deployment

QueueProof targets OpenAI Sites backed by Cloudflare Workers. `.openai/hosting.json` declares `DB` (D1) and `FILES` (R2).

## Required production values

- `QUEUEPROOF_ENCRYPTION_KEY`: 32 random bytes, base64 encoded.
- `QUEUEPROOF_MCP_TOKEN` and `QUEUEPROOF_MCP_WORKSPACE_ID`: optional together; omit both to disable remote MCP.
- `QUEUEPROOF_OAUTH_ISSUER`: only when a real issuer and callback policy exist.
- `QUEUEPROOF_TEST_MODE=false`.

Do not place a HydraDB key in the deployment environment. Each user submits a newly generated key through the encrypted web flow.

## Release gate

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm deploy:check
```

Apply `drizzle/0000_bent_living_mummy.sql` to the production D1 database. Then verify `/api/health/live`, `/api/health/ready`, `/api/health/dependencies`, desktop/mobile layouts, reduced motion, and `/api/mcp` unauthenticated 401/disabled 503 behavior.

Deployment is not connector verification. After deployment, a user must authorise HydraDB and provider accounts, select resources, request sync, and run canary verification. Record the resulting connector receipt without copying private source data into public artifacts.

Rollback by redeploying the last saved Sites version. Database migrations are forward-only; back up D1 before destructive schema work.
