# QueueProof — 4 August 2026 release delta

This is the current local release-candidate delta. It is intentionally separated from the
older public deployment until publication is explicitly approved.

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
| Full test suite | 324 tests / 32 files |
| Deterministic router | 39/39 cases / 331 assertions |
| Strict PDF public baseline | 20/22 cases / 53/56 facts |
| Six-query public diagnostic | 1/6 complete / 15/19 facts |

The PDF and six-query figures are public-production baselines measured before the final
unpublished code. They are not presented as post-release results.

## Release gates still requiring owner authority

- Publish the local release to the linked production target.
- Push the final commit to GitHub and make the repository judge-accessible.
- Rerun strict PDF and live acceptance against that exact published commit.
- Record and attach the final video, LinkedIn post, and X post URLs.
