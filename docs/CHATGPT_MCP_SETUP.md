# Connect QueueProof to ChatGPT

QueueProof's canonical remote MCP resource is `https://queueproof.vercel.app/mcp`. The web app and
ChatGPT use the same Auth0 tenant but **different OAuth clients**. QueueProof is the resource server;
Auth0 is the authorization server.

## 1. Prepare Auth0

1. Keep the Vercel Marketplace application for QueueProof web sign-in.
2. In Auth0, create an API with identifier `https://queueproof.vercel.app/mcp` and RS256 signing.
3. Add permissions `queueproof:read`, `queueproof:propose`, and `queueproof:sync`.
4. Enable Auth0's Resource Parameter Compatibility so the MCP `resource` value is honored.
5. Start ChatGPT with `queueproof:read` only. Add proposal/sync access only for a deliberate test.

Use CIMD when the Auth0 tenant supports it. Otherwise enable carefully scoped dynamic client
registration or create a separate ChatGPT application and copy the exact callback URL shown by
ChatGPT into its allowed callbacks. Never reuse the QueueProof web client ID or its secret.

## 2. Check the deployed resource

The production deployment automatically selects hybrid MCP auth when the complete Marketplace
Auth0 configuration is present. Hybrid mode preserves existing QueueProof bearer clients while
accepting strictly verified Auth0 access tokens.

Verify these public responses before opening ChatGPT:

- `GET /.well-known/oauth-protected-resource/mcp` returns 200, the exact canonical resource, and
  the Auth0 issuer in `authorization_servers`.
- Anonymous `GET /mcp` returns 401 with a `WWW-Authenticate` challenge whose `resource_metadata`
  points to that metadata URL.
- No secret, token, workspace ID, or private source content appears in either response.

## 3. Add the ChatGPT custom app

In ChatGPT **Settings → Apps/Connectors → Advanced settings**, create the custom MCP app using:

- Server URL: `https://queueproof.vercel.app/mcp`
- Authentication: OAuth

Complete Auth0 consent off-camera. After connecting, open a clean temporary chat and run a harmless
read-only check such as “List my QueueProof connectors, then tell me which are verified.” Confirm
that ChatGPT discovers the QueueProof tools and that the result belongs to the signed-in user's
private workspace.

Do not call sync, proposal, approval, execution, or provider-write paths for the connection test.

## 4. Record the receipt

Before saying “QueueProof is connected to ChatGPT,” record:

- exact production SHA and deployment ID;
- Auth0 issuer and canonical resource (never secrets);
- negotiated MCP protocol version;
- names returned by `tools/list`;
- one successful read-only tool call and its workspace-safe result; and
- anonymous and invalid-token rejection.

For the video, crop ChatGPT to the clean conversation canvas. Hide sidebar, history, profile,
settings, OAuth screens, tool payload inspectors, emails, tenant/client IDs, and all credentials.

## 5. Rotate exposed credentials

If any Vercel or Auth0 credential was pasted into chat, a recording, terminal output, or issue,
rotate or revoke it after the connection test. Deleting the transcript is not revocation. Redeploy
after rotating the Auth0 client secret or session secret, then repeat the harmless read-only smoke.

Official references: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth),
[Auth0 Next.js SDK](https://auth0.com/docs/quickstart/webapp/nextjs),
[Auth0 CIMD](https://auth0.com/docs/get-started/auth0-overview/create-applications/register-applications-with-cimd),
and [Auth0 dynamic client registration](https://auth0.com/docs/get-started/applications/dynamic-client-registration).
