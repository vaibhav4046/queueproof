# Live acceptance status

Verified on 4 August 2026 for application release
`4510d3fe60b3c271a107f514c98c42d120c9929b`:

- the canonical Vercel product loaded successfully from a cache-busted URL;
- GitHub, Gmail, Linear, and Slack were `data_verified` in the shared workspace;
- the flagship browser query created persisted receipt
  `query_9a06859d-62d8-4468-8b77-2d5732d3685f`;
- it returned 4/4 cited claims from GitHub, Linear, and Slack using two HydraDB calls,
  preserved one tracked-state contradiction, and recorded ten replayable backend events;
- it produced one approval-gated action, **Resolve the ENG-456 tracked-state mismatch**,
  scored `53.56`; and
- desktop and phone layouts had no horizontal overflow, no broken images, and no browser
  console warnings or errors.

Deployment receipt:
<https://vercel.com/vaibhav4046s-projects/queueproof/GeLLWZkhf7ht6WSrkfnYw3LZXU2X>.

A fresh strict six-question diagnostic run on 4 August matched 19/19 required facts and
passed 4/6 complete cases, with 100% citation precision/completeness and zero unsupported
claims. The stale-state case lacked a separate Linear receipt and supported cross-provider
contradiction; the exact-ID case lacked the rubric-required Linear receipt. Both remain
REVIEW. The sample is a diagnostic, not an SLA or a general accuracy claim.

The fresh strict 346-page PDF baseline passed 20/22 cases and matched 53/56 required facts,
again with complete citations and zero unsupported claims; see `docs/LARGE_PDF_PROOF.md`.

Current release gates are recorded in
[submission/requirements-matrix.md](requirements-matrix.md). The exact deployment
identity, persisted query receipt, and benchmark artifact above provide production parity
for the application release commit.
