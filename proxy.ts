import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig, supabaseWebEnabled } from "./lib/server/supabase";
import { SESSION_COOKIE } from "./lib/server/identity";

export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  if (!config || !supabaseWebEnabled()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.publishableKey, {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
  // getClaims verifies the access token and refreshes expiring cookie state when needed.
  await client.auth.getClaims();

  // Hybrid logout clears both identity mechanisms, so a stale owner cookie cannot
  // silently elevate the browser after the Supabase session is gone.
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
