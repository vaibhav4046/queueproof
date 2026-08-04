# Security

## Model

QueueProof treats the browser, MCP client, provider content, connector descriptors, file uploads, model output, and URLs from source metadata as untrusted. Workspace identity, credential envelopes, policy versions, approvals, and audit records are trusted only after server-side validation.

## Implemented controls

- HydraDB keys are submitted over HTTPS, verified server-side, encrypted with AES-256-GCM, and never returned.
- Provider credentials flow browser → QueueProof server → HydraDB and are not persisted by QueueProof.
- Remote MCP is fail-closed, bearer-authenticated, workspace-bound by server configuration, constant-time compared, origin checked, and no-store.
- OAuth protected-resource metadata returns unavailable unless a real issuer is configured.
- Owner access uses a signed, `httpOnly`, same-site session. A gateway identity header is accepted only when the deployment explicitly opts into the trusted OpenAI Sites proxy; local identity is forbidden in production.
- The public workspace denies credential, connector, upload, MCP-token, and external-write control operations. Anonymous rate-limit buckets use signed random client cookies plus a deployment-wide ceiling; raw IP addresses and browser fingerprints are not stored.
- Write-capable MCP concepts are proposals. The only implemented external execution path is a human-approved Linear issue creation; it claims a database uniqueness record before calling the provider and reports success only when Linear returns an issue ID.
- Zod schemas bound query size, action evidence, risk class, idempotency keys, and execution packets.
- Retrieved content is marked as untrusted evidence; prompt-injection patterns are flagged.
- Private-network and non-HTTPS outbound destinations are rejected by shared security utilities.
- Logs and API errors pass through secret redaction. Spreadsheet exports are formula-neutralised.
- Test fixtures require `QUEUEPROOF_TEST_MODE=true`; live acceptance requires a separate live flag.

## Secret rotation and revocation

1. Revoke the exposed provider or HydraDB credential at its source.
2. Generate a new 32-byte QueueProof encryption key only as part of a planned re-encryption migration; changing it immediately makes existing envelopes unreadable.
3. Replace the MCP bearer token and restart/redeploy.
4. Delete affected connector state and re-authorise through the UI.
5. Review audit events and HydraDB access logs.

## Known limitations

- Bearer MCP authentication is implemented; full OAuth authorisation-server integration depends on a configured issuer.
- The rate limiter uses the product's durable audit ledger rather than a dedicated edge-rate-limit service. Operators should add upstream abuse controls for high-volume deployments.
- CI rejects high/critical dependency advisories and runs type, lint, test, benchmark, build, and binding gates. The full-history secret scan remains a separate release gate and must be repeated before a visibility change.
- External execution is implemented only for Linear; other provider actions remain proposals.
- Live connector and write-action penetration tests require real scoped test accounts.

Report suspected vulnerabilities privately to the repository owner. Do not include credentials, customer content, or exploit data in a public issue.
