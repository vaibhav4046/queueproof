import { describe, expect, it } from "vitest";
import { clientEntry, mergeClientJson, projectConfigPath } from "../cli/config.mjs";

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
});
