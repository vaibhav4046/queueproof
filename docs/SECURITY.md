# Security model

## Identity and tenancy

- Actors are resolved server-side from a signed session or the explicitly enabled public actor.
- Workspace IDs in request bodies are ignored; membership/public policy selects the workspace.
- The current hackathon deployment intentionally enables public mutation. This is appropriate only for the shared demo workspace and must be disabled for private data.

## Secrets

- HydraDB credentials are encrypted at rest with AES-GCM and only a fingerprint returns to clients.
- Runtime validation requires a production encryption key and a complete Turso URL/token pair, forbids fixture/local-identity modes, and rejects ambiguous public-access values.
- Redaction covers Bearer, Slack, GitHub, Google, Linear, QueueProof, Attio, generic key/value credentials, credential URLs and query tokens.
- The previously exposed Attio credential is not used. `.env.example` contains only a placeholder pending rotation.

## Retrieval and ingestion

- URLs are HTTPS-only and block local, private, link-local, CGNAT, IPv6-local and mapped-private destinations.
- PDF validation uses magic bytes; text rejects NULs and invalid UTF-8; intake is capped before reading into memory.
- SHA-256 plus a database uniqueness constraint makes duplicate upload handling race-safe.
- Source/chunk joins use HydraDB IDs. Retrieved prompt-injection-shaped content is excluded from ranking.

## Actions and MCP

- MCP tokens are hashed, scoped, expiring and revocable.
- External writes are proposal-first, evidence-linked, risk-labelled, explicitly approved and idempotent.
- Execution state is claimed before provider I/O to prevent a double write.

## Verification

Run `npm run test:security`, the complete test suite, and Gitleaks against both the worktree and Git history before release. Scanner output must use redaction and must never print a discovered secret value.
