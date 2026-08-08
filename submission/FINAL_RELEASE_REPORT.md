# QueueProof final release report

> This report is completed from live receipts at release time. Placeholder fields are deliberate:
> no SHA, deployment, connector, benchmark, MCP, or video claim may be copied from an older
> release. Until the fields below are filled and verified, release status is **PENDING RECEIPT**.

## Production release

| Field | Generated-at-release value | Authoritative source |
| --- | --- | --- |
| Live URL | <https://queueproof.vercel.app> | Canonical deployment |
| Benchmarks URL | <https://queueproof.vercel.app/benchmarks> | Canonical deployment |
| GitHub URL | <https://github.com/vaibhav4046/queueproof> | GitHub; visibility currently owner-controlled |
| Starting branch | `codex/dialog-autofocus` | GitHub ref |
| Final main SHA | `79037365d668bde0ad8be24835c37e36420b9fc0` | GitHub |
| Health endpoint SHA/ref | `79037365d668bde0ad8be24835c37e36420b9fc0` / `main` | `/api/health/live` |
| Vercel deployment ID | `dpl_G7mrUCeATifc85ZJrvRWUqqUXDMi` | `/api/health/live` / Vercel receipt |
| Deployment timestamp | `2026-08-08T02:37:40.241Z` | `/api/health/live` |
| Benchmark receipt version | `grounded-grader-v3` | `/api/health/live` |

Release identity gate: **PASS** — verified 2026-08-08T02:38:50Z: Final main SHA equals the health
SHA, health reports `production` with the deployment ID and timestamp above.

## Material changes

- Evidence retrieval uses connector/resource lineage and keeps rejected candidates distinct from
  proof.
- Grounded synthesis supports partial/abstained outcomes, explicit missing facets, and preserved
  contradictions.
- The Today queue uses conflict-aware clustering and deterministic, versioned ranking packets.
- Public reads remain open; connector control, uploads, token management, approvals, and external
  execution remain owner-only.
- Release health and benchmark acceptance bind results to an exact production SHA/ref.
- Browser-facing evidence dates are normalized consistently before formatting.

Confirm each bullet against the final diff before sign-off.

## Verification

| Gate | Final receipt |
| --- | --- |
| Node / pnpm | `[VERSIONS]` |
| Typecheck | `[PASS/FAIL + RECEIPT]` |
| ESLint | `[PASS/FAIL + RECEIPT]` |
| Full tests | `[FILES / TESTS / STATUS]` |
| Router benchmark | `[ASSERTIONS / STATUS]` |
| Build | `[PASS/FAIL]` |
| Deploy binding check | `[PASS/FAIL]` |
| Release route gate | `[PASS/FAIL]` |
| Security/MCP tests | `[PASS/FAIL]` |
| Secret/dependency scan | `[PASS/FAIL + DATE]` |
| Desktop/mobile browser | `[VIEWPORTS + CONSOLE/NETWORK STATUS]` |

Use current CI and command output; do not freeze an earlier test total.

## Connector and document receipts

| Provider/document | State | Attributable records/source ID | Verified at | Counted? |
| --- | --- | --- | --- | --- |
| `[SOURCE 1]` | `[CURRENT STATE]` | `[RECEIPT]` | `[TIME]` | `[YES/NO]` |
| `[SOURCE 2]` | `[CURRENT STATE]` | `[RECEIPT]` | `[TIME]` | `[YES/NO]` |
| `[SOURCE 3]` | `[CURRENT STATE]` | `[RECEIPT]` | `[TIME]` | `[YES/NO]` |
| 346-page document | `[CURRENT STATE]` | `[CHECKSUM + HYDRADB SOURCE ID]` | `[TIME]` | `[YES/NO]` |

At least three connectors count only when current authentication/read/attribution proof exists.

## Production benchmark

Release SHA: `[SAME AS HEALTH SHA]`

| Run | Passed/cases | Required facts | Claim support | Citation resolution | Unsupported claims | p50/p95 | Calls | Units |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Auto | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` |
| Fast | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` |
| Thinking | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` |
| PDF core | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` | `[CURRENT]` |

