---
name: release-readiness
description: Determine release readiness from evidence, blockers, commitments, and conflicts.
version: 1.0.0
---
# Release readiness

Retrieve the release entity, timeline, conflicts, and next actions. Evaluate declared gates without converting absent evidence into a pass.

Required tools: `queueproof_get_entity`, `queueproof_get_timeline`, `queueproof_list_conflicts`, `queueproof_get_next_actions`.
Permissions: read release-scoped evidence. No write permission.
