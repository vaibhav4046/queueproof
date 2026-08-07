---
name: commitment-audit
description: Audit evidence for named commitments across verified QueueProof sources without inventing missing promises or dates.
version: 1.1.0
---
# Commitment audit

List the available connectors or documents, then use `queueproof_search` with returned verified connectorIds or indexed sourceIds for the user's named person, project, date range, or commitment language. Report promisor, beneficiary, outcome, date, status, and sourceId only when supported by returned excerpts. Preserve disagreement and mark unknown fields. QueueProof currently has no dedicated commitment extractor or untracked-commitment detector, so never claim completeness.

Core tools: `queueproof_list_connectors`, `queueproof_list_documents`, `queueproof_search`.
Permissions: read-only. No proposal, sync, approval, or execution permission.
