---
name: engineering-handoff
description: Present a bounded, evidence-backed QueueProof execution packet to an engineer or coding agent.
version: 1.1.0
---
# Engineering handoff

Use `queueproof_get_next_actions` if the user did not provide a packet ID, then retrieve the packet. Preserve its objective, constraints, acceptance criteria, dependencies, missing information, evidence, and permissions. Do not invent entity history or broaden scope. Reading a packet does not authorize repository or provider writes.

Core tools: `queueproof_get_next_actions`, `queueproof_get_execution_packet`.
Permissions: read packet and cited evidence. Execution requires the destination environment's separate authority and the packet's approval boundary.
