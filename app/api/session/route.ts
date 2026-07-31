import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  accessTokenMatches,
  createSessionValue,
  getRequestActor,
  signInConfigured,
} from "../../../lib/server/identity";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Report whether sign-in is possible and who (if anyone) is currently signed in. */
export async function GET() {
  const actor = await getRequestActor();
  return Response.json(
    {
      ok: true,
      signInConfigured: signInConfigured(),
      actor: actor ? { displayName: actor.displayName, localDevelopment: actor.localDevelopment } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Exchange the deployment access token for a signed, httpOnly session cookie.
 * The token is never stored client-side and never echoed back.
 */
export async function POST(request: Request) {
  if (!signInConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "Sign-in is not configured on this deployment. Set QUEUEPROOF_ACCESS_TOKEN (minimum 16 characters).",
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
