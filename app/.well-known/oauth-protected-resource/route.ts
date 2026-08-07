import { QUEUEPROOF_MCP_SCOPES } from "../../../lib/server/mcp-auth";
import { canonicalOrigin, oauthJson, oauthPreflight } from "../../../lib/server/oauth-http";

/**
 * Root-path variant of the protected-resource document.
 *
 * Clients disagree about where to look: some append the resource path to `.well-known`,
 * others probe the bare origin first. Serving both spellings means discovery succeeds on
 * the first request instead of after a 404 that some clients treat as fatal.
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
