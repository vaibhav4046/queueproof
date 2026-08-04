import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, matchingChunks, providerFromSource, sourceBelongsToConnector } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, enforcePublicRateLimit, requireWorkspaceForUser } from "../../../lib/server/store";
import { evidenceFollowUpTerms, planRetrieval, retrievalIntentTerms, retrievalQueryVariants } from "../../../packages/retrieval/src";
import { isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";
import { synthesiseGroundedAnswer } from "../../../lib/server/synthesis";
import { listQueueForWorkspace } from "../../../lib/server/queue";
import {
  groundedAnswerContractSchema,
  liveProofStateSchema,
  type LiveProofState,
} from "../../../packages/contracts/src";
import { buildProofGraphView, createQueryWorkflowRecorder } from "../../../lib/server/query-workflow";
import { compileContradictionAction } from "../../../lib/server/grounded-action";

type Connector = { id: string; hydradbConnectorId: string; provider: string; database: string; collection: string | null };
type RetrievalScope = {
  database: string;
  collection: string | null;
  connectors: Connector[];
  sourceIds?: string[];
};
type Row = Record<string, unknown>;
type RetrievedEvidence = {
  id: string;
  sourceId: string;
  provider: string;
  title: string;
  excerpt: string;
  timestamp: string | null;
  url: string | null;
  connectorId: string;
};
const record = (value: unknown): Row => typeof value === "object" && value !== null ? value as Row : {};

function textFrom(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function POST(request: Request) {
  let failureContext: {
    recorder: ReturnType<typeof createQueryWorkflowRecorder>;
    startedAt: number;
  } | null = null;
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
    // Exact-identifier questions retrieve more precisely when the identifier
    // leads the HydraDB query text (the router already classified this query as
    // exact_identifier; this is the honest execution of that plan). Call count
    // and cost are unchanged — only the query string is anchored.
    const identifiers = [...new Set(question.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [])];
    const intentTerms = retrievalIntentTerms(question);
    const retrievalQuery = [identifiers.join(" "), question, ...intentTerms].filter(Boolean).join(" ");
    const evidence: RetrievedEvidence[] = [];
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
    const runId = createId("query");
    const started = Date.now();
    await requireDb().prepare(
      `INSERT INTO query_runs
       (id, workspace_id, actor_id, category, sanitised_query, mode, plan_json,
        provider_coverage_json, source_count, call_count, latency_ms, status, error_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 0, 0, 0, 'routing', NULL)`,
    ).bind(
      runId, workspaceId, actor.id, plan.category, redactSecrets(question), mode, JSON.stringify(plan),
    ).run();
    const requiredProviders = new Set(scopes.flatMap((scope) =>
      scope.sourceIds ? ["document"] : scope.connectors.map((connector) => connector.provider),
    ));
    const recorder = createQueryWorkflowRecorder({
      queryId: runId,
      workspaceId,
      mode,
      providerSeeds: [
        ...connectors.results.map((connector) => ({
          provider: connector.provider,
          connectorId: connector.id,
          required: requiredProviders.has(connector.provider),
        })),
        ...(requestedSourceIds.length ? [{ provider: "document", required: true }] : []),
      ],
    });
    failureContext = { recorder, startedAt: started };
    await recorder.record("routing", `Router selected ${mode} mode because ${plan.reason}`);
    const client = await hydraClientForWorkspace(workspaceId);
    let issuedCallCount = 0;
    const runQueryBatch = async (
      queryText: string,
      queryVariants: Array<"text" | "hybrid">,
      phase: "primary" | "follow_up",
    ) => {
      await Promise.all(scopes.map(async (scope) => {
        await Promise.all(queryVariants.map(async (queryBy) => {
        const queryProviders = scope.sourceIds
          ? ["document"]
          : [...new Set(scope.connectors.map((item) => item.provider))];
        const callNumber = ++issuedCallCount;
        await recorder.markQuerying(
          queryProviders,
          `${phase === "primary" ? "Primary" : "Evidence-derived follow-up"} ${queryBy} query issued to HydraDB.`,
          callNumber,
        );
        const callStarted = Date.now();
        const response = await client.query({
          database: scope.database,
          ...(scope.collection ? { collections: [scope.collection] } : {}),
          query: queryText,
          type: "knowledge",
          query_by: queryBy,
          mode,
          // Document-scoped retrieval asks deeper: a 346-page handbook needs a
          // wider net so exact-fact chunks in the middle/end are not missed by
          // relevance ranking. Connector scopes stay at 12 to bound evidence.
          max_results: scope.sourceIds ? 24 : 12,
          ...(scope.sourceIds ? { ids: scope.sourceIds } : {}),
          query_apps: !scope.sourceIds,
          graph_context: plan.graphContext,
          query_forceful_relations: plan.graphContext,
          recency_bias: plan.recencyBias,
          ...(payload.metadataFilters && Object.keys(payload.metadataFilters).length > 0
            ? { metadata_filters: payload.metadataFilters }
            : {}),
        });
        trace.push({ phase, connectorIds: scope.connectors.map((item) => item.id),
          providers: scope.sourceIds ? ["document"] : scope.connectors.map((item) => item.provider), database: scope.database,
          collection: scope.collection, queryBy, ok: response.ok, status: response.status,
          sourceIds: scope.sourceIds ?? [], requestId: response.requestId,
          queryTermCount: queryText.split(/\s+/).filter(Boolean).length,
          latencyMs: Date.now() - callStarted, error: response.error });
        const callLatencyMs = Date.now() - callStarted;
        const callEvidence: RetrievedEvidence[] = [];
        if (!response.ok) {
          await recorder.markResponse({
            providers: queryProviders,
            ok: false,
            latencyMs: callLatencyMs,
            callCount: trace.length,
            evidenceByProvider: new Map(),
          });
          return;
        }
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
            const retained = {
              id: chunkId ?? `${sourceId}:chunk:${chunkIndex}`,
              sourceId,
              provider,
              title: textFrom(source, ["title", "subject", "name", "filename"]) ?? `${provider} source`,
              excerpt,
              timestamp: textFrom(source, ["timestamp", "source_timestamp", "updated_at", "created_at"]),
              url: textFrom(source, ["url", "source_url", "web_url", "permalink"]),
              connectorId: owningConnector?.id ?? `document:${sourceId}`,
            } satisfies RetrievedEvidence;
            evidence.push(retained);
            callEvidence.push(retained);
          });
        });
        const evidenceByProvider = callEvidence.reduce((map, item) => {
          const ids = map.get(item.provider) ?? [];
          ids.push(item.id);
          map.set(item.provider, ids);
          return map;
        }, new Map<string, string[]>());
        await recorder.markResponse({
          providers: queryProviders,
          ok: true,
          latencyMs: callLatencyMs,
          callCount: trace.length,
          evidenceByProvider,
        });
        }));
      }));
    };

    await runQueryBatch(retrievalQuery, retrievalQueryVariants(plan), "primary");
    if (mode === "thinking") {
      const followUpTerms = evidenceFollowUpTerms(
        question,
        evidence.map((item) => `${item.title}. ${item.excerpt}`),
      );
      if (followUpTerms.length) {
        await runQueryBatch(`${retrievalQuery} ${followUpTerms.join(" ")}`, ["hybrid"], "follow_up");
      }
    }
    const deduped = evidence.filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.provider}:${candidate.id}` === `${item.provider}:${item.id}`) === index,
    );
    await recorder.record(
      "linking",
      `Normalized ${deduped.length} attributable records and retained provider, connector, source, and evidence lineage.`,
      { callCount: trace.length, latencyMs: Date.now() - started },
    );
    const synthesis = synthesiseGroundedAnswer(question, deduped);
    await recorder.record(
      "checking-contradictions",
      `Evaluated ${synthesis.claims.length} atomic claims and preserved ${synthesis.contradictions.length} contradiction records.`,
      { callCount: trace.length, latencyMs: Date.now() - started },
    );
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
    await recorder.record(
      "validating",
      `Validation retained ${synthesis.validation.citedClaimCount} cited claims and removed unsupported prose before rendering.`,
      { callCount: trace.length, latencyMs: Date.now() - started },
    );
    const queryTerms = new Set(question.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? []);
    const currentEvidenceIds = new Set(deduped.flatMap((item) => [item.id, item.sourceId]));
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
    const queuePriority = (queue.items as unknown as PriorityQueueItem[])
      .map((item) => {
        const packet = item.packet;
        const corpus = `${String(item.title ?? "")} ${String(packet.task?.objective ?? "")}`.toLowerCase();
        const overlap = [...queryTerms].filter((term) => corpus.includes(term)).length;
        const packetEvidenceIds = new Set((packet.evidence ?? []).flatMap((entry) =>
          [entry.sourceId, entry.id].filter((id): id is string => Boolean(id)),
        ));
        const linkedEvidence = deduped.filter((evidenceItem) =>
          packetEvidenceIds.has(evidenceItem.id) || packetEvidenceIds.has(evidenceItem.sourceId),
        );
        return { item, packet, overlap, linkedEvidence };
      })
      // A next action may only be shown when the persisted queue packet and
      // this query share exact evidence lineage. Text similarity alone is not
      // enough to claim that an action came from the returned proof graph.
      .filter((entry) => entry.linkedEvidence.some((item) => currentEvidenceIds.has(item.id)))
      .sort((a, b) => b.linkedEvidence.length - a.linkedEvidence.length ||
        b.overlap - a.overlap || Number(b.item.finalScore) - Number(a.item.finalScore))
      .slice(0, 1)
      .map(({ item, packet, linkedEvidence }) => ({
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
        evidence_ids: linkedEvidence.map((entry) => entry.id),
        disagreements: packet.contradictions ?? [],
        confidence: Number(packet.task?.confidence ?? Number(item.confidence) / 100),
        provider_coverage: [...new Set(linkedEvidence.map((entry) => entry.provider))],
        deduplicated_tasks: packet.deduplicated_tasks ?? [],
        approval_required: true,
      }));
    const derivedConflictAction = queuePriority.length
      ? null
      : compileContradictionAction({
        queryId: runId,
        evidence: deduped,
        contradictions: synthesis.contradictions,
      });
    const relatedPriority = queuePriority.length
      ? queuePriority
      : derivedConflictAction
        ? [derivedConflictAction]
        : [];
    await recorder.record(
      "compiling-action",
      relatedPriority.length
        ? queuePriority.length
          ? "Compiled the highest-scoring safe action whose persisted packet shares exact evidence with this proof."
          : "Compiled an approval-required contradiction follow-up from the exact returned evidence and deterministic ranking formula."
        : "No safely grounded action shared exact evidence lineage with this proof, so no action was shown.",
      { callCount: trace.length, latencyMs: Date.now() - started },
    );
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
    const finalStage = synthesis.validation.status === "abstained" || !synthesis.evidence.length
      ? "abstained"
      : synthesis.validation.status === "partial" || synthesis.missingInformation.length
        ? "partial"
        : "complete";
    await recorder.record(
      finalStage,
      finalStage === "complete"
        ? "Grounded answer, exact citations, proof graph, and safe action candidates were finalized."
        : finalStage === "partial"
          ? "Only supported claims were returned; unresolved evidence gaps remain visible."
          : "No safely supported answer was available, so QueueProof abstained.",
      { callCount: trace.length, latencyMs: totalLatencyMs,
        errorType: finalStage === "abstained" ? "no_safe_evidence" : null },
    );
    const graph = buildProofGraphView({
      providers: recorder.providers(),
      evidence: synthesis.evidence,
      claims: groundedContract.claims,
      contradictions: synthesis.contradictions,
      priorityItems: groundedContract.priority_items,
    });
    const workflow: LiveProofState = liveProofStateSchema.parse({
      schemaVersion: "live-proof-v1",
      kind: "verified-backend-receipt",
      queryId: runId,
      stage: finalStage,
      mode,
      routingReason: plan.reason,
      providers: recorder.providers(),
      graph,
      claims: groundedContract.claims,
      contradictions: synthesis.contradictions,
      priorityItems: groundedContract.priority_items,
      events: recorder.events(),
      receipt: groundedContract.retrieval_receipt,
      persisted: true,
      replayAvailable: true,
    });
    const responsePayload = {
      ...groundedContract,
      workflow,
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
    };
    await recorder.persistReceipt({ workflow, result: responsePayload });
    failureContext = null;
    await audit({ workspaceId, actorId: actor.id, operation: "ask.run", targetType: "query_run",
      targetId: runId, outcome: synthesis.evidence.length ? "success" : "failure",
      metadata: { sourceCount: synthesis.evidence.length, connectorCount: connectors.results.length,
        callCount: trace.length, validation: synthesis.validation, trace } });
    return noStoreJson({ ok: true, ...responsePayload });
  } catch (error) {
    if (failureContext) {
      try {
        await failureContext.recorder.record(
          "failed",
          "The backend workflow failed before a verified receipt could be finalized.",
          { latencyMs: Date.now() - failureContext.startedAt, errorType: "query_failed" },
        );
      } catch {
        // Receipt recording must never hide the original request failure.
      }
    }
    return apiError(error);
  }
}
