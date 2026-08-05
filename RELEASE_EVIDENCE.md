# QueueProof release evidence

> [!IMPORTANT]
> **Canonical judge-facing release receipt.** This file is the only place that should call a
> source commit the current release candidate. Update it after the final commit, rerun every
> required gate, and verify the deployed SHA before copying claims into submission material.

## Candidate identity captured on 5 August 2026

| Field | Captured value |
| --- | --- |
| Source commit (`git rev-parse HEAD`) | `cc815172c7249771f1acd6de37a2db799e9ad330` |
| Branch | `codex/dialog-autofocus` |
| Canonical production URL | <https://queueproof.vercel.app> |
| Production SHA for this candidate | **NOT VERIFIED** |
| Repository visibility | **NOT VERIFIED IN A SIGNED-OUT SESSION** |
| Working-tree state at capture | **DIRTY** — uncommitted candidate work existed and is not part of the source commit above |

This is a source-identity snapshot, not a release approval. If the commit or working tree
changes, recapture this section before submission. A production claim is valid only when
`/api/health/live` reports the submitted commit SHA and ref.

## Release gates for this candidate

No complete release-gate run is recorded for the candidate above. Do not carry test totals or
pass states forward from an earlier commit.

| Gate | Required command or check | Status for this candidate |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | **NOT RECORDED** |
| Lint | `pnpm lint` | **NOT RECORDED** |
| Full automated suite | `pnpm test` | **NOT RECORDED** |
| Security suite | `pnpm test:security` | **NOT RECORDED** |
| MCP suite | `pnpm test:mcp` | **NOT RECORDED** |
| Deterministic router | `pnpm benchmark:router` | **NOT RECORDED** |
| Production build | `pnpm build` | **NOT RECORDED** |
| Deployment bindings | `pnpm deploy:check` | **NOT RECORDED** |
| Built-app acceptance | `pnpm test:e2e` against `pnpm start` | **NOT RECORDED** |
| Secret scan | current worktree and reachable history | **NOT RECORDED** |
| Responsive, keyboard, zoom, reduced-motion QA | final deployed build | **NOT RECORDED** |
| Production identity | compare `/api/health/live` with submitted SHA | **NOT RECORDED** |
| Signed-out repository access | open the submitted GitHub URL without authentication | **NOT RECORDED** |

Record exact command output, CI run URL, deployment receipt, and timestamps here after the
final candidate is immutable. Test totals belong to that receipt; they are not evergreen
product facts.

## Checked-in measurement ledger

The files below prove only the run they contain. Their internal timestamp, target, grader,
requested mode, and release identity take precedence over prose elsewhere.

| Evidence | What it measures | Embedded identity | Relationship to current candidate |
| --- | --- | --- | --- |
| [`evals/results/live-fast.json`](evals/results/live-fast.json) | Six-question forced Fast live run | `grounded-grader-v2`; generated `2026-08-04T18:15:50.348Z`; target `https://queueproof.vercel.app`; release-verified `c7cf16b3c92f66d7b2f17a90e01372b77d62235b` on `main` | **Historical; not current-HEAD evidence** |
| [`evals/results/live-thinking.json`](evals/results/live-thinking.json) | Six-question forced thinking live run | `grounded-grader-v2`; generated `2026-08-04T18:19:06.514Z`; target `https://queueproof.vercel.app`; release-verified `c7cf16b3c92f66d7b2f17a90e01372b77d62235b` on `main` | **Historical; not current-HEAD evidence** |
| [`evals/results/live-run.json`](evals/results/live-run.json) | Earlier six-question live sample | Generated `2026-08-04T10:06:06.911Z`; target recorded, but no embedded health/release receipt | **Historical and not SHA-bound** |
| [`evals/results/pdf-live-run.json`](evals/results/pdf-live-run.json) | Strict 346-page PDF run | `grounded-grader-v2`; generated `2026-08-04T18:28:35.671Z`; target recorded, but no embedded health/release receipt | **Historical, timestamp-scoped, and not SHA-bound** |
| [`evals/results/results.json`](evals/results/results.json) and [`results.csv`](evals/results/results.csv) | Offline deterministic router/ranking fixtures | Generated `2026-08-04T22:46:16.720Z`; requested mode `fixture`; live phase `not_requested`; no commit identity | **Historical and not SHA-bound** |
| [`BENCHMARK_REPORT.md`](BENCHMARK_REPORT.md) | Human-readable index of stored fixture and live measurements | Carries per-section timestamps; machine-readable JSON remains authoritative | **Reference only** |

The PDF artifact does **not** embed a release SHA or health receipt. It may be quoted as a
timestamped production measurement, but it must not be described as a same-commit result
without a new SHA-bound run. The offline fixture, live connector, and PDF results are separate
measurements and must never be merged into one accuracy claim.

## Evidence required before submission

1. Commit every intended source and documentation change; ensure the working tree is clean.
2. Replace the candidate SHA and branch above with the submitted commit.
3. Run every release gate and link the immutable CI receipt.
4. Deploy that commit and record the immutable deployment URL.
5. Verify `/api/health/live` reports the exact submitted SHA and ref.
6. Re-run forced Fast, forced thinking, and PDF measurements if they will be presented as
   current-release evidence. The runners must store the production health/release identity.
7. Capture connector proof, owner-only boundary checks, MCP client acceptance, and responsive
   interaction QA against that deployed SHA.
8. Open the repository and live product in signed-out sessions before calling either public.

## Claim rules for judges and marketing

- A `REVIEW` row is a failed strict requirement, not a partial pass.
- A fixture result proves deterministic routing/ranking only, not connector or answer quality.
- A small live sample is a diagnostic, not an SLA or general accuracy estimate.
- Relative query units are not dollars.
- A connector is working only when an attributable canary receipt proves provider data.
- An external action is executed only when a provider response identifier is persisted.
- A historical audit may explain provenance, but it cannot override this receipt or a
  machine-readable artifact.

## Final sign-off fields

| Sign-off | Evidence |
| --- | --- |
| Submitted commit | `PENDING` |
| Clean working tree | `PENDING` |
| CI run | `PENDING` |
| Immutable deployment | `PENDING` |
| `/api/health/live` SHA/ref match | `PENDING` |
| Fast artifact | `PENDING` |
| Thinking artifact | `PENDING` |
| PDF artifact | `PENDING` |
| Connector receipt timestamp | `PENDING` |
| MCP acceptance receipt | `PENDING` |
| Responsive/accessibility QA receipt | `PENDING` |
| Signed-out GitHub check | `PENDING` |
| Video URL | `PENDING` |
