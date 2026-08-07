# Public reviewer workspace provisioning

QueueProof never infers a public tenant and never creates membership while serving a request.
Anonymous reviewer access resolves only when both of these durable facts agree:

1. `QUEUEPROOF_PUBLIC_WORKSPACE_ID` names one exact existing workspace; and
2. that workspace contains `user:public-access` with the non-owner `member` role.

## One-time operator procedure

Choose the already-created reviewer workspace ID from a trusted administrative source. Do not use
a slug, guess an ID, or select a signed-in user's personal workspace. In a trusted operator shell,
load exactly one database backend:

- production: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; or
- local verification: `QUEUEPROOF_SQLITE_PATH`.

Standalone Node scripts do not automatically read `.env.local`. Load the variables through the
operator's normal secret-injection workflow, then run:

```bash
pnpm public:provision -- --workspace ws_<exact-existing-id>
```

The environment selector is also supported:

```bash
QUEUEPROOF_PUBLIC_WORKSPACE_ID=ws_<exact-existing-id> pnpm public:provision
```

If the CLI argument and environment variable are both present, they must match byte-for-byte. The
command fails when the workspace does not exist. It does not create a workspace, reveal database
credentials, or print provider errors that might contain sensitive values.

Within one database transaction the command:

1. upserts the fixed `user:public-access` record;
2. upserts its membership and forces the role to `member`, never `owner`; and
3. records `public_workspace.provision` in the audit ledger.

It then reads the persisted join back and verifies the exact workspace, user, and role. Repeating
the command is safe and cannot elevate the public actor.

## Enable and verify the deployment

After the transaction succeeds, configure the Vercel production deployment with:

```dotenv
QUEUEPROOF_PUBLIC_ACCESS=true
QUEUEPROOF_PUBLIC_WORKSPACE_ID=ws_<same-exact-existing-id>
```

Redeploy the intended commit, then keep the workspace selector in the release verification:

```bash
pnpm release:verify -- \
  --url https://queueproof.vercel.app \
  --sha <exact-40-character-production-sha> \
  --workspace ws_<same-exact-existing-id>
```

The release gate verifies the returned public workspace rather than merely checking that an
environment variable exists. Removing either the membership or selector makes public resolution
fail closed.

This command is an administrative migration, not an application feature. Do not import it into an
API route, server component, middleware, workspace resolver, startup hook, or deployment build.
