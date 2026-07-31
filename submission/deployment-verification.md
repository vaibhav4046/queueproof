# Deployment verification

Status: deployed and smoke-tested on 2026-07-31.

Populate only after the production URL responds:

- Web URL: `https://queueproof-control-plane.vaibhav09908.chatgpt.site` (private Sites access).
- `/api/health/live`: HTTP 200, `status=live`.
- `/api/health/ready`: HTTP 200; D1, R2, and encryption checks true.
- D1 migration: packaged and applied through the Sites version flow.
- R2 binding: present and reported configured.
- Unconfigured MCP behavior: `/api/mcp` returns HTTP 503 with an explicit disabled-authentication message.
- Authenticated MCP handshake: not run; requires a hosted workspace ID and bearer token after owner sign-in.
- Desktop: local 1280px browser QA passed with zero horizontal overflow and no console warnings/errors.
- Mobile: local 390px browser QA passed with responsive bottom navigation and zero horizontal overflow.
- Reduced motion: stylesheet guard present; browser media emulation not run.
- Cold start: health returned within the 30-second smoke-test budget; no benchmark series recorded.
- Live connector verification: not run; HydraDB/provider credentials absent.
- Recorded at: 2026-07-31T09:42Z.
