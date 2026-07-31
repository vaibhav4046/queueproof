---
name: daily-priority
description: Produce a cited, deterministic daily work queue from verified QueueProof sources.
version: 1.0.0
---
# Daily priority

Call `queueproof_get_next_actions`, then `queueproof_explain_priority` for the top items. Cite every evidence ID, surface conflicts and missing information, and never invent work when the queue is empty.

Required tools: `queueproof_get_next_actions`, `queueproof_explain_priority`, `queueproof_compare_items`.
Permissions: read queue, ranking policy, and source references. No write permission.

Load `references/workflow.md` only when composing the brief. Validate with `tests/cases.json`.
