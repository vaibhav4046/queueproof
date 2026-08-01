import { redactSecrets } from "../../packages/security/src";

export function noStoreJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  const message = redactSecrets(error instanceof Error ? error.message : "Unexpected server error.");
  return noStoreJson({ ok: false, error: message }, { status: 500 });
}

/** A JSON request body large enough for any legitimate QueueProof payload. */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Response("Content-Type must be application/json.", { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new Response("Request body is too large.", { status: 413 });
  }

  const raw = await request.text();
  // Content-Length can be absent or wrong, so the actual body is measured too.
  if (raw.length > MAX_JSON_BODY_BYTES) {
    throw new Response("Request body is too large.", { status: 413 });
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Malformed JSON is a client error. Previously this propagated as an unhandled
    // SyntaxError and surfaced as a 500, which reports a caller mistake as a server
    // fault and makes real faults harder to spot in logs.
    throw new Response("Request body is not valid JSON.", { status: 400 });
  }
}

