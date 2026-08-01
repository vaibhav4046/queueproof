import { describe, expect, it } from "vitest";
import { MAX_JSON_BODY_BYTES, readJson } from "../lib/server/api";

/**
 * Regression tests for defects found by adversarially probing a running instance.
 *
 * Each one was observed on a real production build before it was fixed:
 *  - malformed JSON surfaced as HTTP 500, reporting a caller mistake as a server fault
 *  - a 2 MB commitment summary was accepted and stored with HTTP 201
 */
function jsonRequest(body: string, contentLength?: number): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (contentLength !== undefined) headers["Content-Length"] = String(contentLength);
  return new Request("https://queueproof.example/api/actions", { method: "POST", body, headers });
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    if (error instanceof Response) return error.status;
    throw error;
  }
}

describe("readJson", () => {
  it("parses a valid body", async () => {
    await expect(readJson<{ a: number }>(jsonRequest('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it("rejects malformed JSON as a client error, not a server error", async () => {
    // Previously this threw a raw SyntaxError and surfaced as 500.
    expect(await statusOf(readJson(jsonRequest("{broken")))).toBe(400);
  });

  it("rejects a body over the size limit", async () => {
    const oversized = JSON.stringify({ summary: "A".repeat(MAX_JSON_BODY_BYTES + 10) });
    expect(await statusOf(readJson(jsonRequest(oversized)))).toBe(413);
  });

  it("rejects an oversized body even when Content-Length understates it", async () => {
    // Content-Length is caller-supplied, so the actual body must be measured too.
    const oversized = JSON.stringify({ summary: "A".repeat(MAX_JSON_BODY_BYTES + 10) });
    expect(await statusOf(readJson(jsonRequest(oversized, 10)))).toBe(413);
  });

  it("rejects a body declared oversized before reading it", async () => {
    expect(await statusOf(readJson(jsonRequest('{"a":1}', MAX_JSON_BODY_BYTES + 1)))).toBe(413);
  });

  it("requires a JSON content type", async () => {
    const request = new Request("https://queueproof.example/api/actions", {
      method: "POST",
      body: "a=1",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(await statusOf(readJson(request))).toBe(415);
  });
});
