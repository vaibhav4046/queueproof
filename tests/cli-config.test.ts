import { describe, expect, it } from "vitest";
import {
  CANONICAL_MCP_PATH,
  canonicalMcpEndpoint,
  clientEntry,
  mergeClientJson,
  projectConfigPath,
} from "../cli/config.mjs";

describe("agent client installers", () => {
  it.each(["codex", "claude", "kimi", "kilo"])("generates %s config without a plaintext token", (client) => {
    const value = JSON.stringify(clientEntry(client, "https://queueproof.example/mcp"));
    expect(value).toContain("QUEUEPROOF_MCP_TOKEN");
    expect(value).not.toContain("secret-value");
    expect(Object.keys(projectConfigPath)).toContain(client);
  });
  it("preserves unrelated JSON MCP servers and settings", () => {
    const merged = mergeClientJson(
      { theme: "dark", mcpServers: { existing: { url: "https://existing.example" } } },
      clientEntry("kimi", "https://queueproof.example/mcp"),
    );
    expect(merged.theme).toBe("dark");
    expect(merged.mcpServers.existing).toBeDefined();
    expect(merged.mcpServers.queueproof).toBeDefined();
  });

  it("uses Kilo's current remote MCP schema and trusted environment interpolation", () => {
    expect(clientEntry("kilo", "https://queueproof.example/mcp", "QP_TOKEN")).toEqual({
      mcp: {
        queueproof: {
          type: "remote",
          url: "https://queueproof.example/mcp",
          enabled: true,
          headers: { Authorization: "Bearer {env:QP_TOKEN}" },
        },
      },
    });
  });

  it("builds the canonical endpoint without a duplicate slash", () => {
    expect(CANONICAL_MCP_PATH).toBe("/mcp");
    expect(canonicalMcpEndpoint("https://queueproof.example/")).toBe(
      "https://queueproof.example/mcp",
    );
  });
});
