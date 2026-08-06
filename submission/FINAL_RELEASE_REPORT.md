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
| Final main SHA | `[FINAL MAIN SHA]` | GitHub |
| Health endpoint SHA/ref | `[HEALTH SHA]` / `[HEALTH REF]` | `/api/health/live` |
| Vercel deployment ID | `[DEPLOYMENT ID]` | `/api/health/live` / Vercel receipt |
| Deployment timestamp | `[DEPLOYMENT TIMESTAMP]` | `/api/health/live` |
| Benchmark receipt version | `grounded-grader-v2` | `/api/health/live` |

Release identity gate: **PENDING** until Final main SHA equals Health SHA and health reports
production with a valid deployment ID/timestamp.

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
| Protocol/transport | `[NEGOTIATED VERSION / HTTP MCP]` |
| Authentication | Bearer; `[TOKEN TYPE/EXPIRY, NEVER VALUE]` |
| OAuth metadata | `[CONFIGURED ISSUER OR NOT CONFIGURED]` |
| Discovered tools/resources | `[CURRENT RECEIPT]` |
| Authenticated read-only call | `[RECEIPT OR PENDING]` |
| Claude Code | `[CONNECTED / CONFIGURED / NOT TESTED]` |
| Codex | `[CONNECTED / CONFIGURED / NOT TESTED]` |
| Claude web | `[NOT CLAIMED UNLESS OAUTH END TO END PASSED]` |

Anonymous 401 alone is not an authenticated MCP receipt.

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
- `[ ]` Record/upload the video and verify its public URL.
- `[ ]` Paste the final repository/video URLs into the hackathon form.

Status becomes **DONE** only when every controllable gate is complete and this report contains no
unsupported placeholder promoted as fact.
