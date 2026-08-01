import { beforeAll, describe, expect, it } from "vitest";
import {
  ProviderError,
  buildIssuePayload,
  createIssue,
  idempotencyKeyFor,
  redactKey,
  riskClass,
  type Commitment,
} from "../packages/actions/src";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

const commitment = (overrides: Partial<Commitment> = {}): Commitment => ({
  id: "commitment-1",
  summary: "Send the enterprise customer a fix ETA by Friday",
  owner: "Priya Raman",
  deadline: "2026-08-07",
  customer: "Northwind",
  evidenceIds: ["src-gmail-1"],
  sourceProvider: "gmail",
  ...overrides,
});

describe("issue payload", () => {
  it("embeds the evidence ids so the issue carries its own provenance", () => {
    const payload = buildIssuePayload(commitment({ evidenceIds: ["src-a", "src-b"] }), "team-1");
    expect(payload.description).toContain("src-a");
    expect(payload.description).toContain("src-b");
    expect(payload.teamId).toBe("team-1");
  });

  it("states plainly when the source did not give an owner or deadline", () => {
    const payload = buildIssuePayload(commitment({ owner: null, deadline: null }), "team-1");
    expect(payload.description).toContain("Owner: not stated in source");
    expect(payload.description).toContain("Deadline: not stated in source");
  });

  it("classifies an ungrounded proposal as critical risk", () => {
    const bare = commitment({ evidenceIds: [] });
    expect(riskClass(buildIssuePayload(bare, "team-1"), bare)).toBe("critical");
  });
});

describe("idempotency key", () => {
  it("is deterministic for the same workspace, commitment and payload", async () => {
    const payload = buildIssuePayload(commitment(), "team-1");
    const a = await idempotencyKeyFor("ws-1", "commitment-1", payload);
    const b = await idempotencyKeyFor("ws-1", "commitment-1", payload);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });

  it("differs across workspaces and across payloads", async () => {
    const payload = buildIssuePayload(commitment(), "team-1");
    const other = buildIssuePayload(commitment({ summary: "Something else entirely" }), "team-1");
    expect(await idempotencyKeyFor("ws-1", "c1", payload)).not.toBe(
      await idempotencyKeyFor("ws-2", "c1", payload),
    );
    expect(await idempotencyKeyFor("ws-1", "c1", payload)).not.toBe(
      await idempotencyKeyFor("ws-1", "c1", other),
    );
  });
});

describe("credential redaction", () => {
  it("removes the api key from any message that would escape", () => {
    const key = "lin_api_abcdef0123456789";
    expect(redactKey(`request failed with ${key}`, key)).not.toContain(key);
    expect(redactKey(`Authorization: Bearer ${key}`)).toContain("[REDACTED]");
  });

  it("redacts a Linear key even when it was not passed in explicitly", () => {
    expect(redactKey("leaked lin_api_zzzzzzzzzzzzzzzz here")).not.toContain("lin_api_zzzz");
  });
});

describe("createIssue response validation", () => {
  const payload = buildIssuePayload(commitment(), "team-1");

  it("returns the issue when Linear confirms creation", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          data: { issueCreate: { success: true, issue: { id: "iss_1", identifier: "ENG-9", url: "https://linear.app/x/ENG-9" } } },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    await expect(createIssue({ apiKey: "lin_api_test000000", payload, fetchImpl })).resolves.toEqual({
      id: "iss_1",
      identifier: "ENG-9",
      url: "https://linear.app/x/ENG-9",
    });
  });

  it("refuses to report success when Linear says success:false", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { issueCreate: { success: false } } }), { status: 200 })) as unknown as typeof fetch;
    await expect(createIssue({ apiKey: "lin_api_test000000", payload, fetchImpl })).rejects.toThrow(ProviderError);
  });

  it("refuses to report success when the issue id is missing", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { issueCreate: { success: true, issue: { identifier: "ENG-9" } } } }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(createIssue({ apiKey: "lin_api_test000000", payload, fetchImpl })).rejects.toThrow(/did not confirm/);
  });

  it("never leaks the key in a transport error", async () => {
    const key = "lin_api_secret0000000";
    const fetchImpl = (async () => {
      throw new Error(`connect failed using ${key}`);
    }) as unknown as typeof fetch;
    await expect(createIssue({ apiKey: key, payload, fetchImpl })).rejects.toSatisfy(
      (error: unknown) => error instanceof Error && !error.message.includes(key),
    );
  });
});

describe("execution is claimed at most once", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("cannot record two executions for one proposal", async () => {
    const db = requireDb();
    const workspaceId = createId("ws");
    const proposalId = createId("action");

    await db
      .prepare(
        `INSERT INTO action_proposals
         (id, workspace_id, provider, action_type, payload_json, evidence_ids_json, risk_class, idempotency_key, status)
         VALUES (?, ?, 'linear', 'create_issue', '{}', '["src-1"]', 'low', ?, 'proposed')`,
      )
      .bind(proposalId, workspaceId, `qpk_${proposalId}`)
      .run();

    await db
      .prepare(`INSERT INTO action_executions (id, workspace_id, proposal_id, status) VALUES (?, ?, ?, 'pending')`)
      .bind(createId("execution"), workspaceId, proposalId)
      .run();

    // The second approval must lose here, before it can ever reach the provider.
    await expect(
      db
        .prepare(`INSERT INTO action_executions (id, workspace_id, proposal_id, status) VALUES (?, ?, ?, 'pending')`)
        .bind(createId("execution"), workspaceId, proposalId)
        .run(),
    ).rejects.toThrow();

    const rows = await db
      .prepare(`SELECT id FROM action_executions WHERE proposal_id = ?`)
      .bind(proposalId)
      .all();
    expect(rows.results).toHaveLength(1);
  });
});

describe("action routes", () => {
  it("reject unauthenticated callers", async () => {
    const { GET, POST } = await import("../app/api/actions/route");
    expect((await GET()).status).toBe(401);
    expect(
      (
        await POST(
          new Request("https://queueproof.example/api/actions", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
          }),
        )
      ).status,
    ).toBe(401);
  });
});
