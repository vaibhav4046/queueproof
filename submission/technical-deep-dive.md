# Technical deep dive

QueueProof’s central invariant is that user-visible confidence can never outrun its evidence.

Connector state is a proof protocol, not a Boolean. Credentials submitted, connector created, resources discovered, resources selected, sync requested, and data verified are distinct durable states. Only a provider object with sync evidence plus a canary query containing matching provider sources reaches `data_verified`.

Retrieval is planned before HydraDB is called. Exact identifiers use lexical lookup semantics; temporal, conflict, cross-source, and counterfactual questions select thinking mode and graph context. The trace records classification, plan, actual calls, provider coverage, source IDs, latency, and injection screening.

Ranking is deterministic. Positive components total 100 possible points; explicit evidence/actionability penalties reduce the result. Completed or cancelled work scores zero. Comparison and counterfactual functions operate on the same versioned policy.

MCP shares the same D1 workspace and core contracts as the UI. Remote access is bound to a configured workspace rather than a client-supplied workspace ID. Tool annotations distinguish closed-world reads, external reads, sync requests, and action proposals. No current tool claims a provider write executed.
