import { runtimeEnv } from "../../../lib/server/runtime";

const CHALLENGE_PATTERN = /^[\u0021-\u007e]{8,2048}$/;

/**
 * OpenAI's publication portal supplies this value during domain verification.
 * The endpoint intentionally returns only the exact token, never JSON or diagnostics.
 */
export async function GET() {
  const challenge = runtimeEnv().OPENAI_APPS_CHALLENGE?.trim() ?? "";
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };

  if (!challenge) {
    return new Response("Not configured", { status: 404, headers });
  }
  if (!CHALLENGE_PATTERN.test(challenge)) {
    return new Response("Invalid configuration", { status: 503, headers });
  }
  return new Response(challenge, { status: 200, headers });
}
