import { noStoreJson } from "../../lib/server/api";
import { runtimeEnv } from "../../lib/server/runtime";
import { createWorkspaceMcpHandler } from "../../packages/mcp/src/server";

const encoder = new TextEncoder();

async function constantTimeEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftDigest);
  const b = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function serve(request: Request) {
  const runtime = runtimeEnv();
  const configuredToken = runtime.QUEUEPROOF_MCP_TOKEN;
  const workspaceId = runtime.QUEUEPROOF_MCP_WORKSPACE_ID;
  if (!configuredToken || !workspaceId) {
    return noStoreJson(
      { error: "Remote MCP authentication is not configured for this deployment." },
      { status: 503 },
    );
  }
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin && new URL(origin).origin !== requestUrl.origin) {
    return noStoreJson({ error: "Origin is not allowed." }, { status: 403 });
  }
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !(await constantTimeEqual(token, configuredToken))) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "WWW-Authenticate": `Bearer resource_metadata="${requestUrl.origin}/.well-known/oauth-protected-resource/mcp"`,
      },
    });
  }
  const handler = createWorkspaceMcpHandler(workspaceId);
  return handler.fetch(request, {
    authInfo: {
      token: "[validated]",
      clientId: "queueproof-bearer-client",
      scopes: ["queueproof:read", "queueproof:propose", "queueproof:sync"],
      resource: new URL(`${requestUrl.origin}${requestUrl.pathname}`),
    },
  });
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
