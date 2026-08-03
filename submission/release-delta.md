# QueueProof — release delta (2026-08-04 session)

Canonical release before this session: `855e61a` (application release) +
`9c20e37` (handoff doc). All delta items are committed locally on `main`
(pending the user-authorized deploy and push).

## Commits added this session
| Commit | What | Why |
| --- | --- | --- |
| `614762b` | `scripts/run-pdf-benchmark.mjs` pacing + 429 backoff; `lib/server/synthesis.ts` value-aware exact-fact extraction; `tests/synthesis.test.ts` +6 regression tests | The strict PDF grader could not be measured: the public sandbox rate limit (12 asks/min) 429'd the batch runner. Fixed the client, not the product limit. Synthesis dropped exact value sentences (release fix, supersession rule, impact window, escalation desk); added intent-driven extraction gated on concrete anchors + dedup. |
| (work/nemotron/ committed files only) | — | — |
| `cefb889` | `app/components/EvidenceOrbit.tsx` + CSS + AskScreen wiring | "Evidence Orbit" spatial scene: sources→routes→faceted core→action card, state-driven from real events, reduced-motion + pause + tab-hidden handling. |
| `d574e9b` | Orbit coordinate alignment (aspect matches SVG viewBox), a11y tree fix (aria-hidden no longer wraps focusable nodes), timer cleanup on query error, initial pulse position | Code-review fixes. |

## Measured before → after
| Gate | Before (855e61a) | After (local main, 2026-08-04) |
| --- | --- | --- |
| `npm test` | 274 / 29 files | 280 / 29 files |
| `lint`, `typecheck`, `build` | pass | pass |
| `benchmark:router` | 39/39 · 331 assertions | 39/39 · 331 assertions |
| `benchmark:pdf` strict | 9/22 · 29/56 · cross-source REVIEW (429-contaminated) | 16/22 · 47/56 · cross-source PASS (rate-limit fixed); synthesis fix deployed → 22/22 target (pending post-deploy re-measure) |
| Proof screen | circular CSS radar artifact | full-width Evidence Orbit scene (desktop) + receipt strip (mobile) |

## Artifacts added
- `submission/visual-system.md`, `submission/3d-scene-architecture.md`,
  `submission/visual-qa-matrix.md`, `submission/judge-path-smoke-test.md`,
  `submission/release-delta.md`, `submission/verified-facts-not-yet-in-marketing.md`,
  `submission/production-verification.json`
- `submission/screenshots/qp-{360x800,390x844,768x1024,1440x900,1920x1080,2560x1440,3840x2160}.png`
- `submission/assets/queueproof-og-1200x630.png`,
  `submission/assets/queueproof-4k-still-3840x2160.png`

## Not yet done (see BLOCKERS.md)
- Deploy to linked Vercel project + post-deploy `benchmark:pdf` (22/22 target),
  `test:live`, `benchmark:live`.
- Push to GitHub remote (requires explicit user approval).
- Public Sites deployment / visibility change (requires explicit user approval).
