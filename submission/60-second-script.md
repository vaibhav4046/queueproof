# Sixty-second demo script

Every beat below has been performed against live production at
<https://queueproof.vercel.app> with a real Turso database, a real HydraDB credential, and
a real Linear connector. Nothing here is staged with fixtures.

Beats that need Slack or Gmail are listed at the bottom under **requires connector setup**
and are deliberately not in the recording.

## Before you record

Have three things open:

1. A browser on <https://queueproof.vercel.app>, already signed in, on the **Command** tab.
2. A terminal.
3. A second browser tab on the **Sources** tab, so you can cut to it without navigating.

Warm the app once before the take so the first request is not a cold start.

## The script

### 0 to 8 seconds. The problem.

Open on the **Command** tab with the queue already generated.

> "Agents can execute. What they cannot do is defend which piece of work deserves
> execution next. QueueProof compiles that decision from real evidence, and writes down
> why."

### 8 to 18 seconds. Real evidence, not a demo fixture.

Cut to **Sources**. Show the HydraDB credential fingerprint `503f442f560614fc`, configured
through the product UI and encrypted at rest. Show the provider catalogue: 61 real
providers with their real credential schemas, loaded live. Show the Linear connector
sitting at stage `data_verified`.

> "HydraDB is configured through the product, credential encrypted at rest. Sixty-one
> providers load live with their real credential schemas. The Linear connector was
> created, discovered, configured, synced and verified entirely through this UI. It only
> shows verified once a canary query pulls back objects that actually came from Linear:
> five of them, from a real team called Helios Robotics."

Optional terminal cut if you want a hard proof frame:

```bash
curl -s https://queueproof.vercel.app/api/health/ready
```

Returns 200 and ready. Storage is Turso, EU West.

### 18 to 30 seconds. Cross-source retrieval.

Cut to **Ask**. Run the query that returns ten sources.

> "One question, ten sources. Six are documents I uploaded through the product, ingested
> into HydraDB and polled through graph creation to `indexed`. Four are live Linear
> tickets: HEL-4, 5, 6 and 7. That is a single answer built across two different kinds of
> source."

### 30 to 44 seconds. The Decision Receipt.

Back to **Command**. Open the packet for the top item.

> "AuthShield authentication outage for Northwind, score 77. Second is a billing migration
> deadline at 47. The packet carries evidence receipts with real Linear citations, a
> receipt hash, and a why-above-number-two block computed from the differences between
> score components. Not a summary of the decision. The arithmetic of it."

Point at the component deltas as you say the last sentence.

### 44 to 54 seconds. Why the receipt matters.

Stay on the why-above block.

> "This is not decoration. A ticket that read 'No customer impact' scored plus nine for
> customer consequence and ranked second. The ranking signals were negation-blind. Nobody
> would have caught that from the score alone. It was caught because the receipt explains
> itself in component deltas, and plus nine on that ticket was obviously wrong. That is one
> of seven bugs found by testing against live services rather than mocks."

If you have a second to spare, name a second bug: HydraDB nests the source id one level
deeper than expected, so every upload returned a null id and was untrackable until it was
fixed.

### 54 to 60 seconds. Close.

> "Thirty-nine ground-truth cases, fifteen categories, router accuracy measured at
> 74.4 per cent. Not rounded up, not estimated. Where a number is not measured, the report
> says not measured. QueueProof is the layer that has to be trustworthy before autonomy is
> safe."

## Alternative beat: the security boundary

Swap this in for 18 to 30 seconds if the audience is security-minded. It is fully
performable against live production.

Run the session attack set and show the wall of 401s, all nine: spoofed identity header,
Host-prefix bypass, no credentials, wrong token, garbage signature, payload swapped with
the signature kept, unsigned payload, expired but correctly signed, and unauthenticated
route access. Then a valid session cookie returning 200.

> "Sessions are HMAC-signed httpOnly cookies. Nine attack variants, nine 401s. Identity is
> never read from a header the caller controls."

## Requires connector setup, not in this recording

Do not demonstrate, narrate as working, or simulate any of these:

- **Slack and Gmail connectors. Requires connector setup.** Both appear in the
  61-provider catalogue with real credential schemas, but neither is connected, because
  connecting them needs the owner's own Slack and Gmail logins.
- **Linear write execution.** The approval-gated propose path is built and unit-tested
  against an injected fetch. No real Linear issue has been created through it. Do not imply
  that approving a proposal writes to Linear today.
- **MCP receipt-hash parity against an external client.** The receipt hash is computed and
  persisted, but no external MCP client has fetched the same receipt, so do not claim
  cross-client parity on camera.
- **The 346-page PDF.** It is generated deterministically (958,096 bytes, SHA-256
  `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93`, 22 planted
  ground-truth facts) but it has not been ingested into HydraDB. Show it as an artefact if
  you want, never as an indexed source.
- **Citation precision, citation recall, latency percentiles, HydraDB call counts and
  cost.** None of these is measured. Do not quote a figure for any of them.
- **Memory, skills runtime, decision replay, execution leases, change-ledger diffing.**
  Not implemented. Do not gesture at them as coming soon during the take.
