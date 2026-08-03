import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, providerFromSource } from "../../../lib/server/hydradb-shapes";
import { requirePrivateControlActor, requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../lib/server/store";
import { queryRequestSchema } from "../../../packages/contracts/src";
import { planRetrieval, retrievalQueryVariants } from "../../../packages/retrieval/src";
import { isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    requirePrivateControlActor(actor, "Raw HydraDB queries");
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
    const responses = await Promise.all(retrievalQueryVariants(plan).map(async (queryBy) => ({
      queryBy,
      response: await client.query({
        database: parsed.data.database,
        ...(parsed.data.collections ? { collections: parsed.data.collections } : {}),
        query: parsed.data.query,
        type: "knowledge",
        query_by: queryBy,
        mode,
        max_results: 12,
        graph_context: plan.graphContext,
        query_forceful_relations: plan.graphContext,
        query_apps: true,
        recency_bias: plan.recencyBias,
      }),
    })));
    const latencyMs = Date.now() - started;
    const successfulResponses = responses.filter(({ response }) => response.ok);
    const extractedResponses = successfulResponses.map(({ response }) => extractQuerySources(response.data));
    const sourceKeys = new Set<string>();
    const chunkKeys = new Set<string>();
    const extracted = {
      root: extractedResponses.find(({ root }) => root.graph_context)?.root ?? extractedResponses[0]?.root ?? {},
      sources: extractedResponses.flatMap(({ sources }) => sources).filter((source) => {
        const key = String(source.id ?? source.source_id ?? `${providerFromSource(source) ?? "unknown"}:${source.title ?? "untitled"}`);
        if (sourceKeys.has(key)) return false;
        sourceKeys.add(key);
        return true;
      }),
      chunks: extractedResponses.flatMap(({ chunks }) => chunks).filter((chunk) => {
        const key = String(chunk.chunk_id ?? chunk.id ?? chunk.chunk_content ?? "");
        if (chunkKeys.has(key)) return false;
        chunkKeys.add(key);
        return true;
      }),
    };
    const primaryError = responses.find(({ response }) => !response.ok)?.response;
    const completed = successfulResponses.length > 0;
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
        responses.length,
        latencyMs,
        completed ? "completed" : "failed",
        completed ? null : `hydradb_${primaryError?.status ?? 502}`,
      )
      .run();
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "query.run",
      targetType: "query_run",
      targetId: runId,
      outcome: completed ? "success" : "failure",
      metadata: {
        category: plan.category,
        mode,
        providers,
        sourceCount: sources.length,
        requests: responses.map(({ queryBy, response }) => ({ queryBy, requestId: response.requestId, ok: response.ok })),
        latencyMs,
      },
    });
    if (!completed) {
      return noStoreJson(
        {
          ok: false,
          error: primaryError?.error ?? "HydraDB retrieval failed.",
          trace: {
            runId,
            plan,
            actualMode: mode,
            callCount: responses.length,
            latencyMs,
            requests: responses.map(({ queryBy, response }) => ({ queryBy, requestId: response.requestId, status: response.status })),
          },
        },
        { status: primaryError?.status || 502 },
      );
    }
    return noStoreJson({
      ok: true,
      result: { sources, chunks, graphContext: extracted.root.graph_context ?? null },
      trace: {
        runId,
        classification: plan.category,
        plannedSteps: [plan.reason],
        actualSteps: responses.map(({ queryBy }) => `HydraDB /query (${queryBy})`),
        filters: { database: parsed.data.database, collections: parsed.data.collections ?? [] },
        queryMode: mode,
        resultCount: chunks.length,
        providerCoverage: providers,
        selectedSources: sources.map((source) => source.id),
        validation: {
          exactIdentifiers: plan.exactParallel,
          // Counts, not assertions. `promptInjectionScreened` was previously the literal
          // `true` and is now the number of chunks actually put through the screen, so it
          // cannot drift away from what the code does. The former sibling field
          // `unsupportedClaimsPrevented: true` was removed outright: it was unconditional
          // and no claim validator exists anywhere in the codebase, so it asserted a
          // guarantee the product does not provide.
          promptInjectionScreened: chunks.length,
          untrustedInstructionsFlagged: chunks.filter((chunk) => chunk.untrustedInstructionDetected)
            .length,
        },
        callCount: responses.length,
        hydradbLatencyMs: Math.max(...responses.map(({ response }) => response.latencyMs ?? 0)),
        endToEndLatencyMs: latencyMs,
        requestIds: responses.map(({ response }) => response.requestId).filter(Boolean),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
