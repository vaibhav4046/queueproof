# Large-PDF proof status

## Deterministic document

| Property | Value |
| --- | --- |
| File | `helios-operations-handbook.pdf` |
| Pages | 346 |
| Bytes | 958,096 |
| SHA-256 | `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93` |
| Labelled questions | 22 |
| Explicit required-fact groups | 56 |
| QueueProof document ID | `doc_44fe0aac-ea45-481f-91bf-66b5ba7b4fe9` |
| HydraDB source ID | `f64d374d1899f3057707528f77703f3f` |
| Database | `queueproof-live` |

The generator places load-bearing facts near the beginning, middle, and end, and also
covers tables, exact IDs, superseded policies, close-name entities, multilingual context,
distractors, and a document-plus-connector join. Generation checks validate PDF structure,
fact placement, object references, and xref offsets.

## Historical production artifact - not a current score

`evals/results/pdf-live-run.json` is retained for provenance. It was generated on
3 August 2026 and reports 21/22 under `legacy-token-recall-v1`, with its
cross-source case failing. The old canary summary also used an incorrect end-canary key.

That artifact is **not comparable** with the current strict grader and must not be quoted
as a fresh release result. It is evidence that the production flow ran, not evidence that
the hardened release passes 21/22 or 22/22.

## Current strict acceptance contract

The current grader version is `grounded-grader-v2`.

Every one of the 22 cases now declares explicit required facts. A case passes only when:

1. every required fact is present in the answer;
2. every required provider is backed by a supporting cited claim;
3. every claim citation ID resolves;
4. the cited excerpt contains the normalized claim text and matches the claim provider;
5. citation precision and completeness are both 1.0, with no unsupported claim;
6. a required contradiction is backed by at least two resolved cited providers; and
7. document cases carry the expected document evidence.

The canary map now uses `beginning_load_bearing`, `middle_load_bearing`, and
`end_load_bearing` explicitly.

## Reproduce after release authorization

```bash
npm run generate:large-pdf
npm run benchmark:pdf -- --url https://queueproof.vercel.app
```

The production command sends 22 labelled synthetic questions and a known synthetic
document source ID to the live deployment. Run it only with explicit authorization. The
runner exits non-zero on any required-fact, provider, citation, contradiction, canary, or
cross-source failure.

HydraDB ingestion is asynchronous. QueueProof reports `processing` until the status
endpoint reaches a terminal completed state. The UI's 25 MB intake cap is QueueProof's
conservative limit, not a claimed HydraDB universal maximum.
