# QueueProof submission copy

> [!IMPORTANT]
> Draft for the final evidence build. The measured production runtime is commit
> `aed027879150e3e324b54c5ec2194d4d715c501e` on `main`. The forthcoming package is the
> current main evidence build; verify its exact deployed identity through `/api/health/live`
> and `RELEASE_EVIDENCE.md`. The measurements below describe the measured runtime, not the
> evidence build, unless that build is deployed and the measurements are repeated. The
> repository is still private and the video URL is still pending.

## Ask your work. Get the proof.

QueueProof turns work scattered across GitHub, Linear, Slack, Gmail, and documents into one
cited answer and one evidence-backed Task brief. It preserves disagreements instead of
averaging them away, shows exactly which sources support each claim, and keeps every external
change behind human approval.

HydraDB is the evidence layer. QueueProof verifies connectors with attributable canary
records, retrieves exact identifiers through text and hybrid lanes, merges evidence without
collapsing unrelated entities, and records mode, provider coverage, calls, latency, relative
cost, and citations with the answer.

The same evidence contract is available in the web product and through MCP. In the UI the
modes are **Quick**, **Best**, and **Investigate**; their measured counterparts are forced
Fast, Auto, and Thinking/Deep check.

**Live product:** <https://queueproof.vercel.app>

**Method and boundaries:** <https://queueproof.vercel.app/method>

**Proof tests:** <https://queueproof.vercel.app/benchmarks>

**Repository:** <https://github.com/vaibhav4046/queueproof> — private until the publication
gate is completed.

**Video:** pending final recording and upload.

## Measured production evidence

All results in this section were generated against runtime
`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`.

| Run | Strict cases | Required facts | p50 / p95 | HydraDB calls / units | Result boundary |
| --- | ---: | ---: | ---: | ---: | --- |
| Best / Auto | 4/6 | 19/19 | 2,155 / 2,392 ms | 7 / 7 | All six queries resolved as Fast |
| Quick / forced Fast | 4/6 | 19/19 | 1,833 / 2,446 ms | 7 / 7 | Two provider-requirement rows remain REVIEW |
| Investigate / forced Thinking | 2/6 | 13/19 | 26,329 / 40,003 ms | 10 / 30 | One timeout; this run did not match Fast coverage |

The six-question benchmark is a diagnostic, not an SLA. A correct fact does not convert a
provider-coverage failure into a pass. REVIEW rows remain visible.

The deterministic 346-page PDF evaluation passed **21/22** core cases and recovered
**55/56** fact groups. It measured p50 **1,823 ms** and p95 **2,382 ms**, used **31 calls / 31
relative units**, and routed all 22 core questions through Fast. Beginning, middle, and end
canaries passed; **84/84 claims** were supported by **69 citations**.

The separate cross-source extension remains **REVIEW**. It found both required facts and
cited the document plus GitHub, but missed the rubric's additional non-document provider. It
measured **29,676 ms** and used **6 calls / 18 relative units**. It is not part of the 21/22
core denominator.

The checked-in deterministic router artifact records 39/39 labelled cases and 331
fixture-computable assertions. That measures planner and ranking behavior only; it is not a
live retrieval-accuracy claim.

## Product and safety boundary

The public URL is a shared, read-only evidence workspace. Visitors can ask questions, inspect
receipts, review Task briefs, and prepare proposals. Credential changes, connector control,
uploads, MCP token administration, approval, and external execution require a private owner.
An action counts as executed only after a provider response identifier is persisted.

Relative retrieval units are reported because no verified HydraDB dollar conversion is
available. No USD cost is invented.

## Final publication gates

- Record the committed current main evidence-build SHA in `RELEASE_EVIDENCE.md`.
- Complete the submitted-commit gates in [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md).
- Make the repository public and verify it from a signed-out browser.
- Add the public video URL.
- If the evidence build changes runtime behavior, deploy it and repeat every quoted
  production measurement before calling those metrics submitted-release evidence.
