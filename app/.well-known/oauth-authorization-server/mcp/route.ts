import { authorizationServerMetadata } from "../../../../lib/server/oauth-provider";
import { canonicalOrigin, oauthJson, oauthPreflight } from "../../../../lib/server/oauth-http";

/**
 * RFC 8414 path-insertion variant. A client that discovered the resource at
 * `/mcp` looks for its authorization server at `/.well-known/oauth-authorization-server/mcp`
 * before falling back to the bare well-known path. Serving both means discovery
 * succeeds on the first probe instead of after a 404.
 */
export async function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(canonicalOrigin(request)));
}

export async function OPTIONS() {
  return oauthPreflight();
}
