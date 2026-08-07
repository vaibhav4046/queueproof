import { noStoreJson } from "../../../lib/server/api";
import { runtimeEnv } from "../../../lib/server/runtime";
import { audit, enforcePublicRateLimit, workspaceForUser } from "../../../lib/server/store";
import { createWorkspaceMcpHandler } from "../../../packages/mcp/src/server";
import { isTrustedMcpOrigin, mcpPreflight, withMcpCors } from "../../../lib/server/mcp-cors";

const PUBLIC_ACTOR_ID = "user:public-access";
const PUBLIC_CLIENT_ID = "queueproof-public-demo";
const READ_ONLY_SCOPES = ["queueproof:read"] as const;
/**
 * Fallback tenant id, used only when no reviewer workspace is provisioned. It matches no
 * row on purpose, so the MCP server finds no verified connector and answers from the
 * bundled Helios corpus instead of erroring. It stays a non-empty string because the id is
 * still the partition key for the public rate limiter's audit counts and for `audit()`.
 */
const FALLBACK_WORKSPACE_ID = "workspace:synthetic-helios-demo";

/**
 * The reviewer workspace, when one is provisioned. `workspaceForUser` requires two
 * independent operator opt-ins that a private tenant cannot satisfy by accident: the exact
 * workspace id is named in `QUEUEPROOF_PUBLIC_WORKSPACE_ID`, and that workspace carries an
 * explicit non-owner `user:public-access` membership row written by `pnpm public:provision`.
 * A typo in the environment variable resolves nothing, because the membership is missing.
 */
async function reviewerWorkspaceId() {
  try {
    const workspace = await workspaceForUser(PUBLIC_ACTOR_ID);
    const id = workspace?.id;
    return typeof id === "string" && id ? id : FALLBACK_WORKSPACE_ID;
  } catch {
    return FALLBACK_WORKSPACE_ID;
  }
}

async function containsToolCall(request: Request) {
  if (request.method !== "POST") return false;
  try {
    const payload = await request.clone().json() as unknown;
    const messages = Array.isArray(payload) ? payload : [payload];
    return messages.some((message) =>
      Boolean(message) && typeof message === "object" &&
      (message as { method?: unknown }).method === "tools/call"
    );
  } catch {
    return false;
  }
}

/**
 * Outer shell: the demo exists to be called from Claude and ChatGPT, so a same-origin-only
 * policy defeated its entire purpose. Rate limiting, not origin, is the abuse control here.
 */
async function serve(request: Request) {
  const requestOrigin = request.headers.get("origin");
  const selfOrigin = new URL(request.url).origin;
  if (requestOrigin && !isTrustedMcpOrigin(requestOrigin, selfOrigin)) {
    return noStoreJson({ error: "Origin is not allowed." }, { status: 403 });
  }
  if (request.method === "OPTIONS") return mcpPreflight(requestOrigin);
  return withMcpCors(await handle(request), requestOrigin);
}

async function handle(request: Request) {
  const runtime = runtimeEnv() as Record<string, unknown>;
  if (runtime.QUEUEPROOF_PUBLIC_ACCESS !== "true") {
    return noStoreJson({ error: "The QueueProof public demo is unavailable." }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const workspaceId = await reviewerWorkspaceId();
  const isToolCall = await containsToolCall(request);
  await enforcePublicRateLimit({
    actorId: PUBLIC_ACTOR_ID,
    workspaceId,
    operation: isToolCall ? "mcp_demo_tool" : "mcp_demo_session",
    limit: isToolCall ? 12 : 60,
    globalLimit: isToolCall ? 24 : 180,
    windowMs: 60_000,
  });

  const handler = createWorkspaceMcpHandler(workspaceId, [...READ_ONLY_SCOPES], "none");
  const response = await handler.fetch(request, {
    authInfo: {
      token: "[public-demo]",
      clientId: PUBLIC_CLIENT_ID,
      scopes: [...READ_ONLY_SCOPES],
      resource: new URL(`${requestUrl.origin}/mcp/demo`),
    },
  });
  await audit({
    workspaceId,
    actorId: PUBLIC_ACTOR_ID,
    operation: "mcp.demo.request",
    targetType: "mcp_client",
    targetId: PUBLIC_CLIENT_ID,
    outcome: response.ok ? "success" : "failure",
    metadata: {
      method: request.method,
      status: response.status,
      toolCall: isToolCall,
      scopes: READ_ONLY_SCOPES,
    },
  });
  return response;
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
export const OPTIONS = serve;
