import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, providerFromSource } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../lib/server/store";
import { queryRequestSchema } from "../../../packages/contracts/src";
import { planRetrieval } from "../../../packages/retrieval/src";
import { isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const parsed = queryRequestSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return noStoreJson({ ok: false, error: "Invalid query request.", issues: parsed.error.issues }, { status: 400 });
    }
    const plan = planRetrieval(parsed.data.query);
    const mode = parsed.data.mode === "auto" ? plan.mode : parsed.data.mode;
    const runId = createId("query");
    const started = Date.now();
    const client = await hydraClientForWorkspace(workspaceId);
    const response = await client.query({
      database: parsed.data.database,
      ...(parsed.data.collections ? { collections: parsed.data.collections } : {}),
      query: parsed.data.query,
      type: "knowledge",
      query_by: plan.queryBy,
      mode,
      max_results: 12,
      graph_context: plan.graphContext,
      query_forceful_relations: plan.graphContext,
      query_apps: true,
      recency_bias: plan.recencyBias,
    });
    const latencyMs = Date.now() - started;
    const extracted = response.ok
      ? extractQuerySources(response.data)
      : { root: {}, sources: [], chunks: [] };
    const providers = [
      ...new Set(extracted.sources.map(providerFromSource).filter(Boolean)),
    ] as string[];
    const sources = extracted.sources.map((source) => ({
      id: String(source.id ?? ""),
      provider: providerFromSource(source),
      title: String(source.title ?? "Untitled source"),
      timestamp: source.timestamp ? String(source.timestamp) : null,
      url: source.url ? String(source.url) : null,
      metadata: source.metadata ?? {},
    }));
    const chunks = extracted.chunks.map((chunk) => {
      const content = String(chunk.chunk_content ?? "");
      return {
        sourceId: String(chunk.id ?? ""),
        excerpt: content.slice(0, 900),
        relevancyScore: Number(chunk.relevancy_score ?? 0),
        untrustedInstructionDetected: isPotentialPromptInjection(content),
        sourceTimestamp: chunk.source_last_updated_time ?? chunk.source_upload_time ?? null,
      };
    });
    await requireDb()
      .prepare(
        `INSERT INTO query_runs
         (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
          provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        runId,
        workspaceId,
        actor.id,
        plan.category,
        redactSecrets(parsed.data.query),
        mode,
        JSON.stringify(plan),
        JSON.stringify(providers),
        sources.length,
        1,
        latencyMs,
        response.ok ? "completed" : "failed",
        response.ok ? null : `hydradb_${response.status}`,
      )
      .run();
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "query.run",
      targetType: "query_run",
      targetId: runId,
      outcome: response.ok ? "success" : "failure",
      metadata: {
        category: plan.category,
        mode,
        providers,
        sourceCount: sources.length,
        requestId: response.requestId,
        latencyMs,
      },
    });
    if (!response.ok) {
      return noStoreJson(
        {
          ok: false,
          error: response.error,
          trace: {
            runId,
            plan,
            actualMode: mode,
            callCount: 1,
            latencyMs,
            requestId: response.requestId,
          },
        },
        { status: response.status || 502 },
      );
    }
    return noStoreJson({
      ok: true,
      result: { sources, chunks, graphContext: extracted.root.graph_context ?? null },
      trace: {
        runId,
        classification: plan.category,
        plannedSteps: [plan.reason],
        actualSteps: ["HydraDB /query"],
        filters: { database: parsed.data.database, collections: parsed.data.collections ?? [] },
        queryMode: mode,
        resultCount: chunks.length,
        providerCoverage: providers,
        selectedSources: sources.map((source) => source.id),
        validation: {
          exactIdentifiers: plan.exactParallel,
          promptInjectionScreened: true,
          unsupportedClaimsPrevented: true,
        },
        callCount: 1,
        hydradbLatencyMs: response.latencyMs,
        endToEndLatencyMs: latencyMs,
        requestId: response.requestId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

