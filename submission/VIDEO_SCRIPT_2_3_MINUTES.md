# QueueProof two-to-three-minute demo voiceover

Target runtime: **2:35–2:50** at a calm 130–140 words per minute. Record the numbered sections in
one take, with a short silent pause between them. The matching capture and audio plan is
[VIDEO_VOICE_SEGMENTS.md](VIDEO_VOICE_SEGMENTS.md).

This is a release-relative script. Fill the bracketed benchmark values only after the deployed
SHA and measured artifacts pass the gates in [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md). Record section 7
only after ChatGPT completes a real OAuth connection and a read-only QueueProof tool call against
that deployment. A configuration screen or anonymous rejection is not enough.

## 1 · 0:00–0:16 — the decision problem

**Screen:** QueueProof **Ask** at the canonical production URL.

> Work decisions are scattered across code, tickets, messages, email, and documents. QueueProof
> turns that fragmented context into one answer with evidence attached, then builds a reviewable
> next action. This is the live release, not a replay.

## 2 · 0:16–0:38 — prove the sources

**Screen:** **Sources** with at least three current `data_verified` connector receipts and the
document receipt. Name only the providers that pass this preflight.

> QueueProof does not count a saved credential as a working connector. GitHub, Linear, and Slack
> appear here only after a HydraDB canary returns attributable records. The document receipt keeps
> its page count, checksum, and HydraDB source identity.

## 3 · 0:38–1:05 — run the difficult question

**Screen:** Return to **Ask**, choose **Best**, and submit the question live once.

> I’ll ask one difficult, multi-hop question: Who escalated the AuthShield outage, what did
> engineering commit to, and is the fix already merged? QueueProof must recover the actor, the
> commitment, and the latest code state across sources. It selects the smallest sufficient search,
> validates source lineage, and preserves disagreement instead of blending it into a confident
> guess.

## 4 · 1:05–1:23 — open the proof

**Screen:** Hold on the completed answer, then open one numbered citation receipt.

> Each numbered claim opens to a retained receipt with provider, timestamp, source ID, excerpt,
> and original link. A badge alone is not proof. If a requested facet or provider is missing, the
> answer stays partial and the strict test stays REVIEW.

## 5 · 1:23–1:41 — document ingestion

**Screen:** Show the 346-page handbook card and its current measured PDF result.

> Document ingestion uses the same evidence contract. This 346-page handbook is tested at the
> beginning, middle, and end, including exact identifiers, tables, multilingual text, superseded
> policy, and distractors. The document-plus-connectors question is scored separately.

## 6 · 1:41–2:07 — speed, accuracy, and work

**Screen:** **Proof tests**. Keep the exact production SHA and current-result badge visible.

> Proof tests are bound to the production commit shown here. On this release, Quick passes
> [QUICK PASS/CASES] on the Fast route, Investigate [INVESTIGATE PASS/CASES] on the Thinking
> route, and the PDF core [PDF PASS/CASES]. Quick measured [QUICK P50] median latency versus
> [INVESTIGATE P50] for Investigate. Calls and weighted units expose retrieval work; units are not
> dollars, and this small sample is not an SLA. The exact replay command is published beside the
> receipt.

Use that comparison only when the page says **Measured**. Otherwise replace its second and third
sentences with:

> This release does not have a comparable Quick-versus-Investigate pair, so QueueProof says so
> instead of borrowing an older result. Calls and weighted units expose retrieval work; units are
> not dollars, and this small sample is not an SLA. The exact replay command is published beside
> the receipt.

## 7 · 2:07–2:36 — ChatGPT custom MCP app

**Screen:** A clean ChatGPT window with the sidebar already hidden. Submit the sanitized prompt
from the shot plan and show the QueueProof tool invocation plus its cited answer.

> Now I’m in ChatGPT with QueueProof connected as a custom MCP app. I ask for the same evidence,
> ChatGPT invokes a real read-only QueueProof tool, and the response returns workspace-bound
> receipts. The connection is scoped and revocable. It has no tool that can approve or execute a
> provider write.

## 8 · 2:36–2:47 — close

**Screen:** End on the QueueProof answer and its visible source chips.

> That is QueueProof: three-plus proven connectors, document ingestion, difficult retrieval,
> measured mode tradeoffs, and MCP access, with the evidence and safety boundary visible at every
> step.
