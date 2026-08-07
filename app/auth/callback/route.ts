import { NextResponse } from "next/server";
import { createQueueProofServerClient } from "../../../lib/server/supabase";

function safeNext(raw: string | null): string {
  return raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const client = await createQueueProofServerClient();
  if (!client || !code) {
    return NextResponse.redirect(new URL("/sign-in?error=callback", url.origin));
  }
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(
    new URL(error ? "/sign-in?error=callback" : next, url.origin),
  );
}
