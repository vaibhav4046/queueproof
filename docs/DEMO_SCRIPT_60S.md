# QueueProof 60-second working demo

Use <https://queueproof.vercel.app/> only after
`/api/health/live` reports runtime A
`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`. Run the query live in the take; do
not substitute a fixture or a stored replay.

## 0–8 seconds — Ask

**Screen:** Show the four ready sources in **Ask**. Submit:
“Who escalated the AuthShield outage, what did engineering commit to, and is the fix already
merged?”

**Say:**

> QueueProof answers one work question across four connected sources. This is a live
> multi-source query, not a fixture.

## 8–22 seconds — Grounded answer

**Screen:** Point to the answer, GitHub/Linear/Slack coverage, preserved disagreement, selected
mode, calls, and latency.

**Say:**

> It joins the escalation, engineering commitment, and merge state, while keeping the source
> disagreement visible. The mode, providers, calls, and latency are recorded beside the answer.

## 22–31 seconds — Receipt

**Screen:** Open one numbered citation, show its provider, timestamp, excerpt, source ID, and
original link.

**Say:**

> Every supported claim opens to its retained source receipt, so the answer can be checked
> immediately.

## 31–41 seconds — Sources

**Screen:** Open **Sources**. Show GitHub, Gmail, Linear, Slack, and the 346-page document
provenance.

**Say:**

> Sources are marked ready only after real records are proven. Large documents keep their
> source ID, checksum, and retrieval history.

## 41–53 seconds — Proof tests

**Screen:** Open **Proof tests**. Hold on the strict denominators and visible REVIEW rows.

**Say:**

> On this release, Auto recovered all nineteen required facts, passed four of six strict cases,
> used seven calls, and had a 2.155-second median. The PDF core passed twenty-one of twenty-two.
> Failures and the Thinking timeout stay visible.

## 53–60 seconds — Connect AI

**Screen:** Open **Connect AI** and show the Codex/Claude MCP configuration and approval
boundary.

**Say:**

> The same evidence works through MCP in Codex or Claude. Reads reuse the receipts; external
> writes still require approval.

## Recording gates

- Confirm `/api/health/live` reports runtime A's exact SHA and `main`.
- Confirm the UI shows four source-ready connectors before recording.
- Run the flagship query live and narrate only fields visible in the result.
- Open a citation whose original-source link resolves.
- Keep the strict 4/6 Auto result, 21/22 PDF result, and Thinking timeout visible.
- Do not call weighted units dollars or the six-query sample an SLA.
- Do not use **Today**; this script depends only on guaranteed judge-facing content.
- Repository status is **PRIVATE** and the video URL is **PENDING** until the final submission
  steps are completed.

## Exact on-screen reference

| Measurement | Runtime-A result |
| --- | --- |
| Auto | 4/6 cases; 19/19 facts; 2,155/2,392 ms p50/p95; 7 calls/7 units; all Fast |
| Forced Fast | 4/6 cases; 19/19 facts; 1,833/2,446 ms; 7 calls/7 units |
| Forced Thinking | 2/6 cases; 13/19 facts; 26,329/40,003 ms; 10 calls/30 units; one timeout |
| 346-page PDF core | 21/22 cases; 55/56 facts; 84/84 claims; 69 citations; 1,823/2,382 ms |
