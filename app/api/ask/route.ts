import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, matchingChunk, providerFromSource } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../lib/server/store";
import { planRetrieval } from "../../../packages/retrieval/src";
import { isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";
import { synthesiseGroundedAnswer } from "../../../lib/server/synthesis";

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
    const evidence: Array<{
      id: string; provider: string; title: string; excerpt: string;
      timestamp: string | null; url: string | null; connectorId: string;
    }> = [];
    const trace: Array<Record<string, unknown>> = [];
    const scopes = [...connectors.results.reduce((map, connector) => {
      const key = `${connector.database}\u0000${connector.collection ?? ""}`;
      const current = map.get(key) ?? {
        database: connector.database,
        collection: connector.collection,
        connectors: [] as Connector[],
      };
      current.connectors.push(connector);
      map.set(key, current);
      return map;
    }, new Map<string, { database: string; collection: string | null; connectors: Connector[] }>()).values()];

    await Promise.all(scopes.map(async (scope) => {
      const callStarted = Date.now();
      const response = await client.query({
        database: scope.database,
        ...(scope.collection ? { collections: [scope.collection] } : {}),
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
      trace.push({ connectorIds: scope.connectors.map((item) => item.id),
        providers: scope.connectors.map((item) => item.provider), database: scope.database,
        collection: scope.collection, ok: response.ok, status: response.status,
        requestId: response.requestId, latencyMs: Date.now() - callStarted, error: response.error });
      if (!response.ok) return;
      const extracted = extractQuerySources(response.data);
      extracted.sources.forEach((source, index) => {
        const chunk = record(matchingChunk(source, extracted.chunks));
        const excerpt = (textFrom(chunk, ["chunk_content", "content", "text", "excerpt"]) ??
          textFrom(source, ["content", "text", "excerpt", "description"]) ?? "").replace(/\s+/g, " ").trim().slice(0, 1_200);
        if (!excerpt || isPotentialPromptInjection(excerpt)) return;
        const provider = providerFromSource(source) ?? scope.connectors[0]?.provider ?? "unknown";
        const owningConnector = scope.connectors.find((item) => item.provider === provider) ?? scope.connectors[0];
        evidence.push({
          id: String(source.id ?? source.source_id ?? `${owningConnector.id}-${index}`),
          provider,
          title: textFrom(source, ["title", "subject", "name", "filename"]) ?? `${provider} source`,
          excerpt,
          timestamp: textFrom(source, ["timestamp", "source_timestamp", "updated_at", "created_at"]),
          url: textFrom(source, ["url", "source_url", "web_url", "permalink"]),
          connectorId: owningConnector.id,
        });
      });
    }));
    const deduped = evidence.filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.provider}:${candidate.id}` === `${item.provider}:${item.id}`) === index,
    );
    const synthesis = synthesiseGroundedAnswer(question, deduped);
    const runId = createId("query");
    await requireDb().prepare(
      `INSERT INTO query_runs
       (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
        provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(runId, workspaceId, actor.id, plan.category, redactSecrets(question), mode,
      JSON.stringify(plan), JSON.stringify(synthesis.validation.providerCoverage),
      synthesis.evidence.length, trace.length, Date.now() - started, synthesis.evidence.length ? "completed" : "failed",
      synthesis.evidence.length ? null : "no_safe_evidence").run();
    await audit({ workspaceId, actorId: actor.id, operation: "ask.run", targetType: "query_run",
      targetId: runId, outcome: synthesis.evidence.length ? "success" : "failure",
      metadata: { sourceCount: synthesis.evidence.length, connectorCount: connectors.results.length,
        callCount: trace.length, validation: synthesis.validation, trace } });
    return noStoreJson({
      ok: true,
      answer: synthesis.answer,
      evidence: synthesis.evidence,
      claims: synthesis.claims,
      contradictions: synthesis.contradictions,
      missingInformation: synthesis.missingInformation,
      validation: synthesis.validation,
      trace: {
        runId,
        category: plan.category,
        mode,
        calls: trace,
        callCount: trace.length,
        connectorCount: connectors.results.length,
        latencyMs: Date.now() - started,
        cost: {
          unit: "HydraDB query",
          estimatedUnits: trace.length * (mode === "thinking" ? 3 : 1),
          estimatedUsd: null,
          basis: "Call-weight estimate; no public per-query HydraDB price is assumed.",
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
