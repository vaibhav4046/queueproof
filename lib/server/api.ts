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

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Response("Content-Type must be application/json.", { status: 415 });
  }
  return (await request.json()) as T;
}

