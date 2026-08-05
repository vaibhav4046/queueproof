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
      // The public developer screen is the canonical, maintained setup contract. Pointing
      // at a non-existent /docs/mcp route made standards-based discovery advertise a 404.
      resource_documentation: `${origin}/developer`,
    },
    {
      status: issuer ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
