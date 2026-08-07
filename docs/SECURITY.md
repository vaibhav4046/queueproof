# Security model

## Identity and tenancy

- Auth0 is the primary hosted identity path. Its SDK session is stored in an encrypted,
  `httpOnly`, same-site cookie; issuer plus immutable subject is the tenant key.
- A legacy owner path uses a versioned JSON payload signed with HMAC-SHA-256. It is separately
  gated, remains available for intentional hybrid development, and is disabled for production
  whenever Auth0 is configured. A complete production Auth0 set defaults to Auth0-only with the
  legacy path off when selectors are omitted; explicit production hybrid/legacy settings fail
  validation.
- Safe legacy-cookie support reads the server-appended expiry after the final delimiter,
  preventing delimiter injection from overriding expiry.
- Gateway identity headers are trusted only when the deployment explicitly declares a
  trusted gateway. Direct Vercel deployments reject the OpenAI Sites trust declaration because
  Vercel does not provide that header-stripping boundary. Local identity requires an explicit
  non-production opt-in.
- Operational rows are selected from the server-resolved workspace, not a caller-supplied
  workspace ID.
- Public mode resolves `QUEUEPROOF_PUBLIC_WORKSPACE_ID` only when that workspace has an explicit
  `user:public-access` membership. A missing selector or membership fails closed; there is no
  singleton fallback that could expose a signed-in user's personal workspace. Deployment settings
  do not create membership; the offline `public:provision` command must persist the non-owner
  membership deliberately in one exact existing workspace. The command is idempotent,
  transactional, audit-recorded, and never runs on a request path.

## Public sandbox boundary

The public actor can inspect shared evidence, ask grounded questions, and review queue packets.
It cannot:

- configure HydraDB credentials;
- create, discover, configure, sync, or verify connectors;
- create databases or upload documents;
- enumerate HydraDB databases/providers, call the raw `/api/query` surface, create workspaces, or
  trigger document-status refreshes;
- mint or revoke MCP tokens; or
- approve/execute an external provider write.

Each sensitive route invokes the private-control guard server-side; hiding a browser
button is not the security boundary.

Public read routes also project their responses at serialization time. Raw workspace,
connector, database, collection, HydraDB and source/storage identifiers are omitted or replaced
by stable workspace-scoped public references where the UI needs a round trip. Content/receipt
hashes, arbitrary provider metadata, diagnostic request IDs and raw errors are omitted; legacy
strings receive recursive credential redaction; and source URLs are returned as null because an
apparently normal HTTPS URL can still be a private or signed provider link. The projection covers
server-rendered workspace state, queue and packet reads, connector proof, documents, connector
health, graphs, benchmark artifacts, live ask responses and stored ask replay. Private actors
receive the original full DTO.

The remaining public write/cost paths are deliberately bounded: `/api/ask` allows 12
requests per minute and queue generation allows 3 per 5 minutes. Limits are recorded in
the durable audit ledger. Proposal creation and history, approval, and execution remain
owner-only and return 403 for the public actor.

## Secrets

- HydraDB credentials are encrypted at rest with AES-GCM and a random IV; only a
  fingerprint is returned to the browser.
- The optional deployment-wide Linear execution key is usable only by the stable deployment-owner
  actor in the exact workspace named by `QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID`. Auth0 personal
  workspaces may store local approvals but never inherit that provider credential.
- Before verification, a HydraDB credential may be sent only to the official API origin or one
  alternative origin deliberately pinned in server configuration. A caller-provided public HTTPS
  URL is rejected; generic private-network blocking alone is not a sufficient credential boundary.
- Production configuration requires an encryption key and a complete Turso URL/token
  pair, and rejects test/local identity behavior.
- Redaction covers bearer values, common provider-token formats, private keys,
  credential URLs, query tokens, and generic key/value credentials.
- No real credential belongs in source, fixture, output, screenshot, or documentation.

The historical 3 August scan found zero matching files across that release worktree and its
then-reachable history for AWS, GitHub, OpenAI, Slack, Linear, and private-key patterns. The
scanner emitted paths only, never candidate values. See `audit/secret-scan-2026-08-03.md` and
repeat the scan for the submitted commit as required by
[`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md).

## Retrieval and ingestion

- Only `data_verified` connectors can enter retrieval or queue generation.
- Sources must match the connector ID or a selected resource ID. Provider-name equality
  alone is rejected; uploaded-document evidence must match its HydraDB source ID.
- Sources and chunks join by HydraDB identity, never by response position.
- URLs are HTTPS-only and reject local, private, link-local, CGNAT, IPv6-local, and
  mapped-private destinations.
- Upload size is rejected from `Content-Length` before multipart parsing when possible.
  PDF uses signature validation; text rejects NULs and invalid UTF-8.
- SHA-256 plus a database uniqueness constraint makes duplicate upload handling race-safe.
- Retrieved prompt-injection-shaped instructions are data, not authority, and are
  excluded from ranking/action compilation.

## Actions

- External writes are proposal-first, evidence-linked, risk-labelled, and explicitly
  approved.
- Proposal idempotency is scoped per workspace.
- Web and MCP proposals must resolve every evidence ID inside the same workspace. MCP
  proposals are limited to Linear `create_issue`, must carry those IDs in the exact
  provider description, and are conservatively labelled high risk unless critical.
- Approval revalidates provider, action type, payload bounds, evidence ownership, and
  owner role immediately before the at-most-once execution claim.
- The action integrity migration enforces at most one approval and one execution row per
  proposal while preserving the strongest historical record.
- An execution row is claimed before provider I/O. Concurrent approvals cannot both call
  the provider.
- Success requires a stored provider response ID; failure text is persisted for audit.

## MCP

- Opaque MCP tokens are random bearer values stored only as hashes. They carry scopes, expiry,
  revocation, client identity, and audience.
- Auth0 access tokens are accepted only in enabled OAuth/hybrid mode and must be RS256 JWTs with
  the exact pinned issuer and canonical MCP audience/resource, valid lifetime, subject, and
  `queueproof:read` scope. JWT failures never fall through to opaque authentication.
- MCP search accepts only QueueProof connector IDs or indexed document source IDs returned by list
  tools. Database, collection, and connector lineage are resolved server-side, and every returned
  source is filtered back to the requested connector/resource or document ID.
- The MCP endpoint requires the `queueproof-mcp` audience, so a valid token minted for a
  different service is rejected.
- Public sandbox visitors cannot mint or revoke tokens.

## Verification

```bash
pnpm test:security
pnpm test:mcp
pnpm test
```

Also run typecheck, lint, build, deployment checks, dependency audit, and a
worktree-plus-history secret scan before release. Exact test totals belong in the final CI
receipt rather than this long-lived security model.
