# HydraDB hackathon form answers

These answers are bound to deployed runtime A:
`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`, measured at
<https://queueproof.vercel.app>. Evidence build B is the current `main` commit containing this
receipt; verify its exact deployed SHA via `/api/health/live`. Unless B is deployed and
rerun, the metrics remain runtime-A results.

## Did you try ingesting huge PDFs?

Yes. QueueProof generated and ingested a deterministic **346-page** Helios operations
handbook, recorded its SHA-256 and HydraDB source ID, and tested **22 labelled questions with
56 frozen fact groups** across the beginning, middle, and end.

The SHA-bound runtime-A core run passed **21/22 cases** and recovered **55/56 facts**. It
supported **84/84 claims** with **69 citations**, passed all three document canaries, ran all
22 questions in Fast mode, used **31 HydraDB calls / 31 weighted units**, and measured
**1,823 ms p50 / 2,382 ms p95**.

A separate cross-source extension recovered **2/2 facts** from the document and GitHub, but is
honestly marked **REVIEW** because it missed one additional required non-document provider. It
took **29,676 ms**, **6 calls**, and **18 weighted units**. That extension is not folded into
the 21/22 core denominator.

## Did you use at least three connectors?

Yes. Runtime A's verified workspace and live receipts identify four connectors: **GitHub,
Gmail, Linear, and Slack**. The flagship AuthShield investigation retrieves attributable
GitHub, Linear, and Slack evidence in one answer. QueueProof counts a connector as ready only
after a canary returns provider records with source lineage.

## One-line project description

QueueProof is a daily evidence workspace that turns scattered work across your tools into one
cited answer, preserves disagreements, and proposes the next safe action.

## What does it let a user do?

- Ask a work question in plain language across connected tools and documents.
- Open any numbered claim to inspect its provider, timestamp, excerpt, source ID, and original
  link.
- See conflicts and missing evidence instead of receiving a confident guess.
- Reuse the same grounded evidence from Codex, Claude, and other MCP clients through
  **Connect AI**.
- Keep external writes behind an explicit approval boundary.

## What makes it technically difficult?

The flagship question combines identity matching, timeline ordering, changed-state detection,
cross-provider contradictions, citation validation, and a bounded evidence-derived follow-up.
QueueProof records the selected route, HydraDB calls, retained receipts, latency, and relative
cost, and abstains when the evidence is insufficient.

## Latency, accuracy, and cost

- **Deterministic router:** 39/39 labelled cases and 331 assertions.
- **Auto:** 4/6 strict cases, 19/19 required facts, 2,155 ms p50, 2,392 ms p95,
  7 calls / 7 units; all six queries selected Fast.
- **Forced Fast:** 4/6 strict cases, 19/19 required facts, 1,833 ms p50,
  2,446 ms p95, 7 calls / 7 units.
- **Forced Thinking:** 2/6 strict cases, 13/19 required facts, 26,329 ms p50,
  40,003 ms p95, 10 calls / 30 units, with one timeout.
- **Large-PDF core:** 21/22 strict cases, 55/56 facts, 84/84 supported claims,
  69 citations, 1,823 ms p50, 2,382 ms p95, 31 calls / 31 units.

The 4/6 score includes strict provider and contradiction requirements; the 19/19 score measures
frozen fact recovery. Failures remain visible. These are small release diagnostics, not an
SLA, and weighted query units are not a dollar price.

## Verification completed

Runtime A passed typecheck, lint, 39 test files / 364 tests, 14 security tests, 12 MCP tests,
the 39/39-case router benchmark with 331 assertions, Vinext and Next/Webpack production
builds, built-app end-to-end acceptance, deployment-binding checks, and exact production
SHA/ref verification.

## Video demo

**PENDING.** Record the canonical public route with
[`docs/DEMO_SCRIPT_60S.md`](DEMO_SCRIPT_60S.md), upload it publicly, then paste the final URL
here.

## GitHub submission

<https://github.com/vaibhav4046/queueproof>

**Current status: PRIVATE.** Grant the judges access or make the repository public before
submitting this link. Do not describe it as public until a signed-out check succeeds.

## Judge testing instructions

1. Open <https://queueproof.vercel.app/>.
2. In **Ask**, run: “Who escalated the AuthShield outage, what did engineering commit to, and
   is the fix already merged?”
3. Inspect the cited answer, preserved disagreement, selected mode, provider coverage,
   HydraDB calls, and latency.
4. Open a numbered citation and follow its original-source link.
5. Open **Sources** to inspect connector readiness and document provenance.
6. Open **Proof tests** to inspect the strict denominators, Auto/Fast/Thinking comparison, and
   the visible REVIEW rows.
7. Open **Connect AI** to copy the bounded MCP setup for an AI client.
8. Use [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) to match every reported number to its
   SHA-bound artifact.

## LinkedIn and X/Twitter

Use [`SOCIAL_POSTS.md`](SOCIAL_POSTS.md) only after filling in the public video and repository
access. Keep the strict denominators and REVIEW cases intact.
