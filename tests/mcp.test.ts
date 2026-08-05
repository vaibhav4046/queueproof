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

  it("normalizes a same-day ISO expiry before comparing it with SQLite time", async () => {
    const db = requireDb();
    const clock = await db.prepare(
      `SELECT strftime('%Y-%m-%dT00:00:00.000Z', 'now') AS expiresAt,
              strftime('%Y-%m-%dT00:00:00.000Z', 'now') > CURRENT_TIMESTAMP AS lexicalFuture,
              datetime(strftime('%Y-%m-%dT00:00:00.000Z', 'now')) <= CURRENT_TIMESTAMP AS actuallyExpired`,
    ).first<{ expiresAt: string; lexicalFuture: number; actuallyExpired: number }>();
    expect(clock).not.toBeNull();
    expect(clock?.lexicalFuture).toBe(1);
    expect(clock?.actuallyExpired).toBe(1);

    const secret = "qp_live_same-day-expired-token-0000";
    await insertToken(secret, { expiresAt: clock?.expiresAt });
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

  it("records tool activity only for tools/call, not initialize or tools/list", async () => {
    const secret = "qp_live_tool-activity-token-000000";
    const { clientId } = await insertToken(secret);
    const db = requireDb();
    const activity = () => db.prepare(
      `SELECT last_handshake_at AS lastHandshakeAt, last_tool_call_at AS lastToolCallAt
       FROM mcp_clients WHERE id = ?`,
    ).bind(clientId).first<{ lastHandshakeAt: string | null; lastToolCallAt: string | null }>();

    expect(await activity()).toMatchObject({ lastHandshakeAt: null, lastToolCallAt: null });

    const initialize = await callMcpRequest(secret, 10, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "vitest-activity", version: "1" },
    });
    expect(initialize.status).toBe(200);
    expect(await activity()).toMatchObject({
      lastHandshakeAt: expect.any(String),
      lastToolCallAt: null,
    });

    const list = await callMcpRequest(secret, 11, "tools/list", {});
    expect(list.status).toBe(200);
    expect(await activity()).toMatchObject({ lastToolCallAt: null });

    const call = await callMcpTool(secret, 12, "queueproof_health", {});
    expect(call.status).toBe(200);
    expect(await activity()).toMatchObject({ lastToolCallAt: expect.any(String) });
  });

  it("keeps /api/mcp as an exact compatibility alias for canonical /mcp", async () => {
    const canonical = await import("../app/mcp/route");
    const compatibility = await import("../app/api/mcp/route");
    expect(compatibility.GET).toBe(canonical.GET);
    expect(compatibility.POST).toBe(canonical.POST);
    expect(compatibility.DELETE).toBe(canonical.DELETE);
  });

  it("chains a ranked next action to its workspace-owned execution packet", async () => {
    const secret = "qp_live_packet-chain-token-000000";
    const { workspaceId } = await insertToken(secret);
    const db = requireDb();
    const rankingRunId = createId("ranking");
    const taskId = createId("task");
    const packetId = createId("packet");
    const policyVersion = "queueproof-mcp-chain-test-1";
    const packet = {
      packet_id: packetId,
      workspace_id: workspaceId,
      task: { title: "Create the incident follow-up" },
      policy_version: policyVersion,
    };

    await db.batch([
      db.prepare(
        `INSERT INTO ranking_runs
         (id, workspace_id, policy_version, input_hash, started_at, completed_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ).bind(rankingRunId, workspaceId, policyVersion, "mcp-chain-input"),
      db.prepare(
        `INSERT INTO task_candidates
         (id, workspace_id, title, recommended_action, status, attributes_json, confidence)
         VALUES (?, ?, ?, ?, 'open', '{}', 94)`,
      ).bind(taskId, workspaceId, "Create the incident follow-up", "create_issue"),
      db.prepare(
        `INSERT INTO ranking_items
         (id, workspace_id, ranking_run_id, task_id, rank, component_scores_json,
          penalties_json, final_score, confidence, explanation_json, sensitivity_json)
         VALUES (?, ?, ?, ?, 1, '{}', '{}', 92, 94, '[]', '{}')`,
      ).bind(createId("ranked"), workspaceId, rankingRunId, taskId),
      db.prepare(
        `INSERT INTO execution_packets
         (id, workspace_id, task_id, policy_version, packet_json, status)
         VALUES (?, ?, ?, ?, ?, 'available')`,
      ).bind(packetId, workspaceId, taskId, policyVersion, JSON.stringify(packet)),
    ]);

    const nextResponse = await callMcpTool(secret, 20, "queueproof_get_next_actions", { limit: 10 });
    expect(nextResponse.status).toBe(200);
    const nextRpc = parseMcpResponse(await nextResponse.text());
    const nextItems = nextRpc.result?.structuredContent?.items as Array<Record<string, unknown>>;
    expect(nextItems).toHaveLength(1);
    expect(nextItems[0].packetId).toBe(packetId);

    const packetResponse = await callMcpTool(secret, 21, "queueproof_get_execution_packet", {
      packetId: nextItems[0].packetId,
    });
    expect(packetResponse.status).toBe(200);
    const packetRpc = parseMcpResponse(await packetResponse.text());
    expect(packetRpc.result?.structuredContent?.packet).toEqual(packet);
  });
});

async function callMcpTool(
  secret: string,
  id: number,
  name: string,
  args: Record<string, unknown>,
) {
  return callMcpRequest(secret, id, "tools/call", { name, arguments: args });
}

async function callMcpRequest(
  secret: string,
  id: number,
  method: string,
  params: Record<string, unknown>,
) {
  const { POST } = await import("../app/mcp/route");
  return POST(
    new Request("https://queueproof.example/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }),
    }),
  );
}

function parseMcpResponse(body: string) {
  const trimmed = body.trim();
  const json = trimmed.startsWith("{")
    ? trimmed
    : trimmed
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .at(-1);
  if (!json) throw new Error(`MCP response did not contain JSON: ${trimmed.slice(0, 200)}`);
  return JSON.parse(json) as {
    result?: { structuredContent?: Record<string, unknown> };
  };
}

async function insertToken(
  secret: string,
  options: { revoked?: boolean; expired?: boolean; audience?: string; expiresAt?: string } = {},
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
      options.expiresAt ?? (options.expired ? "2000-01-01 00:00:00" : "2999-01-01 00:00:00"),
      options.revoked ? "2024-01-01 00:00:00" : null,
    )
    .run();
  return { workspaceId, clientId };
}
