---
name: release-readiness
description: Assess a named release against user-specified gates using cited QueueProof evidence and explicit unknowns.
version: 1.1.0
---
# Release readiness

List connectors and documents, then search returned verified connectorIds or indexed sourceIds for the exact release ID and each declared gate. Use ranked actions or packets for persisted blockers when relevant. Return ready, not ready, or insufficient evidence; preserve source disagreements and never convert absent evidence into a pass. QueueProof currently exposes no dedicated release-entity, timeline, or conflict detector over MCP.

Core tools: `queueproof_list_connectors`, `queueproof_list_documents`, `queueproof_search`, `queueproof_get_next_actions`, `queueproof_get_execution_packet`.
Permissions: read release-scoped evidence. No write permission.
