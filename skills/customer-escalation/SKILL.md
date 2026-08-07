---
name: customer-escalation
description: Build an evidence-backed brief for one named customer while minimizing unrelated private content.
version: 1.1.0
---
# Customer escalation

List connectors, then search only returned verified connectorIds for the named customer, exact issue IDs, and requested time window. Minimise private content, retain provider, sourceId, URL, and timestamp attribution, and separate customer statements from internal interpretation. If the user explicitly requests a Linear follow-up and supplies workspace-owned evidence IDs, `queueproof_propose_action` may prepare a proposal; it never approves or executes it.

Core tools: `queueproof_list_connectors`, `queueproof_search`. Optional scoped tool: `queueproof_propose_action`.
Permissions: scoped read by default; proposal-only local write with `queueproof:propose`; separate human approval and execution required.
