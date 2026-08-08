# QueueProof submission form answers

> [!IMPORTANT]
> Benchmark values below were measured against production release
> `24d942e4d5281db58e352c9fed14ac8fcb2aba8d`; every artifact carries `releaseVerified: true`
> and grader `grounded-grader-v3`. The deployed release always republishes same-SHA artifacts:
> read the current values from <https://queueproof.vercel.app/benchmarks> and compare its SHA
> with `/api/health/live` before quoting anything.

## Product name

QueueProof

## One-line description

QueueProof turns HydraDB evidence from work systems and documents into one cited answer and one
evidence-backed Task brief, while keeping external changes behind human approval.

## Product thesis

Ask your work. Get the proof.

## Live URL

<https://queueproof.vercel.app>

## Measured release

`24d942e4d5281db58e352c9fed14ac8fcb2aba8d` on `main` — verify the currently deployed SHA at
`/api/health/live` and the artifact binding at `/api/lab`.

## Repository URL

<https://github.com/vaibhav4046/queueproof> — public.

## Video URL

<https://youtu.be/prKT-PC7NYw>
(Final 59.5 s cut committed at `video/queueproof-demo-v2.mp4`, −15.0 LUFS / −1.3 dBTP,
transcript verified against the locked script.)

## What problem does it solve?

Work evidence is split across tickets, code, messages, email, and documents. Search returns
fragments, but a teammate or agent still needs to know what happened, which sources disagree,
and what deserves attention next. QueueProof produces an inspectable chain from verified
source, to cited claim, to Task brief, to an approval-safe proposal.

## How does it use HydraDB?

HydraDB is QueueProof's evidence layer. QueueProof scopes connectors, waits for sync, verifies
them with attributable canary records, retrieves in Fast or Thinking mode, and ingests
documents. Exact identifiers use text and hybrid lanes; the evidence is merged without
collapsing unrelated IDs.

Each receipt stores requested and actual mode, retrieval lanes, request IDs, providers, calls,
latency, relative cost, and citations. In the product UI, forced Fast is **Quick**, Auto is
**Best**, and Thinking is **Investigate / Deep check**.

The public workspace shows four verified sources — GitHub, Gmail, Linear, and Slack. A fifth
degraded Linear connector is excluded from the count rather than hidden.

## Production mode comparison

Measured against release `24d942e4d5281db58e352c9fed14ac8fcb2aba8d` on 2026-08-08; eight
frozen questions per mode; no timeouts in any run.

| Product / measured mode | Strict cases | Required facts | p50 | p95 | Calls | Relative units | Boundary |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Best / Auto | 7/8 | 25/25 | 2,084 ms | 4,451 ms | 10 | 10 | All eight resolved as Fast |
| Quick / forced Fast | 7/8 | 25/25 | 1,907 ms | 3,315 ms | 10 | 10 | One REVIEW row (below) |
| Investigate / forced Thinking | 7/8 | 25/25 | 8,766 ms | 16,886 ms | 18 | 34 | Same passes for 4.6x p50 and 3.4x units |

The one non-pass row is identical in all three modes: `post-mortem attribution cross-check`
returns `REVIEW`. It recovers 3/3 required facts with citation precision and completeness 1.0
and zero unsupported claims; it fails strict relevance alone (0.667). Fast and Thinking are
comparable in this run, and Thinking lost: identical strict passes and fact recall for 4.6x
the p50 latency and 3.4x the weighted units. Reported as measured. This benchmark is a
diagnostic, not an SLA.

## What is technically distinctive?

**Receipts are the contract.** Each supported claim resolves to source evidence, and each
Task brief exposes score math, constraints, permissions, missing information, and a receipt
hash.

**Routing is measurable.** Quick/Fast, Best/Auto, and Investigate/Thinking expose accuracy,
latency, calls, relative units, and actual routing behavior rather than hiding them behind one
quality label.

**Lineage fails closed.** Provider labels alone do not prove connector origin. Connector and
document evidence must carry attributable lineage.

**Priority is compiled.** Conflict-aware clustering keeps unrelated identifiers separate,
then a versioned ranking policy produces the Task brief.

**Writes have a database boundary.** An external action requires an exact proposal, explicit
approval, and a unique execution claim before provider I/O.

## Large-PDF evidence

QueueProof generated and indexed a deterministic 346-page PDF with 22 core questions and 56
fact groups spanning the beginning, middle, and end of the document.

