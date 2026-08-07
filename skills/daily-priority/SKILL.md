---
name: daily-priority
description: Produce a cited, deterministic daily work queue from verified QueueProof sources.
version: 1.1.0
---
# Daily priority

Call `queueproof_get_next_actions`, then `queueproof_explain_priority` for the top items. Use `queueproof_compare_priorities` only when comparing two returned task IDs. Cite packet evidence, surface disagreement and missing information, and never invent work when the queue is empty.

Core tools: `queueproof_get_next_actions`, `queueproof_explain_priority`, `queueproof_compare_priorities`.
Permissions: read queue, ranking policy, and source references. No write permission.

Load `references/workflow.md` only when composing the brief. Validate with `tests/cases.json`.
