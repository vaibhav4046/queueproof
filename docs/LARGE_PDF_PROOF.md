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

The generator places load-bearing facts near the beginning, middle, and end. It also covers
tables, exact IDs, superseded policies, close-name entities, multilingual context, distractors,
and a document-plus-connector join. Generation checks validate PDF structure, fact placement,
object references, and xref offsets.

## Current-release result

The authoritative result is `results.pdf` from
[`/api/lab`](https://queueproof.vercel.app/api/lab), not a number copied into this file.

Quote PDF pass counts, fact recall, citation quality, canaries, latency, calls, or weighted units
only when:

1. `/api/health/live` identifies a production commit;
2. `/api/lab.results.currentRelease.commitSha` matches that commit;
3. `results.pdf.status` is `measured`; and
4. the artifact identifies the same release and contains non-empty rows.

When the endpoint says `awaiting_current_release_measurement`, the submitted release has no
publishable PDF score yet. Checked-in older JSON remains provenance only.

The document-plus-connectors extension is reported separately from the 22 core questions. It
must satisfy its own required-fact and provider thresholds and must remain `REVIEW` if either
threshold fails.

## Strict acceptance contract

The current grader is `grounded-grader-v2`. Every core case declares explicit required facts.
A case passes only when:

1. every required fact is present;
2. every required provider is backed by a supporting cited claim;
3. every claim citation ID resolves;
4. the cited excerpt supports the normalized claim and matches the claim provider;
5. citation precision and completeness are both 1.0, with no unsupported claim;
6. a required contradiction is backed by at least two resolved cited providers; and
7. the row carries the expected document evidence.

The canary map uses `beginning_load_bearing`, `middle_load_bearing`, and
`end_load_bearing` explicitly.

## Reproduce the measurement

```bash
pnpm run generate:large-pdf
pnpm run benchmark:pdf -- --url https://queueproof.vercel.app
```

The production command sends the labelled synthetic questions and the known synthetic document
source ID to the live deployment. Run it only with explicit authorization. The runner exits
non-zero on required-fact, provider, citation, contradiction, canary, or cross-source failure.

HydraDB ingestion is asynchronous. QueueProof reports `processing` until the status endpoint
reaches a terminal completed state. The UI's 25 MB intake cap is QueueProof's conservative
limit, not a claimed HydraDB universal maximum.
