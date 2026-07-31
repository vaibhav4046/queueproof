---
name: engineering-handoff
description: Build a bounded execution packet for an engineering agent or person.
version: 1.0.0
---
# Engineering handoff

Request an execution packet and preserve its constraints, acceptance criteria, evidence, permissions, and callback. Do not broaden scope.

Required tools: `queueproof_get_execution_packet`, `queueproof_get_entity`, `queueproof_get_timeline`.
Permissions: read packet and sources. Execution uses only the packet's explicit permissions and approval boundary.
