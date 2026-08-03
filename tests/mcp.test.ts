import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildQueueProofServer } from "../packages/mcp/src/server";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";
import { sha256 } from "../packages/security/src";

/**
 * The previous version of this file asserted that POSTing to /mcp with no credentials
 * returned 503. That only held because the test shim supplied no database, so the route
 * short-circuited at its "not configured" branch. With storage present — the real
 * deployed case — an unauthenticated request is rejected with 401 by the fail-closed
 * check further down. The old assertion pinned an artefact of the test harness rather
 * than deployed behaviour, and no test ever reached a tool handler.
 */
describe("QueueProof MCP", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("constructs a workspace-scoped server without network access", () => {
    expect(buildQueueProofServer("ws-test")).toBeDefined();
  });

  it("registers only tools whose backing tables exist", () => {
    // Ten tools previously queried tables that ensureCoreSchema() never creates, so they
    // threw "no such table" at runtime. Guard against reintroducing one.
    const server = buildQueueProofServer("ws-test") as unknown as {
      _registeredTools?: Record<string, unknown>;
    };
    const registered = Object.keys(server._registeredTools ?? {});
    expect(registered.length).toBeGreaterThan(0);
    for (const removed of [
      "queueproof_detect_conflicts",
      "queueproof_find_commitments",
      "queueproof_find_untracked_commitments",
      "queueproof_list_skills",
      "queueproof_get_entity",
      "queueproof_get_entity_timeline",
      "queueproof_run_evaluation",
      "queueproof_activate_skill",
    ]) {
      expect(registered, `${removed} has no backing table and must not be registered`).not.toContain(
        removed,
      );
    }
    expect(registered).toContain("queueproof_list_connectors");
    expect(registered).toContain("queueproof_propose_action");
    const source = readFileSync(new URL("../packages/mcp/src/server.ts", import.meta.url), "utf8");
    expect(source).toContain('provider: z.literal("linear")');
    expect(source).toContain('actionType: z.literal("create_issue")');
    expect(source).toContain("source_references");
    expect(source).toContain("ri.final_score > 0");
    expect(source).toContain("ri.ranking_run_id = (");
  });

  it("rejects an unauthenticated request fail-closed", async () => {
    const { POST } = await import("../app/mcp/route");
    const response = await POST(new Request("https://queueproof.example/mcp", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("rejects a bearer token that matches no stored token", async () => {
    const { POST } = await import("../app/mcp/route");
    const response = await POST(
      new Request("https://queueproof.example/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer qp_live_not-a-real-token" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a stored token that has been revoked", async () => {
    const secret = "qp_live_revoked-token-value-000000";
    await insertToken(secret, { revoked: true });
    const { POST } = await import("../app/mcp/route");
    const response = await POST(
      new Request("https://queueproof.example/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a stored token that has expired", async () => {
    const secret = "qp_live_expired-token-value-000000";
    await insertToken(secret, { expired: true });
    const { POST } = await import("../app/mcp/route");
    const response = await POST(
      new Request("https://queueproof.example/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a stored token issued for another audience", async () => {
    const secret = "qp_live_wrong-audience-token-value-0000";
    await insertToken(secret, { audience: "another-service" });
    const { POST } = await import("../app/mcp/route");
    const response = await POST(
      new Request("https://queueproof.example/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("accepts a valid stored token and answers a JSON-RPC request", async () => {
    const secret = "qp_live_valid-token-value-00000000";
    await insertToken(secret);
    const { POST } = await import("../app/mcp/route");
    const response = await POST(
      new Request("https://queueproof.example/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "vitest", version: "1" },
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("queueproof");
  });
});

async function insertToken(
  secret: string,
  options: { revoked?: boolean; expired?: boolean; audience?: string } = {},
) {
  const db = requireDb();
  const workspaceId = createId("ws");
  const clientId = createId("mcp_client");
  await db
    .prepare("INSERT INTO mcp_clients (id, workspace_id, client_type, scopes_json) VALUES (?, ?, ?, ?)")
    .bind(clientId, workspaceId, "vitest", JSON.stringify(["queueproof:read"]))
    .run();
  await db
    .prepare(
      `INSERT INTO mcp_tokens (id, workspace_id, client_id, token_hash, audience, scopes_json, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      createId("mcp_token"),
      workspaceId,
      clientId,
      await sha256(secret),
      options.audience ?? "queueproof-mcp",
      JSON.stringify(["queueproof:read"]),
      options.expired ? "2000-01-01 00:00:00" : "2999-01-01 00:00:00",
      options.revoked ? "2024-01-01 00:00:00" : null,
    )
    .run();
  return { workspaceId, clientId };
}
