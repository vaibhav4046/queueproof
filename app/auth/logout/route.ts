import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/server/identity";
import { createQueueProofServerClient } from "../../../lib/server/supabase";

export async function GET(request: Request) {
  const client = await createQueueProofServerClient();
  if (client) await client.auth.signOut({ scope: "local" });
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
  });
  return NextResponse.redirect(new URL("/", request.url));
}
