# Security research record

Accessed 2026-07-31.

Primary references:

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [MCP security best practices](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices)

Design decisions: fixed server-side workspace binding for remote MCP; fail-closed authentication; no bearer token in persisted client files; HTTPS/private-network egress policy; AES-GCM envelope encryption; evidence treated as untrusted content; proposal/approval/execution separation; idempotency and audit requirements for future writes; explicit test/live flags.

