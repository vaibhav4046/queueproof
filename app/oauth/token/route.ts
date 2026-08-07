import { OAuthError, redeemAuthorizationCode } from "../../../lib/server/oauth-provider";
import { runtimeEnv } from "../../../lib/server/runtime";
import {
  oauthErrorResponse,
  oauthJson,
  oauthPreflight,
  readOAuthBody,
} from "../../../lib/server/oauth-http";

export async function POST(request: Request) {
  try {
    const body = await readOAuthBody(request);
    if (body.grant_type !== "authorization_code") {
      throw new OAuthError(
        "unsupported_grant_type",
        "Only grant_type=authorization_code is supported.",
      );
    }
    // The audience must match what `/mcp` checks when it looks the token up, otherwise a
    // token minted here would verify as a stranger's and be rejected on first use.
    const audience = runtimeEnv().QUEUEPROOF_MCP_AUDIENCE?.trim() || "queueproof-mcp";
    const issued = await redeemAuthorizationCode({
      code: body.code ?? "",
      clientId: body.client_id ?? "",
      redirectUri: body.redirect_uri ?? "",
      codeVerifier: body.code_verifier ?? "",
      audience,
    });
    return oauthJson({
      access_token: issued.accessToken,
      token_type: "Bearer",
      expires_in: issued.expiresInSeconds,
      scope: issued.scopes.join(" "),
    });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return oauthPreflight();
}
