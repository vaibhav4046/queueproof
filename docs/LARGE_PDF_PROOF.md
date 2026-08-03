# Large-PDF proof

QueueProof generated a deterministic, adversarial operations handbook and sent it through the real production upload flow.

| Property | Value |
| --- | --- |
| File | `helios-operations-handbook.pdf` |
| Pages | 346 |
| Bytes | 958,096 |
| SHA-256 | `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93` |
| Planted facts | 22 across 13 retrieval kinds |
| QueueProof document ID | `doc_44fe0aac-ea45-481f-91bf-66b5ba7b4fe9` |
| HydraDB source ID | `f64d374d1899f3057707528f77703f3f` |
| Database | `queueproof-live` |

The generation verifier ran 78 checks across the PDF structure, facts, page placement, object references, and xref offsets. Load-bearing facts sit near page 3, page 160, and the ending section; other cases cover tables, aliases, exact IDs, superseded policies, close-name entities, Hindi context, and cross-source joins.

HydraDB accepted the upload at `2026-08-03T06:55:47Z`. The last observed real status was `graph_creation`; QueueProof correctly kept the document at `processing` instead of reporting a false success. Terminal canary results must only be added after HydraDB reports `completed`.

## Reproduce after terminal indexing

```bash
npm run benchmark:pdf -- --url https://queueproof.vercel.app
```

The runner measures all 22 labelled facts, beginning/middle/end canaries, answer-only fact recall, document citation presence, latency, calls, and one PDF + connector multi-hop question. It exits non-zero on any review result.

HydraDB's public documentation describes asynchronous ingestion and the context-status lifecycle. It does not publish a universal byte-size limit; `25 MB` in the UI is QueueProof's conservative intake cap, not a claimed HydraDB maximum.
