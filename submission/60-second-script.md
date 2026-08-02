# Sixty-second demo script

Every beat below has been performed against live production at
<https://queueproof.vercel.app> with a real Turso database, a real HydraDB credential, and
two real connectors, Linear and Slack, both at stage `data_verified`. Nothing here is
staged with fixtures.

Gmail is the one connector that is not connected. It is listed at the bottom under
**requires connector setup** and is deliberately not in the recording.

## Before you record

Have three things open:

1. A browser on <https://queueproof.vercel.app>, already signed in, on the **Command** tab.
2. A terminal.
3. A second browser tab on the **Sources** tab, so you can cut to it without navigating.

Warm the app once before the take so the first request is not a cold start.

## The script

### 0 to 8 seconds. The problem.

Open on the **Command** tab with the queue already generated. Three items, two providers.

> "Agents can execute. What they cannot do is defend which piece of work deserves execution
> next. QueueProof compiles that decision from real evidence across real systems, and
> writes down why."

### 8 to 16 seconds. Two verified connectors.

Cut to **Sources**. Show the HydraDB credential fingerprint `503f442f560614fc`, the
61-provider catalogue, and both connectors at `data_verified`.

> "HydraDB is configured through the product, credential encrypted at rest. Sixty-one
> providers load live with their real credential schemas. Linear and Slack were both
> created, discovered, configured, synced and verified entirely through this UI. Neither
> shows verified until a canary query pulls back objects that actually came from that
> provider: five from Linear, three from Slack channel #all-qyntra."

### 16 to 32 seconds. Two providers, one contradiction. **This is the centre of the demo.**

Cut to **Ask**. Run the question live:

> "Who escalated the AuthShield outage, what deadline did engineering commit to, and does
> Linear agree?"

Eleven sources come back, spanning both Linear and Slack, routed to `thinking` mode, in
4220 milliseconds. Point at the two conflicting sources on screen as you say:

> "Eleven sources, both providers. And it does not average them into a comfortable
> sentence. Linear says the billing migration deadline moved to 14 August. Slack says the
> Linear ticket still says 14 August, but finance confirmed today it is staying at
> 7 August, and Linear is out of date. The contradiction is the answer. A system that
> blended these would have told you 14 August with confidence, and been wrong."

### 32 to 44 seconds. The Action Gap. **The second centre of the demo.**

Back to **Command**. Walk down the queue.

> "One: the AuthShield authentication outage for Northwind, from Linear, 77. Two: a Slack
> commitment to ship the AuthShield fix before 7 August, 67. Three, at 58, is the one worth
> stopping on. A promised post-mortem, made in Slack, with no Linear issue tracking it. A
> commitment that exists in conversation and nowhere in the work system. That is the gap
> QueueProof exists to catch, and it was found in real evidence, not written into a
> fixture."

### 44 to 54 seconds. The Decision Receipt, and the bug it caught.

Open the packet for item one. Show the evidence receipts, the receipt hash, and the
why-above-number-two block.

> "Every item carries its receipt: the evidence with real citations, a receipt hash, and
> why it beat number two, computed from the differences between score components. Not a
> summary of the decision, the arithmetic of it. That is not decoration. A ticket reading
> 'No customer impact' once scored plus nine for customer consequence and ranked second.
> The ranking signals were negation-blind. It was caught because the receipt explains
> itself."

### 54 to 60 seconds. Close.

> "Seven bugs found by testing against live services rather than mocks. Router accuracy
> measured at 74.4 per cent, printed as measured, not rounded up. Where a number is not
> measured, the report says not measured. QueueProof is the layer that has to be
> trustworthy before autonomy is safe."

## Alternative beats

Swap either of these in if you have a spare eight seconds or a specific audience.

### The Slack invite lesson (honesty beat)

Fully true, and worth telling if a judge asks how you know the verification is real.

> "Slack discovery succeeded immediately, and sync returned nothing. Slack does not return
> conversation history until the bot is invited to the channel. That is Slack behaving
> correctly, not a connector defect. The point is what QueueProof did while it was empty:
> it refused to report `data_verified` the entire time, exactly as it had for Linear. The
> stage only moved when real objects came back."

### The security boundary

Run the session attack set and show the wall of 401s, all nine: spoofed identity header,
Host-prefix bypass, no credentials, wrong token, garbage signature, payload swapped with
the signature kept, unsigned payload, expired but correctly signed, and unauthenticated
route access. Then a valid session cookie returning 200.

> "Sessions are HMAC-signed httpOnly cookies. Nine attack variants, nine 401s. Identity is
> never read from a header the caller controls."

## Requires connector setup, not in this recording

Do not demonstrate, narrate as working, or simulate any of these:

- **Gmail. Requires connector setup.** Gmail is in the 61-provider catalogue but is not
  connected. State the reason precisely if asked: Google requires a passkey challenge to
  reach the App Passwords page, and that challenge needs a physical biometric or hardware
  gesture. It is blocked by the authentication mechanism, not by preference.
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
  cost.** None of these is measured. One end-to-end query was timed at 4220 ms; that is a
  single measurement, not a percentile. Do not quote a distribution.
- **Memory, skills runtime, decision replay, execution leases, change-ledger diffing.**
  Not implemented. Do not gesture at them as coming soon during the take.
