import { authorizationServerMetadata } from "../../../lib/server/oauth-provider";
import { canonicalOrigin, oauthJson, oauthPreflight } from "../../../lib/server/oauth-http";

/**
 * Some MCP clients probe the OpenID Connect discovery path first and only fall back to
 * RFC 8414. QueueProof is not an OpenID Provider — it issues no ID tokens — so this
 * serves the same OAuth metadata rather than claiming OIDC support it does not have.
 */
export async function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(canonicalOrigin(request)));
}

export async function OPTIONS() {
  return oauthPreflight();
}
