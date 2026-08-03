# HydraDB hackathon judging matrix

| Criterion | QueueProof evidence | Demo moment |
| --- | --- | --- |
| Correctness | Grounded answer contract, claim receipt IDs, explicit missing information, answer-only expected-fact checks | Run flagship proof; open one citation drawer |
| Cross-source reasoning | Verified GitHub, Linear, Slack and Gmail; one query can preserve status disagreement across three providers | Show connector rail, then contradiction receipt |
| Latency | Auto router chooses fast for stable facts and thinking for cross-source/temporal work; p50/p95 stored per live run | Open Benchmarks and filter Fast versus Thinking |
| Cost | HydraDB calls and weighted units appear in every receipt; no invented USD price | Point to calls and cost units beside answer |
| Reproducibility | 39 labelled fixtures, 22 planted PDF facts, deterministic generator, JSON/CSV reports, one-command runners | Copy the replay command from Benchmarks |
| Developer experience | Same persisted packet in web, API and MCP; copyable IDs; current provider contracts; actionable errors | Open Developer dock and copy config |

## Differentiator

Search products retrieve information. QueueProof proves the transition from fragmented evidence to a safe next action: connector proof → grounded claims → contradiction handling → deterministic priority → approval-gated execution.

## Honest gaps

- Provider availability is constrained by hackathon credentials and HydraDB indexing time.
- HydraDB pricing is not assumed; relative weighted query units are reported.
- A queued document is never called indexed until the status endpoint says `completed`.
