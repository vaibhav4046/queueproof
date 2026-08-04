# QueueProof — 4 August 2026 release delta (historical)

> **Superseded release record.** This delta describes commit `4510d3f` and the removed
> Evidence Orbit visual generation. Retain its measurements as point-in-time evidence, but do
> not present it as the final redesign or current deployment verification.

This is the final reviewed release delta published to the canonical production URL.

## Product changes

- Added a restrained WebGL evidence field with a static/reduced-motion path, visibility
  pausing, capped resolution, compile checks, and graceful fallback.
- Rebuilt all six product surfaces into one carbon, proof-lime, and evidence-violet visual
  system with editorial typography and glass depth.
- Replaced fast graph motion with a plain Sources → Answer → Next step sequence, slower
  receipts, no pointer parallax, and clearer conflict language.
- Put the working query console and judge CTA in the first product path, with accessible
  focus behavior and mobile-safe navigation.
- Added a real evidence-derived bounded follow-up for deep retrieval and strengthened
  conflict, date, current-deadline, and exact-fact synthesis behavior.

## Measured release candidate

| Gate | Result |
| --- | ---: |
| Typecheck | pass |
| Lint | pass |
| Production build | pass |
| E2E shell contract | pass |
| Sites binding check | pass |
| Full test suite | 330 tests / 35 files |
| Deterministic router | 39/39 cases / 331 assertions |
| Strict PDF public baseline | 20/22 cases / 53/56 facts |
| Six-query public diagnostic | 4/6 complete / 19/19 facts |

The six-query figure is a post-release production result for commit
`4510d3fe60b3c271a107f514c98c42d120c9929b`. The PDF result remains a separately scoped
strict public-production benchmark and is never merged into the live connector score.

## Release gates still requiring owner authority

- Make the private repository judge-accessible.
- Record and attach the final video, LinkedIn post, and X post URLs.
