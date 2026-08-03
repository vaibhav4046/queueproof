# Evaluation methodology

## Dataset

`evals/fixtures/cases.json` contains 39 deterministic, labelled Helios Robotics questions. Dimensions overlap deliberately:

- 16 multi-hop/thread/attribution/priority reasoning cases
- 7 temporal, update, or conflict cases
- 6 contradiction, stale-state, or counterfactual cases
- 5 entity/actor deduplication cases
- 6 exact-ID or metadata-filter cases
- at least 5 document/PDF cases

Each case locks the question, expected fast/thinking mode, routing category, required providers, and—where applicable—expected priority order. The runner invokes the production router, ranking function, and Zod contracts directly. It does not score a copied answer key.

## Metrics

- Router agreement: predicted mode versus human-labelled expected mode.
- Required-fact recall: expected signals found in answer text only.
- Citation completeness: claims with at least one receipt divided by all claims.
- Unsupported-claim rate: uncited claims divided by all claims.
- Provider coverage, HydraDB call count, routing mode, weighted cost units, p50 and p95 latency.
- Priority accuracy: observed top item versus labelled top task, with determinism and 0–100 bounds checked.

Fixture and live metrics are never merged. Anything needing live sources is written as `not measured` offline. The showcase runner has six stable production questions; the broader 39-case suite is the reproducible deterministic ground truth.

## Commands

```bash
npm run benchmark
npm run benchmark:live -- --url https://queueproof.vercel.app
npm run benchmark:pdf -- --url https://queueproof.vercel.app
```

Artifacts are JSON, CSV, and Markdown under `evals/results/` and `BENCHMARK_REPORT.md`.