Mode comparison: `[COMPARABLE + DELTAS, OR NOT COMPARABLE]`

Failed cases/timeouts: `[LIST EVERY REVIEW/TIMEOUT]`

Contradiction and cross-source outcomes: `[CURRENT RECEIPT]`

All units are relative query work, not dollars. The sample is not an SLA.

## Production workflow receipts

For each flagship workflow, record question, direct answer, providers, claims, citations,
contradictions, missing proof, receipt ID, and strict result:

1. AuthShield incident: `[CURRENT RECEIPT]`
2. Most-recent shipment: `[CURRENT RECEIPT]`
3. Exact identifier plus context: `[CURRENT RECEIPT]`
4. Large document: `[CURRENT RECEIPT]`

Do not paste private record bodies into this public report.

## Remote MCP

| Field | Final receipt |
| --- | --- |
| Canonical URL | `https://queueproof.vercel.app/mcp` |
| Protocol/transport | `2025-06-18` negotiated over streamable HTTP (SSE responses) |
| Authentication | Bearer on `/mcp` (anonymous POST → `401` + RFC 9728 `WWW-Authenticate` resource metadata); `/mcp/demo` is a deliberately public read-only reviewer surface |
| OAuth metadata | Live issuer `https://queueproof.vercel.app`: `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` publish authorize/token/register endpoints and scopes `queueproof:read/propose/sync` (verified 2026-08-08T02:41Z) |
| Discovered tools/resources | `tools/list` on `/mcp/demo` → `queueproof_search` (server `queueproof 0.2.0`, tools+resources capabilities) |
| Read-only call (public demo surface) | `tools/call queueproof_search` on `/mcp/demo` at SHA `7903736` → `"status":"grounded"`, providers slack/linear/github, 774 ms server-side, 1 retrieval call, `promptInjectionDetected:false` |
| Authenticated read-only call | PENDING — requires the owner's scoped bearer token; no authenticated client claimed |
| Claude Code | NOT TESTED against production in this release pass; no client named |
| Codex | NOT TESTED against production in this release pass; no client named |
| Claude web | NOT CLAIMED — OAuth end-to-end consent not exercised |

Anonymous 401 alone is not an authenticated MCP receipt; the grounded `tools/call` receipt above
is from the public demo surface, not a bearer session.

## Judge panel

Complete the evidence-backed scores in [OFFICIAL_RUBRIC.md](OFFICIAL_RUBRIC.md). Keep every
deduction and mark a category release-blocking when its official requirement is unproven.

## Submission

- Ready-to-paste copy: [HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md)
- Primary two-to-three-minute script: [VIDEO_SCRIPT_2_3_MINUTES.md](VIDEO_SCRIPT_2_3_MINUTES.md)
- Supademo shot and voice plan: [VIDEO_VOICE_SEGMENTS.md](VIDEO_VOICE_SEGMENTS.md)
- 60-second script: [VIDEO_SCRIPT_60_SECONDS.md](VIDEO_SCRIPT_60_SECONDS.md)
- Four-minute script: [VIDEO_SCRIPT_4_MINUTES.md](VIDEO_SCRIPT_4_MINUTES.md)
- Demo runbook: [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md)
- Judge Q&A: [JUDGE_QA.md](JUDGE_QA.md)

## Remaining manual actions

Keep only actions that genuinely remain:

- `[ ]` Make the repository public only with owner approval; verify signed-out access.
- `[ ]` Complete client OAuth consent only if a real issuer is configured and required.
- `[ ]` Supply the dedicated benchmark-publishing token to publish the measured current-SHA
  artifacts; do not substitute a Vercel or MCP token.
- `[ ]` Rotate any credential exposed outside the approved secret store.
- `[x]` Record the video — final 59.5 s cut at `video/queueproof-demo-v2.mp4` (icon scene,
  aligned captions, −15.0 LUFS / −1.3 dBTP, transcript verified against the locked script).
- `[ ]` Upload the video and verify its public URL.
- `[ ]` Paste the final repository/video URLs into the hackathon form.

Status becomes **DONE** only when every controllable gate is complete and this report contains no
unsupported placeholder promoted as fact.
