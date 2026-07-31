# QueueProof acceptance matrix

Truth labels:

- **local-pass** — code path was compiled/tested or exercised locally.
- **implemented-unverified** — complete implementation exists; a live external account is required for evidence.
- **blocked-external** — provider authorisation has not been supplied.
- **deferred-hidden** — not presented as a working product feature.

| Capability | Implementation | Verification | Result | Remaining gate |
|---|---|---|---|---|
| Workspace and identity | Durable workspace membership; local identity only in development | Browser bootstrap + API smoke | local-pass | Hosted owner sign-in supplied by Sites |
| HydraDB credential | Authenticated database-list check; AES-GCM storage; fingerprint only in UI | Typecheck, security tests, browser form | local-pass | Fresh user key for hosted acceptance |
| Database plane | List existing databases and create a new provisioning request | API/build verification | implemented-unverified | HydraDB account |
| Dynamic provider catalogue | `/connector-catalog` plus per-provider `?id=` hydration | Adapter/typecheck | implemented-unverified | HydraDB account |
| Dynamic credentials | Credential fields, required flags, enums, descriptions, account scope | Browser source modal | implemented-unverified | Provider contract + credentials |
| Resource discovery | Real HydraDB connector discovery | API/build verification | implemented-unverified | Provider authorisation |
| Scoped configure | User selects exact resources; configure starts initial backfill | API/build verification | implemented-unverified | Live resources |
| Connector proof | All selected resources require cursors; hash includes cursor values; current connector state + canary records | Contract review + build | implemented-unverified | Completed live sync |
| Slack | Generic verified connector lifecycle | No live proof | blocked-external | Slack authorisation |
| Gmail | Generic verified connector lifecycle | No live proof | blocked-external | Gmail authorisation |
| Linear | Generic verified connector lifecycle | No live proof | blocked-external | Linear authorisation |
| Cross-source Ask | Parallel fan-out over every verified connector; citations and per-call trace | API/build + retrieval tests | implemented-unverified | Two or more live sources |
| Prompt-injection resistance | Unsafe retrieved instructions excluded from Ask/queue; secrets redacted | 13 security tests | local-pass | Live adversarial evaluation |
| Command Queue | Live-only retrieval, shared deterministic ranker, durable D1 snapshot | Typecheck/ranking tests | implemented-unverified | Live actionable records |
| Execution Packet | Required evidence; schema validation; source/title/excerpt/time/link/authority; constraints and missing facts | Contract tests | local-pass | Live packet quality review |
| Web/API/MCP parity | Browser queue and MCP read the same stored packet JSON by packet ID | Shared D1 path verified in code | implemented-unverified | Hosted token + live packet call |
| Deterministic ranking | 100-point components, penalties, comparison, counterfactual | Ranking tests | local-pass | Policy calibration with live corpus |
| Remote MCP | Modern handler, bearer auth, per-workspace token lookup | MCP tests + build | local-pass | Hosted handshake |
| MCP credential lifecycle | One-time plaintext, hash-only storage, expiry, revocation, scopes | Browser create/revoke acceptance | local-pass | Client handshake |
| Agent completion report | Callback tool records execution event and packet state; no provider write | Build/typecheck | local-pass | Agent call |
| Human-gated external writes | Proposal storage only | MCP contract | deferred-hidden | Approval token + provider executor |
| OAuth 2.1 MCP auth | Not claimed | — | deferred-hidden | Full authorization server |
| Memory / learning / registry | Tables/artifacts are not exposed as working product | — | deferred-hidden | Dedicated implementation |
| Evaluation Lab | Routing fixtures only | 32 fixture cases | deferred-hidden | Real quality/latency/cost suite |
| Document upload / large PDF | Not in principal flow | — | deferred-hidden | Upload, R2, ingestion and proof |
| Responsive product shell | Four primary destinations; real icons; reduced-motion support | Desktop browser QA + CSS breakpoints | local-pass | Device lab sweep |
| Public Vercel edge | Clear secure-workspace handoff; no fake browser storage | Production build | local-pass | Redeploy current revision |
| Durable Sites app | D1/R2 bindings declared | `deploy:check` | local-pass | Redeploy current revision |

## Definition-of-done blocker

The repository cannot truthfully claim “three working connectors” or a live provider action without the user authorising Slack, Gmail, and Linear through a fresh HydraDB account. QueueProof now makes that the only manual acceptance gate and does not fabricate the missing evidence.
