# Public support, privacy, and terms review copy

These are content and route requirements for the public plugin listing. The product/UI owner owns
the actual routes. Do not submit until each URL returns 200 without sign-in, works on mobile, links
back to QueueProof, names the publisher/contact truthfully, and has no placeholder text.

## Required URLs

- `https://queueproof.vercel.app/support`
- `https://queueproof.vercel.app/privacy`
- `https://queueproof.vercel.app/terms`

All three pages need a visible effective date and cross-links. The support page must provide a
monitored, actionable contact—not only an unmonitored profile. The verified publisher must choose
the exact legal/publisher name and contact method.

## Support page requirements

Use this copy, replacing the bracketed owner-controlled field:

> **QueueProof support**
>
> Get help with sign-in, source verification, document ingestion, evidence receipts, priority
> packets, and ChatGPT/Codex/Claude MCP connections. Contact **[MONITORED SUPPORT EMAIL OR ISSUE
> FORM]**. Include the client name, approximate UTC time, connector provider and non-secret
> QueueProof connector ID, or query receipt identifier. Never send passwords, API keys, access
> tokens, OAuth authorization codes, session cookies, client secrets, raw private messages, or
> private documents. If a credential was exposed, revoke or rotate it before contacting support.
>
> For a security-sensitive report, describe the affected boundary and impact without publishing
> exploit details. For account-data access, correction, or deletion, state the signed-in account
> and request type; support will verify ownership before acting.

Minimum navigation: sign in, Connect AI/developer guide, privacy, terms, home.

## Privacy policy requirements

The page must accurately cover the following. Do not add “we never store data,” “we never share
data,” “zero retention,” “not used for training,” or “GDPR compliant” unless the publisher can
prove the claim for every named service provider.

### Data collected and generated

> QueueProof stores account identity and workspace membership; connector configuration and proof
> state; selected resource metadata; document ingestion metadata; source references and excerpts
> retained as evidence; query plans, receipts, latency/call metrics, grounded answers, ranking
> inputs and packets; action proposals, approvals, execution receipts; MCP client/scopes/activity
> metadata; and security/audit events. QueueProof connection tokens are stored as hashes. A
> configured HydraDB API key is encrypted at rest and is not returned after configuration.

### How data is used

> QueueProof uses this data to authenticate the user, enforce workspace and source boundaries,
> index and retrieve selected work sources, cite evidence, rank work, prevent duplicate actions,
> troubleshoot failures, enforce abuse/security controls, and provide requested MCP results.
> QueueProof should retrieve and return only the context needed for the user's request.

### Connected sources and AI clients

> Provider credentials supplied during a connector flow are sent to the connector/indexing service
> for that flow and are not returned in QueueProof results. Search is limited to workspace-owned,
> verified connector collections or indexed document source IDs. When a user connects ChatGPT,
> Codex, Claude, or another MCP client, the result sent to that client is also governed by that
> client's terms, retention, and privacy controls. Retrieved source content is treated as untrusted
> data and cannot expand tool permissions.

### Service providers

> QueueProof currently relies on Supabase for authentication and OAuth, HydraDB for connector indexing and
> retrieval, Turso/libSQL for durable application records, and Vercel for application hosting.
> The publisher must update this list when the production data path changes.

### Retention and deletion

> QueueProof does not claim an automatic deletion window in this release. Workspace records remain
> until they are deleted through an implemented product flow or the verified publisher processes a
> supported deletion request. Copies held by connected providers and AI clients follow those
> providers' policies. To request access, correction, or deletion, use the support contact. The
> publisher verifies account ownership and states what was deleted, what must be retained for
> security/legal reasons, and any provider action the user must perform separately.

### User controls and security

> Users choose their sources and MCP scopes. Read access is the default. Users can revoke
> QueueProof-issued MCP tokens and disconnect sources. Tokens are checked for audience, scope,
> expiry, and revocation, and access is bound to the authenticated workspace. No MCP tool approves
> or executes a provider write.

The final page also needs the verified publisher identity/contact and effective date. Legal counsel
or the publisher—not an automated agent—must decide whether jurisdiction-specific disclosures are
needed.

## Terms page requirements

Use plain-language terms that cover:

1. The user may connect and retrieve only data they are authorized to access.
2. The user is responsible for source/client permissions and lawful use.
3. QueueProof evidence may be incomplete or wrong; receipts must be reviewed before reliance.
4. Read, proposal, approval, and external execution are separate. MCP proposals do not execute.
5. Prohibited uses include cross-workspace access, credential exfiltration, permission bypass,
   harmful availability probing, unlawful processing, and third-party rights violations.
6. Service availability, change notice, limitation/disclaimer, termination, and governing-law
   language selected truthfully by the publisher. Do not invent a jurisdiction or corporate entity.
7. Effective date, publisher identity/contact, and links to support/privacy.

## Signed-out acceptance checks

```text
GET /support -> 200, text/html, actionable monitored contact, no placeholder
GET /privacy -> 200, text/html, effective date, data inventory, providers, retention/deletion
GET /terms   -> 200, text/html, effective date, publisher-selected legal fields
Mobile 390px -> no horizontal scroll; links and focus states usable
Robots/auth  -> pages do not require a session and are not blocked from reviewer access
```

Archive screenshots and response headers with the same release receipt used for plugin review.
