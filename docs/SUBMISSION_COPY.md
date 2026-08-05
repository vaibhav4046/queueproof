# QueueProof submission copy

> [!IMPORTANT]
> This copy is release-relative. Immediately before submission, verify the running SHA with
> `/api/health/live` and copy measurements only from the matching `/api/lab` or **Proof tests**
> response. Repository publication and the video URL are still **PENDING**.

## Ask your work. Get the proof.

QueueProof is a daily evidence workspace for work scattered across GitHub, Linear, Slack,
Gmail, and documents. Ask one plain-language question and get a concise answer whose claims
open to retained source receipts. QueueProof preserves conflicting source states, makes missing
evidence explicit, and turns the result into a reviewable next-action brief.

HydraDB is the cross-source evidence layer. QueueProof verifies connectors with attributable
records, retrieves exact identifiers through lexical and hybrid lanes, merges evidence without
collapsing unrelated entities, and records the selected mode, provider coverage, calls,
latency, weighted query units, and citations with every answer.

The same read contract is exposed through MCP so an AI client can use the product as part of a
daily workflow. Credentials, connector control, document upload, proposal history, approvals,
token administration, and external execution remain owner-only. Writes require explicit
approval and count as executed only after a provider response ID is stored.

**Live product:** <https://queueproof.vercel.app>

**Method:** <https://queueproof.vercel.app/method>

**Proof tests:** <https://queueproof.vercel.app/benchmarks>

**Repository:** <https://github.com/vaibhav4046/queueproof> — **PUBLICATION PENDING**

**Video:** **PENDING**

## What judges can verify in two minutes

1. Run the AuthShield question from the Ask page.
2. Open a numbered claim receipt and follow its original-source link.
3. Inspect ready and degraded connector receipts under **Sources**.
4. Inspect the current-release Fast/Thinking comparison and visible `REVIEW` rows under
   **Proof tests**.
5. Inspect the 346-page document checksum, HydraDB source ID, and same-release PDF benchmark.
6. Open **Connect AI** to inspect the MCP resource and approval boundary.

## Release evidence block — fill from the deployed product

Do not prefill or memorize this block. Paste exact values only after the two SHAs match and the
relevant results report `measured`.

```text
Running release: <health.release.commitSha> on <health.release.commitRef>
Fast: <passed>/<cases> strict cases; <fact accuracy>; <p50>/<p95> ms; <calls>; <units>
Thinking: <passed>/<cases> strict cases; <fact accuracy>; <p50>/<p95> ms; <calls>; <units>
Mode comparison: comparable=<true|false>; <visible delta summary or "not comparable">
Large PDF: <passed>/<cases>; <fact recall>; <canary result>; <p50>/<p95> ms; <calls>/<units>
```

The live sample is a release diagnostic, not an SLA. `REVIEW` is a failed strict requirement,
even when some facts were recovered. Weighted query units compare retrieval work and are not
USD.

## Final publication gates

- All required CI and build checks pass for the submitted commit.
- `/api/health/live` names the submitted production SHA.
- `/api/lab` contains measured same-SHA live and PDF artifacts.
- Fast/Thinking claims are made only when `modeComparison.comparable` is `true`.
- At least three providers are ready with attributable records.
- Complete an authenticated MCP client smoke test before naming that client in the demo.
- Make the repository public and verify it in a signed-out browser.
- Upload the 60-second video publicly and replace **PENDING** with its URL.
