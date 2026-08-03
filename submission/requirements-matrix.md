# Submission requirements matrix

The canonical judging matrix is [docs/JUDGING_MATRIX.md](../docs/JUDGING_MATRIX.md).

## Release checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public product | <https://queueproof.vercel.app> + [deployment receipt](https://vercel.com/vaibhav4046s-projects/queueproof/HeScQwHp4GohxVCjni8LifKABPFf) | release `855e61a` verified live |
| HydraDB connector proof | [connector proof](../docs/CONNECTOR_PROOF.md) | four last-observed verified connectors |
| Cross-source answer | Flagship GitHub + Linear + Slack receipt | observed in production |
| Deterministic evaluation | `npm run benchmark:router` | 39/39; 331 assertions |
| Full automated suite | `npm test` | 274 tests across 29 files |
| Security/MCP | `npm run test:security`, `npm run test:mcp` | 13 / 8 tests |
| Build quality | typecheck, lint, build, E2E, deploy check | pass |
| Responsive product | 360x800 through 3840x2160 | pass |
| Secret hygiene | [scan evidence](../audit/secret-scan-2026-08-03.md) | 0 matching files across pre-release history + release worktree |
| Live queue precision | Fresh packet `AE1EB62B`, GitHub + Slack receipts | one actionable row; known non-work artifact families absent |
| Large-PDF proof | [status and methodology](../docs/LARGE_PDF_PROOF.md) | historical 21/22 only; fresh strict result not claimed |
| Demo | [canonical script](../docs/DEMO_SCRIPT_60S.md) | ready |
| Submission text | [canonical copy](../docs/SUBMISSION_COPY.md) | ready |

## Before final submission

- Confirm judge access to the repository.
- Add the final video URL to `submission/form-answers.md`.
- Do not convert the historical PDF artifact into a current strict-grade claim.
