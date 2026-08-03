# Live acceptance report (SUPERSEDED)

> **Historical record from 2026-07-31.** It states that no live connector run had happened,
> which was true then. HydraDB, document ingestion and the Linear connector have since been
> run live. See `BENCHMARK_REPORT.md` section 2 and
> `submission/requirements-matrix.md`.

Date: 2026-07-31

Status: **not run — external authorisation required**.

`scripts/live-acceptance.mjs` refuses to run unless `QUEUEPROOF_LIVE_TEST=true`, `QUEUEPROOF_URL`, and `HYDRA_DB_API_KEY` are set. The web product keeps its HydraDB credential encrypted per workspace; this script-only variable is not required for ordinary product use.

Deployment-only smoke proof is recorded separately in `deployment-verification.md`; it is not substituted for live connector acceptance.
