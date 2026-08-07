# Supabase authentication setup

QueueProof uses Supabase for passwordless web identity and OAuth 2.1 for MCP clients. The product
stores application data in Turso; Supabase is an identity boundary, not a second QueueProof data
store. No `service_role` key belongs in the app or Vercel.

## Project settings

1. Create or connect one Supabase project.
2. Under **Authentication → URL Configuration**, set the site URL to
   `https://queueproof.vercel.app` and allow:
   - `https://queueproof.vercel.app/auth/callback`
   - the exact Vercel preview callback only while testing that preview
   - `http://localhost:3000/auth/callback` for local development
3. Copy only the project URL and publishable key to Vercel as
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Under **Authentication → Email Templates → Magic Link**, use
   `supabase/templates/magic-link.html` and a QueueProof sender name.
5. Keep leaked-password protection, email rate limits, and CAPTCHA/bot protection enabled where
   the selected plan supports them.

## MCP OAuth server

1. Apply `supabase/migrations/20260807000000_queueproof_mcp_claims.sql` in the Supabase SQL editor
   or migration workflow.
2. Under **Authentication → Hooks**, enable `public.queueproof_access_token_hook` as the Custom
   Access Token hook.
3. Enable OAuth 2.1 Server and configure the custom authorization URL as
   `https://queueproof.vercel.app/oauth/authorize`.
4. Enable Dynamic Client Registration for private ChatGPT testing, or register a dedicated public
   PKCE client with ChatGPT's exact callback URL.
5. Use an asymmetric Supabase JWT signing key so QueueProof can verify the public JWKS. QueueProof
   accepts ES256 or RS256 and rejects any other algorithm.

The hook sets `aud=https://queueproof.vercel.app/mcp` only for tokens carrying an OAuth
`client_id`. Browser sessions retain the normal Supabase audience and cannot authenticate to MCP.
Supabase's current standard scopes are `openid profile email`; QueueProof maps a valid token to
read-only access internally.

## Production verification

- `/sign-in` renders the QueueProof email form and never redirects to a hosted provider page.
- the email link returns through `/auth/callback` and creates one private workspace for the
  immutable Supabase subject;
- `/oauth/authorize` requires a signed-in user and shows the registered client, requested scopes,
  read-only boundary, and explicit allow/cancel controls;
- protected-resource metadata advertises the exact Supabase issuer and standard scopes;
- a browser-session token, wrong-audience token, missing-client token, and unsigned token all fail
  at `/mcp`;
- a real ChatGPT OAuth token can run `initialize`, `tools/list`, and one harmless read-only call in
  the same personal workspace.

Official references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs),
[passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server), and
[custom access-token hooks](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook).
