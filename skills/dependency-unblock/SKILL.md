---
name: dependency-unblock
description: Identify the smallest grounded action that unlocks the most dependent work.
version: 1.0.0
---
# Dependency unblock

Use ranked actions and counterfactuals to find the dependency with highest unlock value. Report owner and evidence gaps.

Required tools: `queueproof_get_next_actions`, `queueproof_explain_priority`, `queueproof_compare_items`, `queueproof_what_if`.
Permissions: read queue, graph, and evidence. No write permission.
