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

## Fresh strict public-production baseline

`evals/results/pdf-live-run.json` was generated on 4 August 2026 against
`https://queueproof.vercel.app` with `grounded-grader-v2`:

- 20/22 cases passed;
- 53/56 required facts recovered (94.64%);
- beginning, middle, and end canaries passed;
- citation precision and completeness were both 100%;
- unsupported-claim rate was 0%;
- p50/p95 request latency was 2,592/17,061 ms; and
- median/mean HydraDB calls were 2/1.82.

The REVIEW cases were the original superseded-policy question (4/5 facts) and the draft
distractor question (3/5 facts). The cross-source extension recovered its two document
facts and cited GitHub, but missed the required second non-document provider. This run is
a post-deploy result against the final judge release; its misses are accepted limitations,
not hidden successes.

## Historical production artifact

`audit/pdf-live-final.json` retains the earlier strict baseline for provenance. The
canonical submission result is the newer `evals/results/pdf-live-run.json` artifact above.
Neither artifact supports a 21/22 or 22/22 claim under the final strict grader.

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

## Reproduce the release measurement

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
