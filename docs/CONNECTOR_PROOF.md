# Live connector proof

Last production verification: 3 August 2026. Target database: `queueproof-live`.

| Provider | HydraDB connector | State | Canary records | Retrieval eligible |
| --- | --- | --- | ---: | --- |
| GitHub | `Helios GitHub` | data verified | 1 | yes |
| Linear | `Helios Linear (live)` | data verified | 5 | yes |
| Slack | `Helios Slack` | data verified | 3 | yes |
| Gmail | `Helios Gmail` | data verified | 4 | yes |

An older Linear connector in `queueproof-demo` is degraded and is deliberately excluded. QueueProof does not convert connector creation into a success claim: proof requires resource scope, sync/cursor evidence, a canary query, retrieved source IDs, and a successful timestamp.

The flagship production question returned GitHub + Linear + Slack evidence in one HydraDB thinking call. Connector fingerprints, cursors, source IDs, selected resources, last sync, and failure reason are visible from Evidence → View proof; secrets are never rendered.

## Reproduce

```bash
npm run benchmark:live -- --url https://queueproof.vercel.app
```

See `evals/results/live-run.json` for the sanitized machine-readable receipt.
