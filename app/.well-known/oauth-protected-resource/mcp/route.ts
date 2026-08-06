import {
  mcpOAuthConfig,
  QUEUEPROOF_MCP_RESOURCE,
  QUEUEPROOF_MCP_SCOPES,
} from "../../../../lib/server/mcp-auth";

export async function GET() {
  const oauth = mcpOAuthConfig();
  return Response.json(
    {
      resource: oauth?.resource ?? QUEUEPROOF_MCP_RESOURCE,
      ...(oauth ? { authorization_servers: [oauth.issuer] } : {}),
      scopes_supported: [...QUEUEPROOF_MCP_SCOPES],
      bearer_methods_supported: ["header"],
      // The public developer screen is the canonical, maintained setup contract. Pointing
      // at a non-existent /docs/mcp route made standards-based discovery advertise a 404.
      resource_documentation: "https://queueproof.vercel.app/developer",
    },
    {
      status: oauth ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    },
  );
}
