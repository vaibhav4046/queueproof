import { authorizationServerMetadata } from "../../../lib/server/oauth-provider";
import { canonicalOrigin, oauthJson, oauthPreflight } from "../../../lib/server/oauth-http";

export async function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(canonicalOrigin(request)));
}

export async function OPTIONS() {
  return oauthPreflight();
}
