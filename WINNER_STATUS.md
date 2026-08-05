# QueueProof submission readiness

This file is a live release checklist, not a predicted placing and not a store of benchmark
numbers. The product APIs and submitted commit are authoritative.

## Product case

QueueProof solves the hackathon problem directly: it turns scattered work into one cited answer
and a reviewable next action. Its strongest judge-facing differentiators are:

- attributable cross-source evidence instead of uncited search snippets;
- visible contradictions and missing evidence instead of confident smoothing;
- a daily Ask → proof → priority → safe-action workflow;
- the same bounded read contract through MCP; and
- release-bound measurements that refuse to reuse historical scores.

## Authoritative current state

| Question | Source of truth |
| --- | --- |
| What code is running? | <https://queueproof.vercel.app/api/health/live> |
| Are live measurements current? | <https://queueproof.vercel.app/api/lab> |
| What will judges see? | <https://queueproof.vercel.app/benchmarks> |
| What is the release contract? | [`RELEASE_EVIDENCE.md`](RELEASE_EVIDENCE.md) |
| What is the 60-second path? | [`docs/DEMO_SCRIPT_60S.md`](docs/DEMO_SCRIPT_60S.md) |

No SHA, test total, pass count, latency, call count, or cost value in a historical artifact may
override these sources.

## Submission gate

- [ ] The health endpoint reports a full commit SHA and `production` target.
- [ ] `/api/lab` reports the health SHA in `results.currentRelease.commitSha`.
- [ ] Live and PDF results are same-release and `measured`.
- [ ] Fast/Thinking claims are made only when `modeComparison.comparable` is `true`.
- [ ] At least three provider connectors are ready with attributable records.
- [ ] The flagship live question returns cited multi-source evidence.
- [ ] One citation's original-source link resolves.
- [ ] Every `REVIEW`, timeout, and degraded connector stays visible.
- [ ] Typecheck, lint, tests, router benchmark, build, E2E, and deployment checks pass for the
      submitted commit.
- [ ] An authenticated MCP client smoke test is recorded before a named client is claimed.
- [ ] The GitHub repository opens in a signed-out browser. **PENDING**
- [ ] The final 60-second video is public and linked. **PENDING**

## Judge path

1. **Ask:** run the AuthShield investigation live.
2. **Proof:** open a claim receipt and its original link.
3. **Sources:** show at least three ready connectors and the 346-page document provenance.
4. **Proof tests:** read exact same-release mode and PDF values; point to a `REVIEW` row.
5. **Connect AI:** show the MCP endpoint, auth model, and approval boundary.

The release is submission-ready only when every checkbox is true. Publication and video remain
open gates until their signed-out/public checks succeed.
