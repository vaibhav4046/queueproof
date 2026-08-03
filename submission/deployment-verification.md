# Deployment verification

Canonical target: <https://queueproof.vercel.app>

## Release-candidate gates

| Gate | Status |
| --- | --- |
| Typecheck | pass |
| Lint | pass |
| Production build | pass |
| E2E shell/product contract | pass |
| Deployment binding check | pass |
| Full suite | 274 tests across 29 files |

Responsive QA passed at 360x800, 390x844, 768x1024, 1440x900, 1920x1080,
2560x1440, and 3840x2160.

## Last observed production

- The root product and readiness endpoint responded successfully.
- The shared workspace exposed four verified connector receipts.
- The flagship question returned a grounded GitHub + Linear + Slack result.

These observations prove the existing production service was live. They do not, by
themselves, prove that a later local commit has been published. Confirm the final release
commit against the deployment receipt after publishing.

The public deployment is a shared evidence sandbox. Sensitive control-plane mutations
must return 403 for its actor. `QUEUEPROOF_PUBLIC_WORKSPACE_ID` should name the exact
shared workspace; ambiguous multi-workspace state without it fails closed.
