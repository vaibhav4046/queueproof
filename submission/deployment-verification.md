# Deployment verification

Canonical target: <https://queueproof.vercel.app>

Application release commit: `4510d3fe60b3c271a107f514c98c42d120c9929b`

Immutable Vercel deployment:
<https://queueproof-cj96yfmlz-vaibhav4046s-projects.vercel.app>

Vercel receipt:
<https://vercel.com/vaibhav4046s-projects/queueproof/GeLLWZkhf7ht6WSrkfnYw3LZXU2X>

## Release gates

| Gate | Status |
| --- | --- |
| Typecheck | pass |
| Lint | pass |
| Next/Webpack production build | pass |
| Vinext production build | pass |
| E2E shell/product contract | pass |
| Deployment binding check | pass |
| Full suite | 330 tests across 35 files |
| Deterministic router | 39/39 cases; 331 assertions |
| Realistic secret scan | 0 source or reachable-history matches |

Responsive QA passed on the release matrix. Final production browser verification at
1265x712 and 390x843 found no horizontal overflow, no broken images, seven navigation
destinations, and no browser console warnings or errors.

## Verified production acceptance

- `/api/health/live` reported the exact release SHA and `main` ref.
- `/api/health/ready` reported healthy database and encryption bindings.
- GitHub, Gmail, Linear, and Slack each had a `data_verified` connector receipt. One older
  degraded Linear row remained observable and was excluded from retrieval eligibility.
- Flagship receipt `query_9a06859d-62d8-4468-8b77-2d5732d3685f` returned 4/4 cited
  claims from GitHub, Linear, and Slack, used two HydraDB calls, preserved one
  contradiction, and stored ten replayable workflow events.
- Replay and the exact GitHub citation dialog worked in the production browser.
- The final strict six-query production run matched 19/19 required facts, fully passed
  4/6 cases, kept both multi-provider misses as REVIEW, and reported 100% citation
  precision/completeness with zero unsupported claims.

The public deployment is a shared evidence sandbox. Sensitive control-plane mutations
return 403 for its actor, and external execution remains approval-gated.
