import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

/**
 * Mirrors tests/management-route-authz.test.ts for the static-source-scan half, and
 * tests/documents.test.ts / tests/actions.test.ts for the functional half — this
 * repo's test suite calls route GET/POST handlers directly against the real D1-shaped
 * database from tests/cloudflare-workers.ts (a :memory: SQLite instance, fresh per test
 * file), not via a mocked Request/session harness.
 *
 * The three describe blocks below are siblings, not nested, and deliberately so:
 * vitest runs every beforeAll in a describe block before any of that block's `it`s,
 * regardless of where the `it` is written relative to a later beforeAll — so the
 * "actor has no workspace yet" case has to live in its own block that seeds nothing,
 * ahead of the block that gives the local-development actor a workspace.
 */

const localUserId = "user:local-development";

async function withLocalIdentity<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY;
  process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY = "true";
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY;
    else process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY = previous;
  }
}

function buildPacket(options: { workspaceId: string; sourceId: string; title: string; packetId: string }) {
  return {
    packet_id: options.packetId,
    workspace_id: options.workspaceId,
    created_at: new Date().toISOString(),
    policy_version: "queueproof-default-2.0.0",
    task: {
      title: options.title,
      objective: options.title,
      owner: null,
      project: null,
      deadline: null,
      priority_score: 50,
      confidence: 0.5,
    },
    why_now: [],
    constraints: [],
    dependencies: [],
    acceptance_criteria: [],
    evidence: [
      {
        sourceId: options.sourceId,
        provider: "linear",
        externalId: options.sourceId,
        title: options.title,
        excerpt: options.title,
        timestamp: null,
        ingestionTimestamp: null,
        url: null,
        authority: "primary",
        metadata: {},
      },
    ],
    contradictions: [],
    missing_information: [],
    score_breakdown: {},
    penalties: {},
    active_formula: "",
    recommended_safe_action: "Review the cited evidence before taking action.",
    provider_coverage: ["linear"],
    deduplicated_tasks: [],
    status: "open",
    recommended_agent: "human",
    permissions: { read: ["linear"], write: [], approval_required: true },
    completion_callback: { type: "mcp_tool", tool: "queueproof_report_execution_result" },
  };
}

/**
 * Seeds one workspace's queue with one or more ranked items, all under a single
 * ranking_run — matching how lib/server/queue.ts's generateQueueForWorkspace ranks a
 * whole batch under one rankingRunId per generation. listQueueForWorkspace only reads
 * the single latest ranking_run for a workspace, so items meant to appear together in
 * one GET must share that run.
 */
