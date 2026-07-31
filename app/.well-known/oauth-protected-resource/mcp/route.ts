import { runtimeEnv } from "../../../../lib/server/runtime";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const issuer = runtimeEnv().QUEUEPROOF_OAUTH_ISSUER;
  return Response.json(
    {
      resource: `${origin}/mcp`,
      ...(issuer ? { authorization_servers: [issuer] } : {}),
      scopes_supported: ["queueproof:read", "queueproof:propose", "queueproof:sync"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${origin}/docs/mcp`,
    },
    {
      status: issuer ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

