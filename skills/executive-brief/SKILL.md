---
name: executive-brief
description: Create a concise executive brief from persisted priorities, queue snapshots, and cited search evidence.
version: 1.1.0
---
# Executive brief

Read current next actions and recent queue snapshots. If the user asks about commitments or changes, list the relevant connectors/documents and search only their returned verified connectorIds or indexed sourceIds. Link every factual claim to sourceId evidence, distinguish persisted policy score from narrative judgment, and label any snapshot comparison as a derived comparison rather than a built-in change detector.

Core tools: `queueproof_get_next_actions`, `queueproof_list_queue_snapshots`, `queueproof_list_connectors`, `queueproof_search`.
Permissions: read-only. Minimise sensitive excerpts.
