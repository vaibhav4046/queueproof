# Claude + QueueProof workflow

## Supported path

The repository contains and tests a Claude Code project configuration for QueueProof's remote HTTP
MCP endpoint. Authentication is an environment-backed bearer token. Claude also supports remote
custom connectors: Pro/Max users add them under **Customize → Connectors**, while Team/Enterprise
owners add the connector for the organization and members then connect. QueueProof's Claude web
connector is **not claimed as connected** until its production OAuth consent, tool discovery, and a
read-only call are recorded on one deployed release.

## Claude Code setup

1. Use the owner-only **Connect AI** page to create a read-only, expiring connection key.
2. Export it only in the environment that launches Claude Code:

   ```bash
   export QUEUEPROOF_MCP_TOKEN="<connection-key>"
   ```

3. From the repository root, install the tested project configuration:

   ```bash
   QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs mcp install claude
   ```

   The installer backs up an existing project file and writes `.mcp.json`. That file is local
   client state and must not be committed.

The equivalent reviewed shape is:

```json
{
  "mcpServers": {
    "queueproof": {
      "type": "http",
      "url": "https://queueproof.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer ${QUEUEPROOF_MCP_TOKEN}"
      }
    }
  }
}
```

Restart Claude Code after changing its launch environment or MCP configuration.

## Verification sequence

First verify the protocol from the same environment:

```bash
QUEUEPROOF_URL=https://queueproof.vercel.app node cli/queueproof.mjs mcp verify
```

Then, in Claude Code:

1. Confirm QueueProof appears in the MCP server/tool list.
2. Call `queueproof_health`.
3. Call `queueproof_list_connectors`; treat only stored proof states as observations, not an
   evergreen connector guarantee.
4. Use `queueproof_search` for an exact-ID or cross-source question with connectorIds returned by
   `queueproof_list_connectors`, or indexed sourceIds returned by `queueproof_list_documents`.
5. Inspect provider coverage, source IDs, mode, latency, and call count in the tool result.
6. Read `queueproof_get_next_actions`, then fetch one returned packet ID with
   `queueproof_get_execution_packet`.
7. With a proposal-scoped token, create only a harmless, evidence-linked proposal when the owner
   intends that test. Verify the result remains `proposed` and `approvalRequired: true`.

Do not state that Claude executed an external change. QueueProof exposes no MCP approval or
execution tool.

## Useful Claude prompts

These prompts describe work; the model must still use the actual tool schemas it discovers:

```text
Use QueueProof to retrieve the evidence for ENG-456. Separate supported facts from inferences,
name missing proof, and cite the returned source IDs.
```

```text
Use QueueProof to compare the current tracked state with code evidence. Preserve any disagreement.
Do not propose a write unless I ask.
```

```text
Read the latest QueueProof next actions and open the top execution packet. Explain its score,
constraints, evidence, and approval requirement without claiming the action ran.
```

## Claude web status

The publisher may privately add `https://queueproof.vercel.app/mcp` as a Claude remote custom
connector only after protected-resource discovery returns the configured authorization server.
Review the standard `openid profile email` scopes, complete OAuth off-camera, and confirm that
QueueProof reports internal read-only access. The
present bearer setup alone is not proof of Claude web compatibility. Record the production SHA,
OAuth issuer, scopes granted, tool discovery, and one live read-only receipt without exposing
tokens. Do not say QueueProof is in a Claude directory or available to every user; organization
availability depends on the Claude plan and owner controls.

## Teardown

Revoke the client from **Connect AI**, unset `QUEUEPROOF_MCP_TOKEN`, and remove or restore the local
`.mcp.json` backup. Revocation, expiry, workspace binding, and audience checks are enforced by the
server.

Official client reference: [Claude remote custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
