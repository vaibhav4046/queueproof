# Submission requirements matrix

The canonical judging matrix is [docs/JUDGING_MATRIX.md](../docs/JUDGING_MATRIX.md).

## Release checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public product | <https://queueproof.vercel.app> + [deployment receipt](https://vercel.com/vaibhav4046s-projects/queueproof/HeScQwHp4GohxVCjni8LifKABPFf) | release `855e61a` verified live |
| HydraDB connector proof | [connector proof](../docs/CONNECTOR_PROOF.md) | four last-observed verified connectors |
| Cross-source answer | Flagship GitHub + Linear + Slack receipt | observed in production |
| Deterministic evaluation | `npm run benchmark:router` | 39/39; 331 assertions |
| Full automated suite | `npm test` | 324 tests across 32 files |
| Security/MCP | `npm run test:security`, `npm run test:mcp` | 13 / 8 tests |
| Build quality | typecheck, lint, build, E2E, deploy check | pass |
| Responsive product | 360x800 through 3840x2160 | pass |
| Secret hygiene | [scan evidence](../audit/secret-scan-2026-08-03.md) | 0 matching files across pre-release history + release worktree |
| Live queue precision | Fresh packet `AE1EB62B`, GitHub + Slack receipts | one actionable row; known non-work artifact families absent |
| Large-PDF proof | [status and methodology](../docs/LARGE_PDF_PROOF.md) | fresh strict baseline: 20/22 cases; 53/56 facts; post-deploy rerun required |
| Demo | [canonical script](../docs/DEMO_SCRIPT_60S.md) | ready |
| Submission text | [canonical copy](../docs/SUBMISSION_COPY.md) | ready |

## Before final submission

- Publish the final commit and rerun live/PDF acceptance against that exact deployment.
- Make the private repository judge-accessible.
- Add the final video URL to `submission/form-answers.md`.
- Do not convert the 20/22 strict baseline into a 22/22 claim.
