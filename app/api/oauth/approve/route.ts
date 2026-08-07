import { issueAuthorizationCode, parseAuthorizationRequest } from "../../../../lib/server/oauth-provider";
import { requireRequestActor } from "../../../../lib/server/identity";
import { requireOwnerWorkspaceForUser } from "../../../../lib/server/store";
import { canonicalOrigin } from "../../../../lib/server/oauth-http";

/**
 * Consent decision handler.
 *
 * This is the one endpoint in the OAuth flow that acts on an ambient browser session,
 * which makes it the one endpoint that needs CSRF protection: without it, a page on any
 * other site could auto-submit a form here and walk away with a code minted against the
 * victim's workspace. The `Origin` header is the control — browsers attach it to every
 * cross-site POST and cannot be talked out of it by script — so a missing or foreign
 * origin is refused outright rather than merely logged.
 */
export async function POST(request: Request) {
  const expectedOrigin = canonicalOrigin(request);
  const origin = request.headers.get("origin");
  if (!origin || origin !== expectedOrigin) {
    return new Response("Cross-site authorization requests are refused.", { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return new Response("Malformed consent submission.", { status: 400 });

  const query = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && key !== "decision") query.set(key, value);
  }

  let authorization: Awaited<ReturnType<typeof parseAuthorizationRequest>>;
  try {
    authorization = await parseAuthorizationRequest(query);
  } catch {
    return Response.redirect(`${expectedOrigin}/developer?oauth=invalid_request`, 303);
  }

  const separator = authorization.redirectUri.includes("?") ? "&" : "?";
  const stateSuffix = authorization.state ? `&state=${encodeURIComponent(authorization.state)}` : "";

  if (form.get("decision") !== "approve") {
    return Response.redirect(`${authorization.redirectUri}${separator}error=access_denied${stateSuffix}`, 303);
  }

  try {
    const actor = await requireRequestActor();
    const workspace = await requireOwnerWorkspaceForUser(actor.id);
    const code = await issueAuthorizationCode({
      request: authorization,
      workspaceId: String(workspace.id),
      userId: actor.id,
    });
    return Response.redirect(
      `${authorization.redirectUri}${separator}code=${encodeURIComponent(code)}${stateSuffix}`,
      303,
    );
  } catch {
    return Response.redirect(
      `${authorization.redirectUri}${separator}error=server_error${stateSuffix}`,
      303,
    );
  }
}
