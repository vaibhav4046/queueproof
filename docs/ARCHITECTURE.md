# QueueProof architecture

QueueProof is an evidence control plane over HydraDB, not another chat wrapper.

```text
Public web / JSON API / MCP client
              │
      server-resolved actor
              │
       durable workspace (Turso)
              │
   encrypted HydraDB account key
              │
 verified connector scopes + documents
              │
 auto router: fast or thinking query
              │
 identity-safe source/chunk join + injection screen
              │
 grounded answer contract + contradiction preservation
              │
 deterministic priority policy + deduplication
              │
 immutable execution packet / receipt hash
              │
 approval-gated provider proposal and idempotent execution
```

## Trust boundaries

- Workspace identity is resolved on the server; caller-provided workspace IDs are never trusted.
- Connector credentials are fetched from HydraDB's live provider contracts, encrypted with AES-GCM, and never returned.
- Only `data_verified` connectors enter retrieval and queue generation.
- Sources and chunks join by HydraDB identity, never by array position.
- Retrieved instructions are data. Prompt-injection-shaped evidence is excluded from the action queue.
- Answers contain claims that cite receipt IDs. Contradictions and missing information stay explicit.
- Provider writes begin as proposals. Approval and an idempotency claim are required before one execution attempt.

## Persistence

Production uses Turso/libSQL through a small D1-compatible facade. Local and CI runs use Node SQLite. QueueProof refuses silent ephemeral fallback unless explicitly enabled.

## Surfaces

- Web: proof, priority queue, evidence ledger, evaluation lab, approvals, developer/MCP dock.
- API: grounded ask, connector lifecycle, documents, queue, action proposals, health.
- MCP: the same persisted execution packet and approval-safe tools exposed to agents.