The measured core run recovered **56/56 required facts** with citation precision and claim
support **1.0**, at p50 **1,570 ms** and p95 **2,096 ms**, using **29 calls / 29 relative
units**, all 22 questions routed Fast, with `exactIdPass` and `documentReceipt` true on every
row. Under strict grading it passed **5/22 cases**: 17 rows return `REVIEW` because synthesis
splits handbook table rows into independent claim units and the resulting ASCII-table
fragments carry no expected-fact signal — mean relevance across the 17 non-pass rows is
0.534. Retuning that splitter was declined at release time: it would risk a green production
release to improve a grading artifact, not correctness. Both numbers (5/22 and 56/56) are
true and are shown together.

The separate document-plus-connectors cross-source extension also remains **REVIEW**: it
recovers its required facts from the document plus GitHub, but fails the provider requirement
(one additional non-document provider missing — Linear and Slack appear in the answer without
supporting citations) as well as strict relevance. It is reported separately from the 22-case
core denominator.

## MCP integration

Receipt at `24d942e`, 2026-08-08T03:18:28.661Z, public no-auth reviewer endpoint
`https://queueproof.vercel.app/mcp/demo`: `initialize` negotiated protocol `2025-06-18`
(server `queueproof 0.2.0`), `tools/list` returned `queueproof_search`, and a read-only
`tools/call` returned `validation.status "grounded"` with providers linear/github/slack,
4 claims / 4 cited / 4 evidence items, one contradiction preserved, `missingInformation []`,
4,209 ms server-side, 1 retrieval call, 3 weighted units. The bearer-protected `/mcp`
endpoint returns `401` with RFC 9728 `WWW-Authenticate` resource metadata.

## Reproducibility

- Measured release: `24d942e4d5281db58e352c9fed14ac8fcb2aba8d`; verify the deployed SHA at
  `/api/health/live` and compare with `/api/lab` before quoting values.
- CI at that release: typecheck, lint, and build pass; 74 test files / 654 tests pass;
  deterministic router fixture passes all 353 assertions (fixture-computable, not a live
  accuracy claim); secret scan reports zero candidate blobs.
- Commands: `pnpm typecheck && pnpm lint && pnpm test && pnpm benchmark:router && pnpm build`,
  then `pnpm benchmark:live -- --url https://queueproof.vercel.app --mode auto|fast|thinking`
  and `pnpm benchmark:pdf -- --url https://queueproof.vercel.app`.

## How is the public product safe?

The public URL is a shared evidence workspace. Visitors can inspect receipts, ask bounded
questions, review Task briefs, and prepare proposals. Server-side guards deny credential
changes, connector lifecycle changes, uploads, MCP token administration, approval, and
external execution.

Owner sessions use signed `httpOnly` cookies. Provider credentials are encrypted. MCP bearer
values are hashed, scoped, expiring, revocable, and audience restricted.

## Honest limitations

- The eight-query benchmark is not an SLA or a general accuracy estimate.
- Strict grading is unforgiving on purpose: a `REVIEW` row is a failure even with perfect fact
  recall, which is why the PDF core reads 5/22 next to 56/56 facts.
- Thinking matched Fast's passes at 4.6x the latency and 3.4x the units in this run.
- The PDF cross-source extension remains REVIEW (missing provider requirement plus strict
  relevance) despite recovering its required facts.
- Relative units are not HydraDB dollars.
- A provider write is not called executed without a stored provider response ID.
- Video and social URLs are still pending owner upload.

## Hackathon form quick answers

**Did you try ingesting huge PDFs?** Yes. QueueProof indexed a deterministic 346-page PDF and
evaluated 22 core questions across 56 fact groups. The measured run recovered 56/56 required
facts with citation precision 1.0 at p50 1,570 ms, and passed 5/22 under strict grading — the
17 REVIEW rows fail relevance because of a claim-splitting artifact, not missing facts. The
separate document-plus-connectors extension remains REVIEW on a missing provider requirement.
Both failure modes are published, not hidden.

**Did you use at least three connectors?** Yes. The public workspace shows four verified
sources: GitHub, Gmail, Linear, and Slack — each verified with attributable canary records
before counting. A fifth degraded Linear connector is excluded from the denominator. The
measured runs retrieved cited cross-source evidence.

**Video demo:** <https://youtu.be/prKT-PC7NYw>

**GitHub submission:** <https://github.com/vaibhav4046/queueproof> — public.

**LinkedIn:** `[PENDING — ADD FINAL LINKEDIN POST URL]`

**Twitter/X:** `[PENDING — ADD FINAL X/TWITTER POST URL]`
