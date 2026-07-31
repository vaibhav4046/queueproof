# QueueProof requirements matrix

Truth labels: **local-pass** means an automated/local operation ran successfully; **implemented-unverified** means code exists but external proof is unavailable; **blocked-external** means credentials or authorisation are required. Blank demo timestamps are intentional until a real recording exists.

| Requirement | Implementation | Code location | UI location | Automated test | Live proof | Demo timestamp | Result | Limitation |
|---|---|---|---|---|---|---|---|---|
| Three working connectors | Dynamic adapter, lifecycle, canary verification | `packages/connectors`, `app/api/connectors` | Connectors | contract/MCP tests | None | — | blocked-external | Slack, Gmail, Linear credentials absent |
| Document ingestion | Hydra multipart contract researched; R2 binding reserved | `packages/hydradb`, `.openai/hosting.json` | — | — | None | — | partial | Upload API/UI not complete |
| Large PDF | Explicit guarded command | `scripts/generate-large-pdf.mjs` | — | guard behavior | None | — | partial | Generation/ingestion report incomplete |
| Cross-source entity resolution | Hydra graph/thinking query path | `app/api/query`, `packages/retrieval` | Ask | retrieval tests | None | — | implemented-unverified | Needs multi-provider data |
| Difficult questions | Planner with evidence trace | `packages/retrieval`, `app/api/query` | Ask | labelled fixtures | None | — | local-pass | Answer quality needs live eval |
| Temporal reasoning | Temporal classification, recency bias, graph context | `packages/retrieval` | Ask trace | retrieval tests | None | — | local-pass | Hydra results unavailable |
| Metadata filtering | Query contract/provider filters modelled | `packages/contracts` | Ask | contract tests | None | — | partial | Provider filters not passed through yet |
| Knowledge updates | Sync request plus cursor/canary proof | connector routes | Connectors | contract tests | None | — | implemented-unverified | Needs live provider |
| Third-party attribution | Provider/source/timestamp/URL extraction | `app/api/query` | Ask evidence | contract tests | None | — | local-pass | Depends on provider metadata |
| Actor queries | Query classification support | retrieval/query | Ask | fixtures | None | — | partial | No dedicated actor resolver |
| Thread understanding | Thinking + graph context | retrieval/query | Ask | fixtures | None | — | implemented-unverified | Needs real threads |
| Multilingual retrieval | Hydra query accepts Unicode | query route | Ask | — | None | — | implemented-unverified | No labelled multilingual live set |
| Multi-hop reasoning | Thinking + forceful relations | query route | Ask trace | retrieval tests | None | — | implemented-unverified | Needs live graph |
| Fast versus thinking | Deterministic planner | `packages/retrieval` | Ask trace | retrieval tests | None | — | local-pass | Live latency not measured |
| Accuracy | Labelled routing suite | `evals/fixtures` | Evaluations shell | 32 fixtures | None | — | partial | Routing accuracy only |
| Latency | Hydra/end-to-end timing | query route | Ask trace | — | None | — | implemented-unverified | No hosted measurements |
| HydraDB calls | Per-run call count/request ID | query/audit | Ask trace | — | None | — | implemented-unverified | No credential |
| Cost estimate | Schema reserved | `db/schema.ts` | Evaluations | — | None | — | partial | Provider pricing unavailable |
| Reproducibility | pins, migration, fixture gate, commands | repo root | — | 67 tests | Local | — | local-pass | hosted proof pending |
| Developer experience | pnpm/Make/doctor/docs/CLI | repo root, `cli` | Agent Dock shell | CLI config tests | Local | — | local-pass | Windows path warning documented |
| 60-second demonstration | script and shot list | `submission` | all principal screens | — | None | — | blocked-external | real source data and recording required |
