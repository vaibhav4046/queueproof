import { QUEUEPROOF_MCP_SCOPES } from "../../../../lib/server/mcp-auth";
import { canonicalOrigin, oauthJson, oauthPreflight } from "../../../../lib/server/oauth-http";

/**
 * RFC 9728 protected-resource metadata for the authenticated MCP endpoint.
 *
 * This used to advertise Supabase as the authorization server and answer 503 whenever that
 * configuration was absent — which told every standards-compliant client that QueueProof
 * had no way to authenticate at all. QueueProof now runs its own authorization server on
 * this same origin, so the answer is unconditional and points at us.
 */
export async function GET(request: Request) {
  const origin = canonicalOrigin(request);
  return oauthJson({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: [...QUEUEPROOF_MCP_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/developer`,
  });
}

export async function OPTIONS() {
  return oauthPreflight();
}
