# QueueProof: 60-second judge demo

Everything in the primary path uses the production product at
<https://queueproof.vercel.app>. Linear, Slack, and GitHub are `data_verified`. Gmail is
deliberately excluded because it is configured but still backfilling.

## Before recording

- Sign in and warm **Command**, **Ask**, **Sources**, **Approvals**, and **Lab** once.
- Keep an indexed document in the Sources ledger.
- Keep the three-provider benchmark question ready in Ask.
- Keep one Execution Packet ready to open in Command.

## Script

### 0–7 seconds — the thesis

Open **Command** on the ranked live queue.

> “Agents can execute. QueueProof is the layer that proves what deserves execution next.
> It compiles live work evidence into a deterministic queue—not another chat answer.”

### 7–16 seconds — real evidence, real failure boundaries

Cut to **Sources**. Show Linear, Slack, and GitHub as verified, then the document ledger.

> “Three providers reached verified only after HydraDB returned provider-attributable
> records. Credentials are encrypted. Documents are signature-validated, hashed, and do
> not say indexed until HydraDB confirms the terminal state.”

Drop a tiny Markdown file if the recording can tolerate the network wait; otherwise point
to an already indexed receipt. Never claim a queued document is indexed.

### 16–29 seconds — the three-provider answer

In **Ask**, run a prepared three-provider question from the live benchmark.

> “One question fans out across GitHub, Linear, and Slack. Every result keeps the excerpt,
> link, timestamp, and provider. Six production questions returned evidence from all three
> systems—six out of six. If sources disagree, QueueProof keeps the contradiction instead
> of averaging it into confident fiction.”

Point to the retrieval trace. If asked about speed: the measured six-query run was p50
4,401 ms and p95 6,347 ms; state that it is a small sample, not an SLA.

### 29–42 seconds — the Decision Receipt

Return to **Command**, open the first packet, and scroll once.

> “This is the Decision Receipt: acceptance criteria, constraints, dependencies, real
> citations, and why this item beat number two from score-component deltas. The receipt
> hash is persisted once, so the web app, API, and MCP read the same decision.”

Click **Send to approval**.

### 42–55 seconds — safe agency

In the prefilled composer, point to the evidence IDs and exact Linear team field. Open an
existing proposal for the strongest visual if you do not want to create another record.

> “The agent does not get a write button. It proposes this exact Linear payload. A human
> sees the evidence chain and risk class, checks a second confirmation, and only then can
> QueueProof claim one execution slot. Double-clicks and replays cannot create two issues.”

Do not click the final provider-write approval during the recording unless the deployment
has a dedicated demo Linear workspace and `LINEAR_API_KEY` is intentionally configured.

### 55–60 seconds — measured close

Cut to **Lab**.

> “Two hundred seventeen tests pass. Router accuracy is 74.4 percent across 39 labelled
> cases—not rounded up. QueueProof makes autonomy inspectable before it makes it powerful.”

## Truth boundary for judge questions

- **Verified:** Linear, Slack, GitHub, durable Turso storage, live cross-source retrieval,
  real document indexing, deterministic packets, signed sessions, and the MCP server.
- **Configured but not verified:** Gmail. Authentication and label discovery succeeded;
  its free-plan backfill has not yet produced cursor evidence.
- **Built and tested, not live-provider proven:** final Linear issue creation. The
  approval UI and at-most-once execution path exist, but do not claim a real issue receipt
  until one is recorded.
- **Measured:** router 29/39 = 74.4%; six live questions at p50 4,401 ms and p95 6,347 ms;
  all six returned evidence from three providers. The latency sample is small.
- **Not measured or claimed:** citation precision/recall, cost per query, memory, skills
  runtime, decision replay, execution leases, and change-ledger diffing.

## Strong fallback questions

If the judge asks “How do I know verification is real?” explain the Slack failure:
discovery worked, but history was empty until the bot joined the channel. QueueProof stayed
unverified the entire time and promoted the connector only after real objects returned.

If the judge asks “Why not just use an agent framework?” answer:

> “Frameworks optimize execution. QueueProof governs the decision before execution: which
> work, based on which evidence, under which policy, with which human permission—and it
> leaves a receipt that can be challenged later.”
