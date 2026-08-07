# QueueProof 3–4 minute Supademo voice script

Target: **3:35–3:50** at 132–138 words per minute. This is the primary hackathon narration. Record
it only after replacing bracketed values with same-release facts and selecting the conditional
client lines supported by current receipts.

## Final narration

### 0:00–0:22 — the decision gap

> Teams do not lack information; they lack proof they can act on. One incident spans Slack, Linear,
> GitHub, email, and documents, and those sources disagree. QueueProof is a HydraDB-powered evidence
> and priority layer that answers the work question, shows its receipts, and separates a safe next
> action from an external write.

### 0:22–0:45 — personal workspace and sources

> A user signs in once to a private workspace. This synthetic Helios workspace has verified Slack,
> Linear, GitHub, and Gmail connectors, plus an indexed handbook. QueueProof does not count a saved
> credential as a source. A connector must return attributable canary evidence before retrieval.
> That makes the connector a reproducible proof, not a logo claim.

### 0:45–1:24 — difficult cross-source retrieval

> Here is the flagship multi-hop question: who escalated the AuthShield outage, what did engineering
> commit to, and is the fix merged? QueueProof plans retrieval and sends only the workspace-owned
> scope to HydraDB. Auto mode reserves deeper retrieval for work that is genuinely multi-hop. The
> result connects Northwind's escalation, Priya Raman's issue, the deadline,
> and the GitHub merge receipt. It keeps Linear's still-open state visible instead of erasing the
> contradiction.
>
> This exact receipt used **[LIVE MODE]**, **[LIVE CALL COUNT]** HydraDB calls, and **[LIVE LATENCY]**
> milliseconds. Those are observed values from this release, not estimates.

### 1:24–1:55 — the aha moment: claim to graph to source

> Every supported claim opens to its source ID, provider, timestamp, excerpt, and original link. In
> History, the evidence graph becomes a decision map: sources connect to supported claims,
> conflicting states stay split, and the task connects to its execution packet. Source text is
> untrusted data; it cannot grant permission.

### 1:55–2:25 — priority and action boundary

> QueueProof ranks grounded work with a versioned deterministic policy. The top item exposes score
> components, penalties, confidence, dependencies, missing information, acceptance criteria, and
> evidence. MCP can prepare an evidence-linked Linear proposal only when explicitly asked.
> Proposed is not approved, and approved is not executed. No MCP tool can approve or execute a
> provider write.

### 2:25–2:51 — reproducible proof

> Proof tests binds results to this release, **[SHORT SHA]**. The router result is **[ROUTER
> RESULT]**, the large-document result is **[PDF RESULT]**, and the mode comparison is **[MODE
> COMPARISON OR “not yet comparable”]**. Calls, latency, and weighted retrieval units remain visible
> beside failures. Weighted units are relative work, not dollars, and this is not an SLA.

### 2:51–3:20 — ChatGPT plugin

> The same contract is available through remote MCP. In a clean ChatGPT conversation, QueueProof
> discovers only tools allowed by this read-only grant. I can ask the AuthShield question, receive
> source-level evidence, and open a priority packet without exposing an API key or reconnecting each
> source. The user signs in; the publisher owns OAuth.

### 3:20–3:38 — Codex and Claude, conditional

> Codex and Claude use the same remote contract. Each must pass OAuth or a scoped token check,
> discover tools, and complete a harmless read before we call it connected. Results can guide an
> agent, but retrieved content never overrides repository policy, approval, or provider permissions.

### 3:38–3:50 — close

> QueueProof does not ask you to trust a polished answer. It shows the support, disagreement,
> unknowns, and exactly where human authority begins before any system changes.

## Conditional client replacement lines

Do not show or narrate a named client without a same-release authenticated receipt.

- **ChatGPT not verified:** replace 2:51–3:20 with: “QueueProof exposes a standards-based remote MCP
  endpoint with protected-resource discovery and read-only-first scopes. The private ChatGPT OAuth
  test is pending, so this demo makes no connected or public-directory claim.” Show only the
  sanitized developer contract, not a mocked ChatGPT screen.
- **Codex or Claude not verified:** name only the client with a receipt. For any unverified client,
  say: “The setup contract is documented; an authenticated read receipt is still pending.”
- **No clients verified:** use the recovered time to show document provenance and a second citation.

## Voice file handoff

Send one dry file named `queueproof-demo-voice-v2.wav`: 48 kHz, 24-bit, mono; 0.5 seconds of silence
at each end; 0.6–0.8 seconds between sections. No music, reverb, normalization pump, or noise gate in
the master. The editor can split on silence. If music is added later, use an original or explicitly
CC0 instrumental bed at least 18 dB below narration and fade it lower under metrics and client proof.
