# QueueProof social posts

> [!IMPORTANT]
> Drafts for the current main evidence build, whose exact deployed identity must be verified
> through `/api/health/live`. The quoted measurements belong to production runtime
> `aed027879150e3e324b54c5ec2194d4d715c501e` on `main`. Publish only after the repository
> is public, signed-out access is verified, the final video is live, and
> [`RELEASE_EVIDENCE.md`](../RELEASE_EVIDENCE.md) records the evidence-build gates.

## LinkedIn

**Ask your work. Get the proof.**

QueueProof uses HydraDB to turn fragmented work across GitHub, Linear, Slack, Gmail, and
documents into one cited answer and one evidence-backed Task brief.

Every supported claim opens to a source receipt. Disagreements stay visible. Every proposed
external change remains behind human approval. The same evidence contract is available in
the web product and through MCP.

Measured on production runtime `aed02787`:

- Best/Auto: 4/6 strict cases, 19/19 facts, 2.155 s p50, 7 calls.
- Quick/Fast: 4/6 strict cases, 19/19 facts, 1.833 s p50, 7 calls.
- Investigate/Thinking: 2/6 strict cases, 13/19 facts, 26.329 s p50, 10 calls, with one timeout.
- 346-page PDF core: 21/22 cases, 55/56 facts, 84/84 supported claims, 69 citations, and all
  beginning/middle/end canaries passed.

The failed rows stay REVIEW. The separate PDF cross-source extension found both facts and
the document plus GitHub, but missed one additional non-document provider.

<https://queueproof.vercel.app>

#HydraDB #AIAgents #RAG #DeveloperTools #AISafety

## X / Twitter

Ask your work. Get the proof.

QueueProof turns HydraDB evidence into a cited answer + Task brief, preserves conflicts, and
keeps writes behind human approval.

Measured runtime `aed02787`: Quick 4/6 + 19/19 facts at 1.833 s p50. 346-page PDF: 21/22,
55/56 facts, 84/84 supported claims. REVIEW stays visible.

<https://queueproof.vercel.app>

## Demo/video caption

One real question across work systems. Every supported claim opens to a receipt. QueueProof
then turns the same evidence into a Task brief, while every external change waits for human
approval.

Ask your work. Get the proof.

## Accuracy note

The production measurements above describe runtime `aed02787`, not the forthcoming evidence
build unless the latter is deployed and rerun. The six-query sample is not an SLA. Relative
units are not dollars. The PDF core is 21/22 and 55/56; the separate cross-source extension
remains REVIEW.
