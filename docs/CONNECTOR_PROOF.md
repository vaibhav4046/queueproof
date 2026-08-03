# Live connector proof

Last observed production verification: 3 August 2026

Canonical target: <https://queueproof.vercel.app>

HydraDB database: `queueproof-live`

| Provider | Connector | State | Canary records | Retrieval eligible |
| --- | --- | --- | ---: | --- |
| GitHub | `Helios GitHub` | `data_verified` | 1 | yes |
| Gmail | `Helios Gmail` | `data_verified` | 4 | yes |
| Linear | `Helios Linear (live)` | `data_verified` | 5 | yes |
| Slack | `Helios Slack` | `data_verified` | 3 | yes |

This table describes the last observed shared production workspace. It is not a guarantee
that a third-party service will always be available.

## What `data_verified` means

QueueProof does not equate a saved credential or created connector with usable data. A
verification receipt requires:

- a HydraDB connector ID and selected resource scope;
- sync or cursor evidence;
- a canary query;
- one or more returned source IDs attributable to that connector/resource lineage;
- provider coverage, timestamp, and any failure reason.

An older degraded connector can remain in storage without entering retrieval. The current
build rejects provider-name-only attribution: a source must match the expected connector
ID or one of its selected resource IDs. Uploaded documents must match their exact HydraDB
source ID.

## Flagship observation

The production question below returned cited GitHub, Linear, and Slack evidence in one
HydraDB thinking query:

> Who escalated the AuthShield outage, what did engineering commit to, and is the fix
> already merged?

The answer surfaced the escalation, engineering commitment, and merge state while
preserving a tracked-state disagreement. The receipt exposed the routing reason, source
IDs, provider coverage, call count, and elapsed time.

## Public sandbox behavior

Public visitors can inspect these receipts and ask questions against shared evidence.
They cannot change credentials, connectors, databases, uploads, MCP tokens, or external
provider state. Private operators can reproduce connector lifecycle operations after
sign-in.

## Reproduce a live question run

```bash
npm run benchmark:live -- --url https://queueproof.vercel.app
```

The stored live sample is reported separately in `BENCHMARK_REPORT.md`. Live results must
never be inferred from offline fixtures.
