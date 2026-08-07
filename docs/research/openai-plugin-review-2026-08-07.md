# OpenAI plugin and remote-MCP review audit — 7 August 2026

This audit records the current official requirements used for QueueProof's review packet. It is not
evidence that QueueProof has been submitted, approved, published, or connected to a named client.

## Authentication

- An authenticated remote MCP server is expected to follow MCP authorization/OAuth 2.1: protected
  resource metadata, authorization-server discovery, resource indicators, Authorization Code +
  PKCE, exact audience/resource validation, and least-privilege scopes.
- Client ID Metadata Documents are preferred when supported. Dynamic Client Registration remains
  an alternative; a predefined dedicated client can also be used. QueueProof's first-party web app
  and OpenAI plugin must not share an OAuth client.
- QueueProof must keep `queueproof:read` as the initial grant. Sync and proposal scopes require an
  explicit later choice. No MCP tool may imply approval/execution authority.

Source: [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth).

## Connect and test

- The MCP URL must be public HTTPS Streamable HTTP and expose accurate tool metadata and auth
  discovery.
- Test with MCP Inspector/CLI, then enable ChatGPT developer mode, add privately, complete OAuth,
  refresh metadata, and use a new conversation.
- Exercise direct, indirect, follow-up, empty, authorization, write/confirmation, and unsupported
  requests. A configured URL or anonymous 401 is not an authenticated-client receipt.

Source: [connect and test in ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Submission and review

- Public submission requires a verified developer/business identity and **Apps Management: Write**.
- The listing needs name, descriptions, category, logo, website, support, privacy, and terms, plus a
  public MCP URL, auth configuration, domain challenge, accurate tool annotations, starter prompts,
  reviewer access, and at least five positive plus three negative test cases.
- Reviewer access must work without MFA, SMS/email confirmation, or private network and contain
  sanitized sample data.
- Approval does not publish automatically. The verified publisher must explicitly Publish before a
  plugin becomes searchable in the shared ChatGPT/Codex directory.

Sources: [submission requirements](https://developers.openai.com/plugins/deploy/submission) and
[review guidance](https://developers.openai.com/plugins/deploy/app-review).

## Metadata and security

- Each tool should represent one distinct user goal. Descriptions should start with “Use this
  when…”, distinguish overlapping tools, state prerequisites and negative boundaries, and use
  accurate read-only, destructive, idempotent, and open-world annotations.
- Results should contain user-meaningful follow-up IDs and necessary evidence, not internal
  workspace IDs, transport/debug request IDs, raw payloads, credentials, or unrelated personal data.
- Enforce least privilege, validate scopes and ownership server-side, treat retrieved content as
  untrusted data, require confirmation outside MCP for irreversible actions, and document data use,
  service providers, retention/deletion, and user controls accurately.

Sources: [metadata guidance](https://developers.openai.com/plugins/guides/optimize-metadata),
[tool planning](https://developers.openai.com/plugins/plan/tools), and
[security/privacy](https://developers.openai.com/plugins/guides/security-privacy).

## QueueProof audit result

- Canonical endpoint and protected-resource metadata are implemented; anonymous requests fail
  closed. The domain challenge correctly remains 404 until the portal supplies a token.
- The identical `queueproof_ask` alias was removed. `queueproof_search` now takes either verified
  connectorIds or indexed document sourceIds and resolves database, collection, and lineage on the
  server. Cross-connector and unrequested-document results are dropped.
- Tool descriptions, annotations, OAuth metadata, read-only scope filtering, result sanitization,
  hostile-query rejection, untrusted-source omission, and workflow-skill references have regression
  coverage.
- Public submission is still blocked on credential rotation, end-to-end Auth0 CIMD/DCR or dedicated
  client verification, a current ChatGPT read receipt, a monitored support contact and final legal
  fields, verified publisher permissions, a portal domain token, OpenAI review, and explicit Publish.

## Other official client references

- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Claude remote custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
