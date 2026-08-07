---
name: incident-triage
description: Triage a named incident using cited cross-source evidence and persisted QueueProof priorities.
version: 1.1.0
---
# Incident triage

List connectors and search the exact incident ID, service, and requested time range using only returned verified connectorIds. Order returned evidence by timestamp, preserve contradictory claims, and separate observations, inferences, and missing facts. Use next actions or packets only when the user asks for the current response priority. A Linear follow-up may be proposed only on explicit request with the scoped tool; it is never approved or executed by MCP.

Core tools: `queueproof_list_connectors`, `queueproof_search`, `queueproof_get_next_actions`, `queueproof_get_execution_packet`. Optional scoped tool: `queueproof_propose_action`.
Permissions: read incident evidence by default; proposal-only local write with `queueproof:propose`; human approval and execution remain separate.
