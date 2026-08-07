---
name: dependency-unblock
description: Compare persisted QueueProof priority evidence to identify a plausible dependency unblock without claiming an unimplemented counterfactual.
version: 1.1.0
---
# Dependency unblock

Read ranked actions, inspect the relevant execution packets, and compare persisted score components for two candidate tasks. Recommend an unblock only when packet dependencies and evidence support it. QueueProof currently exposes no counterfactual or graph-simulation MCP tool, so label any unlock effect as an inference and report evidence gaps.

Core tools: `queueproof_get_next_actions`, `queueproof_get_execution_packet`, `queueproof_explain_priority`, `queueproof_compare_priorities`.
Permissions: read queue, packets, and persisted ranking evidence. No write permission.
