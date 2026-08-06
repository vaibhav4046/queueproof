# QueueProof 60-second demo script

Record the canonical production deployment. Run the question live; do not use a replay or quote a
historical metric.

## 0–7 seconds — the problem

**Screen:** Ask landing page and live composer.

**Say:**

> Work evidence is split across tickets, code, messages, email, and documents. QueueProof turns it
> into one answer you can inspect.

## 7–22 seconds — ask across sources

**Screen:** Submit the AuthShield question in Auto/Best mode:

> Who escalated the AuthShield outage, what did engineering commit to, and is the fix already
> merged?

**Say:**

> This is a live HydraDB retrieval. QueueProof reconstructs the actor, commitment, and current
> state, while keeping disagreement and missing proof visible.

## 22–34 seconds — open the proof

**Screen:** Show provider coverage, mode, calls, and latency; open one numbered citation.

**Say:**

> Each supported claim opens to a retained source receipt with its provider, timestamp, excerpt,
> identifier, and original link.

## 34–43 seconds — verify sources

**Screen:** Open **Sources**. Show three or more current ready connector receipts and the document
checksum/source ID. Leave degraded rows visible.

**Say:**

> A source counts only after attributable records are proven. A saved credential or degraded
> connector is not called healthy.

## 43–54 seconds — show measured tradeoffs

**Screen:** Open **Proof tests**. Point to the production SHA, Auto/Fast/Thinking rows, one
`REVIEW`, and the 346-page PDF result.

**Say:**

> These exact-release tests report strict passes, fact coverage, latency, HydraDB calls, and
> relative query work. Failed requirements remain REVIEW.

If mode comparison is not comparable, say: “This release is awaiting a comparable Fast and
Thinking pair.” Do not quote a delta.

## 54–60 seconds — close on safe reuse

**Screen:** Open **Connect AI** and show endpoint/scopes without displaying a key.

**Say:**

> The same evidence contract is available over MCP. Reads are scoped; external changes stay behind
> owner approval.

Only name Claude or Codex as connected after an authenticated production tool-call receipt exists.
