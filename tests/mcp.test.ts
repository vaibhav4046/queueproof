import { describe, expect, it } from "vitest";
import { buildQueueProofServer } from "../packages/mcp/src/server";

describe("QueueProof MCP", () => {
  it("constructs a workspace-scoped server without network access", () => {
    expect(buildQueueProofServer("ws-test")).toBeDefined();
  });
  it("keeps the remote endpoint disabled unless bearer and workspace are configured", async () => {
    const { POST } = await import("../app/mcp/route");
    const response = await POST(new Request("https://queueproof.example/mcp", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
