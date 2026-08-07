import { noStoreJson } from "../../../lib/server/api";
import { runtimeEnv } from "../../../lib/server/runtime";
import {
  audit,
  enforcePublicRateLimit,
  workspaceForUser,
} from "../../../lib/server/store";
import { createWorkspaceMcpHandler } from "../../../packages/mcp/src/server";

const PUBLIC_ACTOR_ID = "user:public-access";
const PUBLIC_CLIENT_ID = "queueproof-public-demo";
const READ_ONLY_SCOPES = ["queueproof:read"] as const;

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

async function serve(request: Request) {
  const runtime = runtimeEnv() as Record<string, unknown>;
  if (runtime.QUEUEPROOF_PUBLIC_ACCESS !== "true") {
    return noStoreJson({ error: "The QueueProof public demo is unavailable." }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    let parsedOrigin: string;
    try {
      parsedOrigin = new URL(origin).origin;
    } catch {
      return noStoreJson({ error: "Origin is not allowed." }, { status: 403 });
    }
    if (parsedOrigin !== requestUrl.origin) {
      return noStoreJson({ error: "Origin is not allowed." }, { status: 403 });
    }
  }

  const workspace = await workspaceForUser(PUBLIC_ACTOR_ID);
  if (!workspace) {
    return noStoreJson(
      { error: "The QueueProof public workspace is not provisioned." },
      { status: 503 },
    );
  }
  const workspaceId = String(workspace.id);
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
