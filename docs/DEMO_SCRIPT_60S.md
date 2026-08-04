# QueueProof 60-second demo

Record <https://queueproof.vercel.app/> only after `/api/health/live` matches the current
GitHub `main`. The displayed benchmark artifacts identify their measured release separately.
Keep real failures visible and do not use fixtures. Pre-run the flagship query once so
provider latency does not consume the take.

## 0–7 seconds — Ask

**Screen:** Show the composer and four verified sources, select Fast, then run the AuthShield
question.

**Say:**

> This is QueueProof on four verified HydraDB sources. I’ll run a real multi-hop outage
> question in Fast—no fixture.

## 7–22 seconds — Answer

**Screen:** Show the grounded answer, disagreement, route, provider coverage, calls, and latency.

**Say:**

> It returns one answer, but keeps the Linear and GitHub disagreement visible. Mode, provider
> coverage, calls, and latency are recorded with the exact question.

## 22–34 seconds — Receipt

**Screen:** Open one numbered citation and follow its original-source link.

**Say:**

> Every numbered claim opens to a receipt with provider, timestamp, source ID, excerpt, and
> original link.

## 34–44 seconds — Priority

**Screen:** Open Priorities and expand the first execution packet.

**Say:**

> Priorities compiles the same evidence into a deterministic next action. Any external write
> remains a proposal until a human approves it.

## 44–60 seconds — Fast versus Deep and large PDF

**Screen:** Open Benchmarks. Show the paired Fast/Deep table, `PASS`/`REVIEW` denominator, and
the same-release 346-page PDF result.

**Say:**

> On this release, Fast and Deep both passed four of six strict cases and all nineteen facts.
> Fast cut median latency from 23.6 seconds to 2.5, using seven calls versus thirteen. REVIEW
> failures stay visible, alongside the same-release 346-page PDF result.

## Recording gates

- Confirm all nine routes return 200 and `/api/health/live` identifies the submitted `main`.
- Confirm the four-source count, flagship disagreement, citation link, and priority packet in
  the final take; do not narrate a state that is not visible.
- Keep the two strict `REVIEW` cases visible. The six-case sample is not an SLA.
- The PDF result is 20/22 strict cases and 53/56 facts on the same release; keep the
  cross-source `REVIEW` visible.
- Do not call Replay a live run or relative query units a dollar cost.
- Do not claim the repository is public until its URL opens in a signed-out browser.
