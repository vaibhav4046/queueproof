# Supabase authentication setup

QueueProof uses Supabase for passwordless web identity and OAuth 2.1 for MCP clients. The product
stores application data in Turso; Supabase is an identity boundary, not a second QueueProof data
store. No `service_role` key belongs in the app or Vercel.

**Current production policy:** QueueProof exposes email magic-link sign-in only. Google, GitHub,
Slack, Linear, and every other work system are authorized separately as connectors inside the
signed-in workspace. The optional social-provider support below is fail-closed future capability,
not part of the current release contract.

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
5. Configure custom SMTP before public production testing. Supabase's default SMTP is a trial
   service with restricted recipients and is not a general-purpose delivery service.
6. Keep leaked-password protection, email rate limits, and CAPTCHA/bot protection enabled where
   the selected plan supports them.

## Optional social sign-in

Social sign-in proves the QueueProof account identity only. It does not connect a user's source,
grant QueueProof Gmail/Drive/repository/Slack-history access, or authorize a Linear write.
Connector authorization stays in the signed-in **Sources** flow, and every provider write keeps
its separate review and approval step.

| Sign-in choice | Supabase provider ID | QueueProof rule                                                                          |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| Google         | `google`             | Request identity scopes only; connect Google data later as a separate source.            |
| GitHub         | `github`             | Sign-in is not repository authorization; use a separate connector/app grant.             |
| Slack          | `slack_oidc`         | Use the current OIDC provider and only `openid profile email`; never use legacy `slack`. |
| Linear         | none                 | Connector only. Do not add a “Continue with Linear” button.                              |

For each enabled native provider:

1. Create the OAuth application with the provider.
2. Register Supabase's provider callback URL,
   `https://<project-ref>.supabase.co/auth/v1/callback`, at the provider.
3. Save the client ID and secret in **Supabase Authentication → Sign In / Providers**. Provider
   secrets do not belong in QueueProof's client bundle or Vercel environment variables.
4. Enable the provider only after its credentials, consent branding, and exact callback are
   complete.
5. Verify one create-account flow, one returning-user flow, one cancel/error flow, and sign-out.

QueueProof reads `/auth/v1/settings` on the server and renders only the allow-listed providers
that Supabase reports as enabled: `google`, `github`, and `slack_oidc`. A missing credential,
disabled provider, timeout, non-2xx response, or malformed settings response fails closed: the
button is hidden and the email route/public demo remain available. Do not render a disabled button
or infer provider readiness from an environment variable.

Supabase also supports custom OAuth2/OIDC providers with a `custom:` identifier. That feature is
not needed for these three native providers and is not a reason to turn Linear into login.
Linear's documented user identity lookup is a GraphQL POST (`viewer`), rather than an OIDC
discovery/UserInfo contract QueueProof can rely on directly. Keep Linear in the connector layer
unless a dedicated, separately reviewed identity adapter is deliberately built.

## Consent boundary

The user encounters three independent grants:

1. **QueueProof sign-in** — email, Google, GitHub, or Slack OIDC establishes the immutable
   Supabase `issuer + sub` identity.
2. **Source connection** — inside the private workspace, the owner explicitly creates or imports
   a HydraDB connector and chooses resource/account scope. Login tokens are never silently reused.
3. **Provider write** — a Linear change is proposed, its exact payload and evidence are shown, and
   the owner must approve the one-time execution.

Disconnect and revocation must follow the connector contract independently of QueueProof sign-out.
Signing out of QueueProof ends the QueueProof session; it must not imply that a provider connector
was revoked, and revoking a connector must not delete the QueueProof account.

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

- `/sign-in` renders only providers currently reported enabled by Supabase; it never renders
  Linear as sign-in.
- a disabled or unreachable social provider produces no dead button, while the email form and
  public demo remain usable;
- cancelling a provider flow or failing the PKCE exchange returns to `/sign-in` with safe,
  non-reflected error copy and changes no connector;
- the email link returns through `/auth/callback` and creates one private workspace for the
  immutable Supabase subject;
- login consent never imports a source; source creation/import and account/resource scope require
  a later explicit owner action;
- `/oauth/authorize` requires a signed-in user and shows the registered client, requested scopes,
  read-only boundary, and explicit allow/cancel controls;
- protected-resource metadata advertises the exact Supabase issuer and standard scopes;
- a browser-session token, wrong-audience token, missing-client token, and unsigned token all fail
  at `/mcp`;
- a real ChatGPT OAuth token can run `initialize`, `tools/list`, and one harmless read-only call in
  the same personal workspace.

Official references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs),
[passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google),
[GitHub sign-in](https://supabase.com/docs/guides/auth/social-login/auth-github),
[Slack OIDC sign-in](https://supabase.com/docs/guides/auth/social-login/auth-slack),
[custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers),
[OAuth 2.1 server](https://supabase.com/docs/guides/auth/oauth-server),
[custom access-token hooks](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook),
and [Linear OAuth](https://linear.app/developers/oauth-2-0-authentication).
