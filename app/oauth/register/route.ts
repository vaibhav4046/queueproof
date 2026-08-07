import { registerClient } from "../../../lib/server/oauth-provider";
import { canonicalOrigin, oauthErrorResponse, oauthJson, oauthPreflight } from "../../../lib/server/oauth-http";

/**
 * RFC 7591 dynamic client registration.
 *
 * Registration is open and unauthenticated, which is what MCP clients require: Claude
 * and ChatGPT connectors have no way to pre-arrange a client_id with an arbitrary
 * server. Openness is acceptable because a registration on its own grants nothing — the
 * resulting client_id is inert until a signed-in human approves it on the consent
 * screen, and the token that follows is scoped to that person's workspace alone.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const client = await registerClient({
      clientName: payload.client_name,
      redirectUris: payload.redirect_uris,
    });
    const origin = canonicalOrigin(request);
    return oauthJson(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(new Date(client.registeredAt).getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "queueproof:read queueproof:propose queueproof:sync",
        registration_client_uri: `${origin}/oauth/register`,
      },
      201,
    );
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return oauthPreflight();
}
