# Public and owner boundaries

The public deployment remains a shared, read-oriented reviewer workspace. Visitors can inspect
receipts, ask bounded questions, and review queue packets. **Sign in** and **Create account** use
the branded Supabase magic-link flow; each external subject is provisioned a deterministic private QueueProof workspace whose
sources, documents, receipts, queue, and MCP clients are isolated from every other account.

Credential configuration, connector mutation, document uploads, proposal history, approvals,
MCP administration, and external writes require an authenticated workspace owner. The historic
[`/owner`](https://queueproof.vercel.app/owner) access-token flow is a transition path only and can
be used during hybrid development. A complete production Supabase configuration resolves to
Supabase-only web identity and disables legacy owner sign-in when the selectors are omitted; explicit
production `hybrid`, `legacy`, or legacy-enabled settings fail startup validation. Set
`QUEUEPROOF_AUTH_MODE=supabase` and `QUEUEPROOF_LEGACY_OWNER_SIGNIN=false` in Vercel when you want that
policy visible in deployment configuration. Only the Supabase publishable key reaches browser
JavaScript; service-role credentials and legacy session secrets do not.

`QUEUEPROOF_PUBLIC_WORKSPACE_ID` selects the exact public workspace, which must also contain an
explicit `user:public-access` membership. If either is missing, QueueProof fails closed instead of
guessing which tenant to expose—even when the database has only one workspace. Public queries are
rate-limited. Secrets are encrypted at rest and are never returned by the API.

Provision that membership once from a trusted operator shell with the production Turso variables
already loaded (standalone scripts do not automatically load `.env.local`):

```bash
pnpm public:provision -- --workspace ws_<exact-existing-id>
```

The command verifies the workspace exists, atomically upserts only the fixed public user and a
non-owner `member` role, records an audit event, and is safe to repeat. It never creates a
workspace and is never called by a request. Then set `QUEUEPROOF_PUBLIC_ACCESS=true` and the same
`QUEUEPROOF_PUBLIC_WORKSPACE_ID`, redeploy, and keep the exact workspace assertion in the release
gate. See [public workspace provisioning](PUBLIC_WORKSPACE_PROVISIONING.md).
