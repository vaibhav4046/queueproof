---
name: source-conflict-resolution
description: Reconstruct contradictory claims from cited QueueProof search evidence without erasing uncertainty.
version: 1.1.0
---
# Source conflict resolution

List connectors, then search the exact subject or record ID using at least two verified connectorIds when available. Compare only returned claims, providers, timestamps, and excerpts; preserve both sides and propose the smallest clarifying question. QueueProof currently exposes no dedicated conflict list, entity, or timeline MCP tool, so do not claim a complete conflict inventory.

Core tools: `queueproof_list_connectors`, `queueproof_search`.
Permissions: read-only.
