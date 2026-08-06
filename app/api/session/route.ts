import { cookies } from "next/headers";
import {
  DEPLOYMENT_OWNER_ACTOR_ID,
  SESSION_COOKIE,
  accessTokenMatches,
  auth0SignInConfigured,
  createSessionValue,
  getRequestActor,
  legacySignInConfigured,
  signInConfigured,
} from "../../../lib/server/identity";
import { requireDb, runtimeEnv } from "../../../lib/server/runtime";
import {
  createId,
  enforcePublicRateLimit,
  workspaceForUser,
} from "../../../lib/server/store";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Report whether sign-in is possible and who (if anyone) is currently signed in. */
export async function GET() {
  const actor = await getRequestActor();
  return Response.json(
    {
      ok: true,
      signInConfigured: signInConfigured(),
      auth0Configured: auth0SignInConfigured(),
      legacySignInConfigured: legacySignInConfigured(),
      actor: actor ? {
        displayName: actor.displayName,
        localDevelopment: actor.localDevelopment,
        publicAccess: actor.id === "user:public-access",
        owner: actor.id === DEPLOYMENT_OWNER_ACTOR_ID,
        authType: actor.authType,
        emailVerified: actor.emailVerified === true,
      } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Exchange the deployment access token for a signed, httpOnly session cookie.
 * The token is never stored client-side and never echoed back.
 */
export async function POST(request: Request) {
  if (!legacySignInConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Legacy owner sign-in is not configured on this deployment. Use Auth0 sign-in instead.",
      },
      { status: 503 },
    );
  }

  let accessToken = "";
  let email = "owner@queueproof.local";
  try {
    const body = (await request.json()) as { accessToken?: unknown; email?: unknown };
    accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
    if (typeof body.email === "string" && body.email.includes("@") && body.email.length <= 254) {
      email = body.email;
    }
  } catch {
    return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  // Sign-in is internet-facing even when the rest of the control plane is private.
  // Reuse the signed anonymous-client bucket and retain a deployment-wide ceiling so
  // one visitor cannot lock every judge out and distributed guessing remains bounded.
  let publicWorkspace: Record<string, unknown> | null = null;
  try {
    if (runtimeEnv().DB) {
      publicWorkspace = await workspaceForUser("user:public-access");
      if (publicWorkspace) {
        await enforcePublicRateLimit({
          actorId: "user:public-access",
          workspaceId: String(publicWorkspace.id),
          operation: "session.sign_in",
          limit: 8,
          globalLimit: 80,
          windowMs: 10 * 60_000,
        });
      }
    }
  } catch (error) {
    if (error instanceof Response) {
      return Response.json(
        { ok: false, error: await error.text() },
        {
          status: error.status,
          headers: error.headers.get("Retry-After")
            ? { "Retry-After": error.headers.get("Retry-After")! }
            : undefined,
        },
      );
    }
    throw error;
  }

  if (!accessTokenMatches(accessToken)) {
    // Uniform message and status: do not reveal whether the token length or value was wrong.
    return Response.json({ ok: false, error: "Invalid access token." }, { status: 401 });
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const value = await createSessionValue(email, expiresAt);
  if (!value) {
    return Response.json(
      { ok: false, error: "QUEUEPROOF_ENCRYPTION_KEY must be set before sessions can be issued." },
      { status: 503 },
    );
  }

  // Possession of the deployment access token is the owner credential. Link its stable
  // actor id to the deliberately configured public workspace so the resulting session
  // can actually reach connector, upload, MCP, and approval management. The optional
  // email remains a display label and cannot select another tenant.
  if (publicWorkspace) {
    const db = requireDb();
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`,
        )
        .bind(DEPLOYMENT_OWNER_ACTOR_ID, "deployment-owner@queueproof.local", email),
      db
        .prepare(
          `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role)
           VALUES (?, ?, ?, 'owner')`,
        )
        .bind(createId("member"), String(publicWorkspace.id), DEPLOYMENT_OWNER_ACTOR_ID),
    ]);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return Response.json({ ok: true, expiresAt: new Date(expiresAt).toISOString() });
}

/** Sign out by clearing the session cookie. */
export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
