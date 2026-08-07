# Connect QueueProof to ChatGPT

QueueProof's canonical remote MCP resource is `https://queueproof.vercel.app/mcp`. The web app and
ChatGPT use the same Auth0 tenant but **different OAuth clients**. QueueProof is the resource server;
Auth0 is the authorization server.

## End-user experience after publication

People should not create an API project, OAuth client, or QueueProof connection key. They open the
ChatGPT or Codex Plugins Directory, search **QueueProof**, select **Add**, and sign in to their
QueueProof workspace. The universal MCP URL and OAuth registration are publisher infrastructure.

An MCP URL alone is enough for a private custom-connector test, but it does not create a searchable
public listing. The verified publisher must complete OpenAI review and publish the approved entry.
The prepared listing, test cases, and remaining owner actions are in
[`submission/OPENAI_PLUGIN_SUBMISSION.md`](../submission/OPENAI_PLUGIN_SUBMISSION.md).

## 1. Publisher preparation in Auth0

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

## 3. Test privately before publication

Enable developer mode from ChatGPT **Settings → Security and login**. Then open **Plugins**, choose
the option to add a private/custom MCP plugin, and use:

- Server URL: `https://queueproof.vercel.app/mcp`
- Authentication: OAuth

The exact labels can vary by account rollout; follow OpenAI's current connect guide rather than an
old Apps/Connectors screenshot. Complete Auth0 consent off-camera. If Auth0 returns “dynamic client
registration is disabled,” stop and configure CIMD, constrained DCR, or a dedicated client in
Auth0—application code cannot bypass it. After connecting, refresh the plugin metadata, open a new
clean temporary chat, and run a harmless read-only check such as “Show the sources QueueProof can
search and which are verified.” Confirm tool discovery and a workspace-safe result.

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

The Vercel token, Auth0 client secret, and Auth0 application session secret previously pasted into
chat must be rotated before the connection test. Deleting the transcript is not revocation. Use the
owner-controlled Vercel/Auth0 dashboards, redeploy through the normal release process, then repeat
the harmless read-only smoke. Never paste replacement values into documentation or chat.

Official references: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth),
[OpenAI connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt),
[Auth0 Next.js SDK](https://auth0.com/docs/quickstart/webapp/nextjs),
[Auth0 CIMD](https://auth0.com/docs/get-started/auth0-overview/create-applications/register-applications-with-cimd),
and [Auth0 dynamic client registration](https://auth0.com/docs/get-started/applications/dynamic-client-registration).
