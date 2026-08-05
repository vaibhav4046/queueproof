# QueueProof 60-second working demo

Record the canonical deployment at <https://queueproof.vercel.app>. Run the question live in
the take; do not substitute a replay or fixture.

## Before recording

1. Open `/api/health/live`; confirm `status` is `live`, the target is `production`, and copy the
   short form of the running commit SHA into your recording notes.
2. Open `/api/lab`; confirm `results.currentRelease.commitSha` matches the health SHA.
3. Confirm the live and PDF sections say `measured`, and quote a Fast/Thinking comparison only
   if `results.modeComparison.comparable` is `true`.
4. Confirm **Sources** shows at least three ready providers with attributable records.
5. Confirm the citation you will open has a working original-source link.

If any check fails, fix or rerun that release before recording. Never borrow a result from an
older SHA.

## 0–8 seconds — Ask the work

**Screen:** In **Ask**, submit:

> Who escalated the AuthShield outage, what did engineering commit to, and is the fix already
> merged?

**Say:**

> QueueProof is the evidence workspace for daily work. I ask one question across the tools my
> team already uses; this request is running live.

## 8–21 seconds — Read the decision

**Screen:** Show the cited answer. Point to provider coverage, preserved disagreement, mode,
HydraDB calls, and latency.

**Say:**

> It reconstructs the escalation, commitment, and merge state across sources. It does not hide
> disagreement, and it records how the answer was retrieved.

## 21–30 seconds — Open the proof

**Screen:** Open one numbered citation. Hold on the provider, timestamp, excerpt, receipt ID,
and original link.

**Say:**

> Every supported claim opens to the retained source receipt, so a teammate can verify it in
> seconds.

## 30–39 seconds — Show source trust

**Screen:** Open **Sources**. Show the ready provider receipts and the 346-page document's
checksum and HydraDB source ID. Leave any degraded source visible.

**Say:**

> A source becomes ready only after real records are proven. Documents keep their identity and
> ingestion provenance; degraded sources are never counted as healthy.

## 39–52 seconds — Show measured proof tests

**Screen:** Open **Proof tests**. Read the exact current-release Fast and Thinking pass counts,
fact recall, median latency, calls, and units shown on screen. Point to one `REVIEW` row and the
large-PDF result.

**Say:**

> These values are bound to the running release. Fast and Thinking use the same frozen cases,
> and strict failures stay REVIEW instead of being rounded into passes.

If mode comparison is not marked comparable, say: “This release is awaiting a comparable mode
pair,” and do not quote a delta.

## 52–60 seconds — Connect the daily workflow

**Screen:** Open **Connect AI**. Show the MCP endpoint, client configuration, and approval
boundary.

**Say:**

> The same evidence contract can be used from an MCP client. Reads reuse the receipts; proposed
> external changes stay owner-only and require approval.

Claim a named client as working only if you completed an authenticated smoke test against this
deployment.

## Recording checklist

- Narrate only values visible on the deployed release.
- Keep `REVIEW`, timeouts, missing providers, and degraded connectors visible.
- Do not call weighted units dollars or the small live suite an SLA.
- Do not expose tokens, owner pages, email addresses, or connector credentials.
- Repository publication is **PENDING** until signed-out access succeeds.
- Video URL is **PENDING** until the final take is uploaded publicly.
