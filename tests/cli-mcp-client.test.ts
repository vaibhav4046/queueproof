import { describe, expect, it, vi } from "vitest";
import { callMcp, parseMcpResponse, tokenSetupInstructions, verifyMcp } from "../cli/mcp-client.mjs";

describe("CLI MCP client", () => {
  it("parses JSON and Streamable HTTP event responses", () => {
    expect(parseMcpResponse('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}').result.ok).toBe(true);
    expect(parseMcpResponse('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n').result.ok).toBe(true);
  });

  it("never accepts a missing environment token", async () => {
    await expect(callMcp({ endpoint: "https://queueproof.example/mcp", token: "", method: "tools/list" }))
      .rejects.toThrow("QUEUEPROOF_MCP_TOKEN is missing");
    expect(tokenSetupInstructions()).toContain("$env:QUEUEPROOF_MCP_TOKEN");
    expect(tokenSetupInstructions()).toContain("export QUEUEPROOF_MCP_TOKEN");
  });

  it("performs a real initialize and tools/list verification sequence", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      const result = request.method === "initialize"
        ? { protocolVersion: "2025-11-25", serverInfo: { name: "queueproof", version: "1" } }
        : { tools: [{ name: "queueproof_health" }, { name: "queueproof_ask" }] };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const result = await verifyMcp({ endpoint: "https://queueproof.example/mcp", token: "qp_live_test", fetchImpl });
    expect(result).toMatchObject({ connected: true, protocolVersion: "2025-11-25", tools: ["queueproof_health", "queueproof_ask"] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer qp_live_test" });
  });
});
