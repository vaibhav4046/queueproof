import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, matchingChunks, providerFromSource, sourceBelongsToConnector } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, enforcePublicRateLimit, requireWorkspaceForUser } from "../../../lib/server/store";
import { planRetrieval, retrievalQueryVariants } from "../../../packages/retrieval/src";
import { isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";
import { synthesiseGroundedAnswer } from "../../../lib/server/synthesis";
import { listQueueForWorkspace } from "../../../lib/server/queue";
import { groundedAnswerContractSchema } from "../../../packages/contracts/src";

type Connector = { id: string; hydradbConnectorId: string; provider: string; database: string; collection: string | null };
type RetrievalScope = {
  database: string;
  collection: string | null;
  connectors: Connector[];
  sourceIds?: string[];
};
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
    await enforcePublicRateLimit({
      actorId: actor.id, workspaceId, operation: "ask", limit: 12, windowMs: 60_000,
    });
    const payload = await readJson<{
      question?: string;
      mode?: "fast" | "thinking" | "auto";
      metadataFilters?: Record<string, unknown>;
      sourceIds?: string[];
      includeConnectors?: boolean;
    }>(request);
    const question = payload.question?.trim() ?? "";
    if (!question || question.length > 4_000) {
      return noStoreJson({ ok: false, error: "Ask a question between 1 and 4,000 characters." }, { status: 400 });
    }
    const connectors = await requireDb().prepare(
      `SELECT id, hydradb_connector_id AS hydradbConnectorId, provider, database, collection FROM connectors
       WHERE workspace_id = ? AND state = 'data_verified' ORDER BY provider ASC`,
    ).bind(workspaceId).all<Connector>();
    if (!connectors.results.length) {
      return noStoreJson({ ok: false, error: "Verify at least one live source before asking QueueProof." }, { status: 409 });
    }
    const selectedResources = await requireDb().prepare(
      `SELECT connector_id, external_resource_id FROM connector_resources
       WHERE workspace_id = ? AND selected = 1`,
    ).bind(workspaceId).all<{ connector_id: string; external_resource_id: string }>();
    const resourceIdsByConnector = selectedResources.results.reduce((map, row) => {
      const ids = map.get(row.connector_id) ?? new Set<string>();
      ids.add(row.external_resource_id);
      map.set(row.connector_id, ids);
      return map;
    }, new Map<string, Set<string>>());
    const requestedSourceIds = [...new Set(payload.sourceIds ?? [])];
    if (requestedSourceIds.length > 10 || requestedSourceIds.some((id) => !/^[a-z0-9_-]{12,160}$/i.test(id))) {
      return noStoreJson({ ok: false, error: "Document source scope is invalid." }, { status: 400 });
    }
    const documentScopes: RetrievalScope[] = [];
    if (requestedSourceIds.length) {
      const placeholders = requestedSourceIds.map(() => "?").join(",");
      const documents = await requireDb().prepare(
        `SELECT hydradb_source_id AS sourceId, hydradb_database AS database
         FROM documents WHERE workspace_id = ? AND stage = 'indexed'
         AND hydradb_source_id IN (${placeholders})`,
      ).bind(workspaceId, ...requestedSourceIds).all<{ sourceId: string; database: string }>();
      if (documents.results.length !== requestedSourceIds.length) {
        return noStoreJson({ ok: false, error: "Every scoped document must be indexed in this workspace." }, { status: 400 });
      }
      const byDatabase = documents.results.reduce((map, document) => {
        const current = map.get(document.database) ?? [];
        current.push(document.sourceId);
        map.set(document.database, current);
        return map;
      }, new Map<string, string[]>());
      for (const [database, sourceIds] of byDatabase) {
        documentScopes.push({ database, collection: null, connectors: [], sourceIds });
      }
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
    const connectorScopes = [...connectors.results.reduce((map, connector) => {
      const key = `${connector.database}\u0000${connector.collection ?? ""}`;
      const current = map.get(key) ?? {
        database: connector.database,
        collection: connector.collection,
        connectors: [] as Connector[],
      };
      current.connectors.push(connector);
      map.set(key, current);
      return map;
    }, new Map<string, RetrievalScope>()).values()];
    const scopes: RetrievalScope[] = requestedSourceIds.length
      ? [...documentScopes, ...(payload.includeConnectors ? connectorScopes : [])]
      : connectorScopes;
    const queryVariants = retrievalQueryVariants(plan);

    await Promise.all(scopes.map(async (scope) => {
      await Promise.all(queryVariants.map(async (queryBy) => {
        const callStarted = Date.now();
        const response = await client.query({
          database: scope.database,
          ...(scope.collection ? { collections: [scope.collection] } : {}),
          query: question,
          type: "knowledge",
          query_by: queryBy,
          mode,
          max_results: 12,
          ...(scope.sourceIds ? { ids: scope.sourceIds } : {}),
          query_apps: !scope.sourceIds,
          graph_context: plan.graphContext,
          query_forceful_relations: plan.graphContext,
          recency_bias: plan.recencyBias,
          ...(payload.metadataFilters && Object.keys(payload.metadataFilters).length > 0
            ? { metadata_filters: payload.metadataFilters }
            : {}),
        });
        trace.push({ connectorIds: scope.connectors.map((item) => item.id),
          providers: scope.sourceIds ? ["document"] : scope.connectors.map((item) => item.provider), database: scope.database,
          collection: scope.collection, queryBy, ok: response.ok, status: response.status,
          sourceIds: scope.sourceIds ?? [], requestId: response.requestId,
          latencyMs: Date.now() - callStarted, error: response.error });
        if (!response.ok) return;
        const extracted = extractQuerySources(response.data);
        extracted.sources.forEach((source, sourceIndex) => {
          const metadata = record(source.additional_metadata);
          const sourceKind = textFrom({ ...metadata, ...source }, ["source_type", "type", "mime_type", "filename"]);
          const isDocumentSource = Boolean(source.filename ?? metadata.filename) || /\b(pdf|document|file)\b/i.test(sourceKind ?? "");
          const provider = isDocumentSource ? "document" : providerFromSource(source) ?? "unknown";
          const sourceId = String(source.id ?? source.source_id ?? source.context_id ?? `document-${sourceIndex}`);
          const documentOwned = provider === "document" && Boolean(scope.sourceIds?.includes(sourceId));
          const owningConnector = provider === "document"
            ? undefined
            : scope.connectors.find((item) =>
                item.provider === provider && sourceBelongsToConnector(
                  source,
                  item.hydradbConnectorId,
                  resourceIdsByConnector.get(item.id) ?? new Set<string>(),
                ));
          if (!owningConnector && !documentOwned) return;
          const sourceChunks = matchingChunks(source, extracted.chunks);
          const candidates = sourceChunks.length ? sourceChunks : [source];
          candidates.forEach((candidate, chunkIndex) => {
            const chunk = record(candidate);
            const excerpt = (textFrom(chunk, ["chunk_content", "content", "text", "excerpt"]) ??
              textFrom(source, ["content", "text", "excerpt", "description"]) ?? "")
              .replace(/\s+/g, " ").trim().slice(0, 6_000);
            if (!excerpt || isPotentialPromptInjection(excerpt)) return;
            const chunkId = textFrom(chunk, ["chunk_id", "chunkId"]);
            evidence.push({
              id: chunkId ?? `${sourceId}:chunk:${chunkIndex}`,
              provider,
              title: textFrom(source, ["title", "subject", "name", "filename"]) ?? `${provider} source`,
              excerpt,
              timestamp: textFrom(source, ["timestamp", "source_timestamp", "updated_at", "created_at"]),
              url: textFrom(source, ["url", "source_url", "web_url", "permalink"]),
              connectorId: owningConnector?.id ?? `document:${sourceId}`,
            });
          });
        });
      }));
    }));
    const deduped = evidence.filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.provider}:${candidate.id}` === `${item.provider}:${item.id}`) === index,
    );
    const synthesis = synthesiseGroundedAnswer(question, deduped);
    const runId = createId("query");
    const citedIds = new Set([
      ...synthesis.claims.flatMap((claim) => claim.evidenceIds),
      ...synthesis.contradictions.flatMap((contradiction) => contradiction.evidenceIds),
    ]);
    const citations = [...citedIds]
      .map((id) => synthesis.evidence.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        id: item.id,
        provider: item.provider,
        title: item.title,
        excerpt: item.excerpt,
        timestamp: item.timestamp,
        url: item.url,
      }));
    const queryTerms = new Set(question.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? []);
    const queue = await listQueueForWorkspace(workspaceId);
    type PriorityQueueItem = {
      taskId?: unknown; title?: unknown; project?: unknown; customer?: unknown;
      owner?: unknown; deadline?: unknown; status?: unknown; finalScore?: unknown;
      confidence?: unknown; componentScores?: unknown; penalties?: unknown;
      packet: {
        task?: { objective?: string; confidence?: number };
        why_now?: string[]; contradictions?: unknown[];
        recommended_safe_action?: string; provider_coverage?: string[];
        deduplicated_tasks?: string[];
        evidence?: Array<{ sourceId?: string; id?: string; provider?: string }>;
      };
    };
    const relatedPriority = (queue.items as unknown as PriorityQueueItem[])
      .map((item) => {
        const packet = item.packet;
        const corpus = `${String(item.title ?? "")} ${String(packet.task?.objective ?? "")}`.toLowerCase();
        const overlap = [...queryTerms].filter((term) => corpus.includes(term)).length;
        return { item, packet, overlap };
      })
      .filter((entry) => entry.overlap >= 1)
      .sort((a, b) => b.overlap - a.overlap || Number(b.item.finalScore) - Number(a.item.finalScore))
      .slice(0, 1)
      .map(({ item, packet }) => ({
        id: String(item.taskId),
        title: String(item.title),
        normalized_entity: String(item.project ?? item.customer ?? item.title),
        owner: item.owner ? String(item.owner) : null,
        due_date: item.deadline ? String(item.deadline) : null,
        status: String(item.status),
        score: Number(item.finalScore),
        score_breakdown: item.componentScores as Record<string, number>,
        penalties: item.penalties as Record<string, number>,
        why_now: packet.why_now ?? [],
        recommended_next_safe_action: packet.recommended_safe_action ??
          "Review the cited receipt, then route any external write through QueueProof approval.",
        evidence_ids: (item.packet.evidence ?? []).map((entry) =>
          String(entry.sourceId ?? entry.id ?? ""),
        ).filter(Boolean),
        disagreements: packet.contradictions ?? [],
        confidence: Number(packet.task?.confidence ?? Number(item.confidence) / 100),
        provider_coverage: packet.provider_coverage ?? [
          ...new Set((item.packet.evidence ?? []).map((entry) => String(entry.provider ?? "unknown"))),
        ],
        deduplicated_tasks: packet.deduplicated_tasks ?? [],
        approval_required: true,
      }));
    const totalLatencyMs = Date.now() - started;
    const costUnits = trace.length * (mode === "thinking" ? 3 : 1);
    const groundedContract = groundedAnswerContractSchema.parse({
      answer: synthesis.answer,
      claims: synthesis.claims.map((claim) => ({
        text: claim.text,
        citation_ids: claim.evidenceIds,
        providers: claim.providers,
      })),
      citations,
      priority_items: relatedPriority,
      contradictions: synthesis.contradictions,
      missing_information: synthesis.missingInformation,
      retrieval_receipt: {
        query_id: runId,
        hydradb_mode: mode,
        routing_reason: plan.reason,
        hydradb_call_count: trace.length,
        total_latency_ms: totalLatencyMs,
        provider_coverage: synthesis.validation.providerCoverage,
        receipt_count: citations.length,
        metadata_filters: payload.metadataFilters ?? {},
        graph_usage: plan.graphContext,
        estimated_cost_units: costUnits,
        timestamp: new Date().toISOString(),
      },
      routing_reason: plan.reason,
    });
    await requireDb().prepare(
      `INSERT INTO query_runs
       (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
        provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(runId, workspaceId, actor.id, plan.category, redactSecrets(question), mode,
      JSON.stringify(plan), JSON.stringify(synthesis.validation.providerCoverage),
      synthesis.evidence.length, trace.length, totalLatencyMs, synthesis.evidence.length ? "completed" : "failed",
      synthesis.evidence.length ? null : "no_safe_evidence").run();
    await audit({ workspaceId, actorId: actor.id, operation: "ask.run", targetType: "query_run",
      targetId: runId, outcome: synthesis.evidence.length ? "success" : "failure",
      metadata: { sourceCount: synthesis.evidence.length, connectorCount: connectors.results.length,
        callCount: trace.length, validation: synthesis.validation, trace } });
    return noStoreJson({
      ok: true,
      ...groundedContract,
      evidence: synthesis.evidence,
      missingInformation: synthesis.missingInformation,
      validation: synthesis.validation,
      trace: {
        runId,
        category: plan.category,
        mode,
        calls: trace,
        callCount: trace.length,
        connectorCount: connectors.results.length,
        latencyMs: totalLatencyMs,
        routingReason: plan.reason,
        metadataFilters: payload.metadataFilters ?? {},
        graphUsage: plan.graphContext,
        cost: {
          unit: "HydraDB query",
          estimatedUnits: costUnits,
          estimatedUsd: null,
          basis: "Call-weight estimate; no public per-query HydraDB price is assumed.",
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
