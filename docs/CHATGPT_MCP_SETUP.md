# Connect QueueProof to ChatGPT

QueueProof's canonical remote MCP resource is `https://queueproof.vercel.app/mcp`. QueueProof is
the resource server and Supabase Auth is the OAuth 2.1 authorization server. The branded email and
consent screens remain on `queueproof.vercel.app`; users never create an API project or paste a
connection key.

## End-user experience after publication

People open the ChatGPT or Codex Plugins Directory, search **QueueProof**, select **Add**, enter
their email on QueueProof, and approve read-only access. A URL alone supports private testing but
does not create a searchable listing: the verified publisher must complete OpenAI review and
explicitly publish the approved version.

## 1. Configure Supabase once

1. Set QueueProof's production site URL to `https://queueproof.vercel.app` and allow
   `https://queueproof.vercel.app/auth/callback` as a redirect URL.
2. Enable Supabase OAuth 2.1 Server and set its authorization/consent URL to
   `https://queueproof.vercel.app/oauth/authorize`.
3. Apply `supabase/migrations/20260807000000_queueproof_mcp_claims.sql`, then select
   `public.queueproof_access_token_hook` under **Authentication → Hooks → Custom Access Token**.
4. Enable dynamic client registration for MCP clients, or create a dedicated public client with
   the exact callback URL ChatGPT supplies. Authorization Code + PKCE is mandatory.
5. Request only the standard identity scopes `openid profile email`. These Supabase scopes do not
   grant QueueProof writes; every valid QueueProof-audience OAuth token starts read-only.

The access-token hook changes the audience only when a token contains an OAuth `client_id`.
Ordinary QueueProof browser sessions keep Supabase's default audience and cannot be replayed at
`/mcp`.

## 2. Check the deployed resource

The production deployment selects hybrid MCP auth when the Supabase public configuration is
present. Hybrid preserves existing scoped QueueProof bearer clients while adding strictly
verified Supabase OAuth access tokens.

Before opening ChatGPT, verify:

- `GET /.well-known/oauth-protected-resource/mcp` returns 200, the canonical resource, standard
  OAuth scopes, and the exact Supabase issuer in `authorization_servers`;
- anonymous `GET /mcp` returns 401 with a `WWW-Authenticate` challenge whose
  `resource_metadata` points to that document; and
- neither response contains a token, workspace ID, HydraDB coordinate, or private source text.

## 3. Test privately before publication

In ChatGPT developer mode, add a private/custom MCP plugin:

- Server URL: `https://queueproof.vercel.app/mcp`
- Authentication: OAuth

Use a clean temporary chat and run a harmless read-only prompt: “Show the sources QueueProof can
search and which are verified.” Confirm `initialize`, `tools/list`, and a workspace-safe result.
Do not call sync, proposal, approval, execution, or provider-write paths during connection proof.

## 4. Record the receipt

Before saying QueueProof is connected to ChatGPT, record the exact production SHA and deployment
ID, Supabase issuer, canonical MCP resource, negotiated protocol, discovered tool names, one
successful read-only call, and anonymous/invalid-token rejection. Never record bearer values.

For video, crop ChatGPT to the clean conversation canvas. Hide sidebar, history, profile,
settings, email addresses, OAuth screens, tool inspectors, and identifiers.

Official references: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth),
[OpenAI connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt),
[Supabase OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server),
[Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication),
and [Supabase custom access-token hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook).
