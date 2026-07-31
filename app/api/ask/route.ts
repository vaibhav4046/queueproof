import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, providerFromSource } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../lib/server/store";
import { planRetrieval } from "../../../packages/retrieval/src";
import { isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";

type Connector = { id: string; provider: string; database: string; collection: string | null };
type Row = Record<string, unknown>;
const record = (value: unknown): Row => typeof value === "object" && value !== null ? value as Row : {};

function textFrom(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const payload = await readJson<{ question?: string; mode?: "fast" | "thinking" | "auto" }>(request);
    const question = payload.question?.trim() ?? "";
    if (!question || question.length > 4_000) {
      return noStoreJson({ ok: false, error: "Ask a question between 1 and 4,000 characters." }, { status: 400 });
    }
    const connectors = await requireDb().prepare(
      `SELECT id, provider, database, collection FROM connectors
       WHERE workspace_id = ? AND state = 'data_verified' ORDER BY provider ASC`,
    ).bind(workspaceId).all<Connector>();
    if (!connectors.results.length) {
      return noStoreJson({ ok: false, error: "Verify at least one live source before asking QueueProof." }, { status: 409 });
    }
    const plan = planRetrieval(question);
    const mode = payload.mode && payload.mode !== "auto" ? payload.mode : plan.mode;
    const client = await hydraClientForWorkspace(workspaceId);
    const started = Date.now();
    const evidence: Array<Record<string, unknown>> = [];
    const trace: Array<Record<string, unknown>> = [];
    await Promise.all(connectors.results.map(async (connector) => {
      const callStarted = Date.now();
      const response = await client.query({
        database: connector.database,
        ...(connector.collection ? { collections: [connector.collection] } : {}),
        query: question,
        type: "knowledge",
        query_by: plan.queryBy,
        mode,
        max_results: 12,
        query_apps: true,
        graph_context: plan.graphContext,
        query_forceful_relations: plan.graphContext,
        recency_bias: plan.recencyBias,
      });
      trace.push({ connectorId: connector.id, provider: connector.provider, database: connector.database,
        collection: connector.collection, ok: response.ok, status: response.status,
        requestId: response.requestId, latencyMs: Date.now() - callStarted, error: response.error });
      if (!response.ok) return;
      const extracted = extractQuerySources(response.data);
      extracted.sources.forEach((source, index) => {
        const chunk = record(extracted.chunks[index] ?? extracted.chunks[0]);
        const excerpt = (textFrom(chunk, ["chunk_content", "content", "text", "excerpt"]) ??
          textFrom(source, ["content", "text", "excerpt", "description"]) ?? "").replace(/\s+/g, " ").trim().slice(0, 1_200);
        if (!excerpt || isPotentialPromptInjection(excerpt)) return;
        evidence.push({
          id: String(source.id ?? source.source_id ?? `${connector.id}-${index}`),
          provider: providerFromSource(source) ?? connector.provider,
          title: textFrom(source, ["title", "subject", "name", "filename"]) ?? `${connector.provider} source`,
          excerpt,
          timestamp: textFrom(source, ["timestamp", "source_timestamp", "updated_at", "created_at"]),
          url: textFrom(source, ["url", "source_url", "web_url", "permalink"]),
          connectorId: connector.id,
        });
      });
    }));
    const deduped = evidence.filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.provider}:${candidate.id}` === `${item.provider}:${item.id}`) === index,
    ).slice(0, 24);
    const runId = createId("query");
    await requireDb().prepare(
      `INSERT INTO query_runs
       (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
        provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(runId, workspaceId, actor.id, plan.category, redactSecrets(question), mode,
      JSON.stringify(plan), JSON.stringify([...new Set(deduped.map((item) => item.provider))]),
      deduped.length, trace.length, Date.now() - started, deduped.length ? "completed" : "failed",
      deduped.length ? null : "no_safe_evidence").run();
    await audit({ workspaceId, actorId: actor.id, operation: "ask.run", targetType: "query_run",
      targetId: runId, outcome: deduped.length ? "success" : "failure",
      metadata: { sourceCount: deduped.length, connectorCount: connectors.results.length, trace } });
    return noStoreJson({
      ok: true,
      answer: deduped.length
        ? "QueueProof found the following source-grounded evidence. Review the cited records before acting."
        : "No safe supporting evidence was returned. QueueProof will not invent an answer.",
      evidence: deduped,
      trace: { runId, category: plan.category, mode, calls: trace, latencyMs: Date.now() - started },
    });
  } catch (error) {
    return apiError(error);
  }
}
