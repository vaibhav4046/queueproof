# QueueProof OpenAI plugin submission

This is the publisher-ready source of truth for making QueueProof discoverable in the shared
ChatGPT and Codex Plugins Directory. It deliberately separates completed product work from the
account-level actions that only the verified publisher can perform.

## Public listing

| Field | Value |
| --- | --- |
| Name | QueueProof |
| Short description | Ask across your work and get a cited, contradiction-aware answer. |
| Category | Productivity |
| Website | `https://queueproof.vercel.app` |
| Universal MCP URL | `https://queueproof.vercel.app/mcp` |
| Authentication | OAuth 2.1 through Auth0; request `queueproof:read` first |
| Logo | `public/queueproof-icon-v2-512.png` |
| UI | None in the first submission; ChatGPT renders normal tool results |

### Long description

QueueProof retrieves related evidence across work sources and documents, keeps source disagreement
visible, and returns the receipts behind supported conclusions. It can also return deterministic
next-action packets. Read access is the default. Preparing or syncing work requires an explicit
additional scope, and QueueProof exposes no MCP tool that can approve or execute a provider write.

## Starter prompts

1. “List my QueueProof connectors and tell me which ones have current verification receipts.”
2. “Use QueueProof to investigate BUG-123 across the verified sources and cite the returned receipt IDs.”
3. “Show my highest-priority QueueProof action and open its complete execution packet.”
4. “Compare the top two QueueProof priorities and explain the deterministic score difference.”
5. “Find the latest evidence about the AuthShield fix and preserve any disagreement between code and the tracker.”

## Positive review cases

| # | Prompt | Expected workflow | Expected result |
| ---: | --- | --- | --- |
| 1 | List my QueueProof connectors and their proof state. | `queueproof_list_connectors` | Workspace-bound connector rows; no credential values. |
| 2 | Check the verification receipt for the selected connector. | `queueproof_verify_connector` using an ID returned by case 1 | Latest stored verification or an explicit null result. |
| 3 | Search BUG-123 in my verified connector database and cite the sources. | `queueproof_search` using the database and collection returned by case 1 | Attributable sources, chunks, provider coverage, request ID, latency, and call count. |
| 4 | Show my next action, then open its evidence packet. | `queueproof_get_next_actions`, then `queueproof_get_execution_packet` | Ranked item followed by its canonical evidence-backed packet. |
| 5 | Explain why the first task outranks the second. | `queueproof_compare_priorities` or `queueproof_explain_priority` | Stored component deltas and policy explanation, not a newly invented ranking. |

## Negative review cases

| # | Scenario | Expected behavior | Why |
| ---: | --- | --- | --- |
| 1 | Ask QueueProof to search an unattached HydraDB database or collection. | Reject the request as outside the authenticated workspace. | Caller input must not cross the workspace boundary. |
| 2 | Ask a read-only installation to sync a connector or prepare a provider action. | The scoped tool is unavailable; do not attempt a write. | The first submission requests only `queueproof:read`. |
| 3 | Ask QueueProof to approve or execute a Linear change. | Explain that no MCP execution tool exists and direct the user to owner review in QueueProof. | Proposal, approval, and provider execution are separate trust boundaries. |

## Review configuration

- Submit the server as a new **With MCP** plugin and choose **Universal** URL.
- Scan the production MCP server directly; do not reference the private custom connector created
  during development.
- Request only `queueproof:read` for the initial public version.
- Every MCP tool already declares `readOnlyHint`, `openWorldHint`, and `destructiveHint`, plus its
  OAuth scope metadata.
- If the portal asks for domain verification, copy its exact token into the production
  `OPENAI_APPS_CHALLENGE` environment variable. QueueProof serves only that token from
  `/.well-known/openai-apps-challenge` with `Cache-Control: no-store`.
- After verification, remove or rotate the challenge value if the portal no longer needs it.

## Publisher-only actions still required

The following cannot be completed safely from source code or a Vercel deployment:

1. Use an OpenAI Platform organization whose publisher identity is verified and whose submitter
   has **Apps Management: Write**.
2. Confirm the final public support URL, privacy-policy URL, terms URL, publisher name, countries,
   and policy attestations. They must match that verified identity; do not invent them in code.
3. In Auth0, verify that the API identifier is exactly `https://queueproof.vercel.app/mcp`, RS256
   is enabled, `queueproof:read` exists, Resource Parameter Compatibility is enabled, and either
   CIMD or carefully scoped Dynamic Client Registration is actually accepted. The last ChatGPT
   preview failed because Auth0 returned `dynamic client registration is disabled`.
4. Provide a sanitized reviewer account that works without MFA, SMS, email confirmation, or
   private-network access and contains only the synthetic public demo evidence.
5. Submit for review. Approval does not publish automatically; the verified publisher must select
   **Publish** after approval. Only then will people be able to search for QueueProof and add it
   directly in ChatGPT or Codex.

## Release notes

Initial QueueProof MCP submission: workspace-bound Auth0 OAuth, verified connector and document
inspection, source-level evidence search, deterministic priority packets, accurate tool safety
annotations, and a read-only-first permission model. Provider execution remains outside MCP.

Official requirements: [submit plugins](https://developers.openai.com/plugins/deploy/submission),
[plugin authentication](https://developers.openai.com/plugins/build/auth), and
[plugin guidelines](https://developers.openai.com/plugins/app-guidelines).
