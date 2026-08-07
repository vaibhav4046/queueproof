import { describe, expect, it } from "vitest";
import { apiError } from "../lib/server/api";

describe("API error boundary", () => {
  it("preserves deliberate client responses", async () => {
    const intended = new Response("Request body is not valid JSON.", { status: 400 });
    const response = apiError(intended);
    expect(response).toBe(intended);
    expect(response.status).toBe(400);
  });

  it("does not expose provider, schema, or credential text from unexpected errors", async () => {
    const response = apiError(new Error(
      "libSQL statement failed: no such column private_field client_secret=do-not-leak",
    ));

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toMatch(/no-store/i);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unexpected server error.",
    });
  });
});
