import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuth0Client } from "./lib/server/auth0";
import { SESSION_COOKIE } from "./lib/server/identity";

export async function proxy(request: NextRequest) {
  const client = getAuth0Client();
  if (!client) return NextResponse.next();

  const response = await client.middleware(request);
  // Hybrid logout must clear both identity mechanisms. Otherwise an old owner cookie
  // silently re-elevates the browser immediately after Auth0 reports a successful logout.
  if (request.nextUrl.pathname === "/auth/logout") {
    response.cookies.set(SESSION_COOKIE, "", {
      expires: new Date(0),
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|queueproof-favicon|queueproof-icon|queueproof-apple-touch-icon|manifest.webmanifest|sitemap.xml|robots.txt).*)",
  ],
};
