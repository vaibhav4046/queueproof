# Codex + QueueProof workflow

## Configuration

For an end user, the intended published path is: search **QueueProof** in the shared Plugins
Directory, add it, and sign in. That path is not public until OpenAI review and the publisher's
explicit Publish action.

For a private remote-MCP OAuth check in Codex CLI/Desktop, the current Codex flow is:

```bash
codex mcp add queueproof --url https://queueproof.vercel.app/mcp
codex mcp login queueproof
```

Do not call that connection verified until browser consent, `tools/list`, and one read-only tool call
have succeeded against the same production release. The repository's tested fallback uses a
read-only, expiring QueueProof key from owner-only **Connect AI** and reads it from the launch
environment:

```bash
export QUEUEPROOF_MCP_TOKEN="<connection-key>"
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs mcp install codex
```

The installer adds this project-local entry to `.codex/config.toml`:

```toml
[mcp_servers.queueproof]
url = "https://queueproof.vercel.app/mcp"
bearer_token_env_var = "QUEUEPROOF_MCP_TOKEN"
```

Keep the token out of TOML. Restart the Codex process after changing its environment. Codex cloud
support depends on whether the workspace permits this remote MCP server and secret environment
variable; do not claim cloud/IDE connection until tool discovery succeeds in that exact client.

## Protocol check

From the repository root and the same launch environment:

```bash
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs mcp verify
```

This verifies `initialize` and `tools/list`. A release-grade client receipt additionally calls at
least one harmless read-only tool and records the production SHA/deployment ID separately.

## Coding-agent workflow

1. Call `queueproof_health` and confirm durable storage is live.
2. List connectors or documents, then use `queueproof_search` with either verified connectorIds or
   indexed document sourceIds it returned. Never supply or guess a database/collection.
3. Keep returned provider coverage, source IDs, mode, call count, and latency attached
   to the reasoning.
4. Read `queueproof_get_next_actions`, then open the selected packet with
   `queueproof_get_execution_packet`.
5. Compare the packet's constraints and acceptance criteria with the repository before editing.
6. Implement and test the code change in the repository; QueueProof evidence does not override
   code, test, or release policy.
7. Ask QueueProof again for release evidence only when a new external fact is needed. Do not
   repeatedly query merely to fill context.
8. If an external Linear follow-up is useful, use a proposal-scoped token only after the owner has
   requested a proposal. The payload must carry workspace-owned evidence IDs.
9. Stop at `proposed`. Approval and provider execution happen through QueueProof's owner control
   plane, not Codex MCP.

## Release-verification workflow

Codex can use QueueProof evidence alongside repository gates, but the authoritative deployed
identity remains the public release receipt:

```bash
pnpm release:verify -- --url https://queueproof.vercel.app --sha <FINAL_SHA>
```

Then confirm the benchmark page and `/api/lab` identify the same SHA before quoting metrics. An MCP
tool result does not replace the release gate.

## Safe prompting pattern

```text
Use QueueProof to find evidence relevant to <TASK-ID>. Cite returned source IDs, distinguish facts
from inference, preserve disagreements, and identify missing proof. Do not propose or execute an
external action.
```

For a requested proposal:

```text
Draft a Linear create_issue proposal from these QueueProof evidence IDs. Show me the exact payload,
risk, and idempotency key first. Do not claim approval or execution.
```

## Status language

- **Configured** means the local entry exists.
- **Connected** means `initialize` and `tools/list` succeeded with a valid token.
- **Verified workflow** means a live read-only tool returned the intended workspace evidence.
- **Proposed** is not approved or executed.

Use only the strongest status supported by a current receipt.

Official client reference: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