async function seedWorkspaceQueue(options: {
  workspaceId: string;
  items: Array<{ taskId: string; sourceId: string; title: string }>;
  members?: { userId: string }[];
}) {
  const db = requireDb();
  const rankingRunId = createId("ranking");

  const memberStatements = (options.members ?? []).flatMap((member) => [
    db.prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
      .bind(member.userId, `${member.userId.replace(/[^a-z0-9]/gi, "")}@example.invalid`, member.userId),
    db.prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')")
      .bind(createId("member"), options.workspaceId, member.userId),
  ]);

  const itemStatements = options.items.flatMap((item, index) => {
    const packetId = createId("packet");
    const packet = buildPacket({ workspaceId: options.workspaceId, sourceId: item.sourceId, title: item.title, packetId });
    return [
      db.prepare(
        `INSERT INTO task_candidates
         (id, workspace_id, title, recommended_action, owner, project, customer, deadline, status, attributes_json, confidence)
         VALUES (?, ?, ?, 'execute', NULL, NULL, NULL, NULL, 'open', '{}', 50)`,
      ).bind(item.taskId, options.workspaceId, item.title),
      db.prepare(
        `INSERT INTO ranking_items
         (id, workspace_id, ranking_run_id, task_id, rank, component_scores_json, penalties_json, final_score, confidence, explanation_json, sensitivity_json)
         VALUES (?, ?, ?, ?, ?, '{}', '{}', 50, 50, '[]', '{}')`,
      ).bind(createId("ranked"), options.workspaceId, rankingRunId, item.taskId, index + 1),
      db.prepare(
        `INSERT INTO execution_packets (id, workspace_id, task_id, policy_version, packet_json, status)
         VALUES (?, ?, ?, ?, ?, 'available')`,
      ).bind(packetId, options.workspaceId, item.taskId, "queueproof-default-2.0.0", JSON.stringify(packet)),
    ];
  });

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
      .bind(options.workspaceId, `graph-test-${options.workspaceId.slice(-6)}`, "Graph route test workspace"),
    ...memberStatements,
    db.prepare(
      `INSERT INTO ranking_runs (id, workspace_id, policy_version, input_hash, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(rankingRunId, options.workspaceId, "queueproof-default-2.0.0", "hash", new Date().toISOString(), new Date().toISOString()),
    ...itemStatements,
  ]);
}

describe("graph route authorization", () => {
  it("requires a server-resolved actor and never trusts a caller-supplied workspaceId", () => {
    const source = readFileSync(join(process.cwd(), "app/api/graph/route.ts"), "utf8");
    expect(source).toMatch(/requireRequestActor\s*\(/);
    expect(source).not.toMatch(/workspaceId\s*=\s*(?:payload|body|request)/);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const { GET } = await import("../app/api/graph/route");
    const response = await GET(new Request("https://queueproof.example/api/graph"));
    expect(response.status).toBe(401);
  });
});

describe("graph route: actor with no workspace yet", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("returns 409 when the authenticated actor has no workspace", async () => {
    await withLocalIdentity(async () => {
      const { GET } = await import("../app/api/graph/route");
      const response = await GET(new Request("https://queueproof.example/api/graph"));
      expect(response.status).toBe(409);
    });
  });
});

describe("graph route: workspace resolution and cross-workspace isolation", () => {
  // The local-development actor resolves to whichever workspace it was linked to
  // first (workspaceForUser orders by created_at ASC), so every task reachable
  // through this actor lives in one workspace — ownWorkspaceId — seeded with two
  // tasks. otherWorkspaceId is a second, unrelated workspace with its own task/source
  // ids and no membership row for this actor at all, seeded purely to prove the
  // route's WHERE workspace_id = ? scoping does not leak it. Every table involved is
  // workspace_id-scoped per ARCHITECTURE.md's persistence section.
  const ownWorkspaceId = createId("ws");
  const otherWorkspaceId = createId("ws");

  beforeAll(async () => {
    await ensureCoreSchema();
    await seedWorkspaceQueue({
      workspaceId: ownWorkspaceId,
      items: [
        { taskId: "task-own-a", sourceId: "source-own-a", title: "Own workspace task A" },
        { taskId: "task-own-b", sourceId: "source-own-b", title: "Own workspace task B" },
      ],
      members: [{ userId: localUserId }],
    });
    await seedWorkspaceQueue({
      workspaceId: otherWorkspaceId,
      items: [{ taskId: "task-other", sourceId: "source-other", title: "Other workspace task" }],
    });
  });

  it("only ever returns the requesting actor's own workspace, never another workspace's task/source ids", async () => {
    await withLocalIdentity(async () => {
      const { GET } = await import("../app/api/graph/route");
      const response = await GET(new Request("https://queueproof.example/api/graph"));
      expect(response.status).toBe(200);
      const body = await response.json() as { ok: boolean; graph: { nodes: Array<{ id: string }> } };
      expect(body.ok).toBe(true);
      const nodeIds = body.graph.nodes.map((node) => node.id);
      expect(nodeIds).toEqual(expect.arrayContaining([
        "task:task-own-a", "source:source-own-a", "task:task-own-b", "source:source-own-b",
      ]));
      expect(nodeIds).not.toEqual(expect.arrayContaining(["task:task-other", "source:source-other"]));
    });
  });

  it("scopes to a single task when ?taskId= is given, without pulling in the workspace's other tasks", async () => {
    await withLocalIdentity(async () => {
      const { GET } = await import("../app/api/graph/route");
      const response = await GET(new Request("https://queueproof.example/api/graph?taskId=task-own-a"));
      expect(response.status).toBe(200);
      const body = await response.json() as { ok: boolean; graph: { nodes: Array<{ id: string }> } };
      const nodeIds = body.graph.nodes.map((node) => node.id);
      expect(nodeIds).toEqual(expect.arrayContaining(["task:task-own-a", "source:source-own-a"]));
      expect(nodeIds).not.toEqual(expect.arrayContaining(["task:task-own-b", "source:source-own-b"]));
    });
  });
});
