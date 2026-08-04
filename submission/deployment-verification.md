# Deployment verification

Canonical target: <https://queueproof.vercel.app>

Historical application release commit: `855e61abb85cfaf414db70fa04ed5f01c1f96b01`

Immutable Vercel deployment: <https://queueproof-9dosezsup-vaibhav4046s-projects.vercel.app>

Vercel receipt: <https://vercel.com/vaibhav4046s-projects/queueproof/HeScQwHp4GohxVCjni8LifKABPFf>

## Final local release-candidate gates

These gates were rerun on 4 August 2026. The candidate is not yet bound to the historical
deployment receipt above; publication and post-deploy acceptance remain pending.

| Gate | Status |
| --- | --- |
| Typecheck | pass |
| Lint | pass |
| Production build | pass |
| E2E shell/product contract | pass |
| Deployment binding check | pass |
| Full suite | 324 tests across 32 files |

Responsive QA passed at 360x800, 390x844, 768x1024, 1440x900, 1920x1080,
2560x1440, and 3840x2160.

## Verified production acceptance

- Observed on 3 August 2026 at 15:39 BST after the canonical alias moved to the
  immutable deployment above.
- The product loaded successfully and the shared workspace exposed four verified
  connector receipts: GitHub, Gmail, Linear, and Slack.
- A cache-busted, user-triggered `Refresh from evidence` completed with the status
  `Built 1 cited execution packet from live evidence.`
- The new packet suffix `AE1EB62B` differed from the preceding run (`1F13EC31`), proving
  the acceptance result was newly generated rather than cached.
- The only ranked item was the Northwind `INC-2031` post-mortem at `72.58`, corroborated
  by two inspectable receipts across GitHub and Slack.
- Recruiting/contract, homework, training/certificate, invoice/receipt, newsletter, and
  zero-score records were absent from the accepted queue.

The immutable URL and Vercel receipt bind this observation to the application release
commit. HydraDB retrieval is relevance-ranked and may return a different safe subset on
later runs; the acceptance claim is the observed queue and its stored packet receipts,
not a promise of fixed retrieval order.

The public deployment is a shared evidence sandbox. Sensitive control-plane mutations
must return 403 for its actor. `QUEUEPROOF_PUBLIC_WORKSPACE_ID` should name the exact
shared workspace; ambiguous multi-workspace state without it fails closed.
