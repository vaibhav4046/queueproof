import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractQuerySources, matchingChunks, providerFromSource, sourceBelongsToConnector } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, enforcePublicRateLimit, requireWorkspaceForUser } from "../../../lib/server/store";
import {
  decideAutoEscalation,
  focusedEvidenceFollowUpQuery,
  planRetrieval,
  providersNamedInQuestion,
  recordIdentifiers,
  resolveRetrievalMode,
  retrievalIntentTerms,
  retrievalModeCost,
  retrievalQueryVariants,
  shouldRunFastCoverageRepair,
  type ExecutedRetrievalMode,
} from "../../../packages/retrieval/src";
import { hostileQueryReason, isPotentialPromptInjection, redactSecrets } from "../../../packages/security/src";
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
type RetrievalCallTrace = {
  phase: "primary" | "follow_up";
  mode: ExecutedRetrievalMode;
  estimatedCostUnits: number;
  graphUsage: boolean;
  connectorIds: string[];
  providers: string[];
  database: string;
  collection: string | null;
  queryBy: "text" | "hybrid";
  ok: boolean;
  status: number;
  sourceIds: string[];
  requestId?: string | null;
  queryTermCount: number;
  latencyMs: number;
  error?: string | null;
};
const THINKING_QUERY_TIMEOUT_MS = 16_000;
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
    const hostileReason = hostileQueryReason(question);
    if (hostileReason) {
      // Do not retain the raw query in this audit event and reject before connector lookup
      // or HydraDB creation: a rejected request must have zero retrieval calls.
      await audit({
        workspaceId,
        actorId: actor.id,
        operation: "ask.rejected",
        outcome: "denied",
        riskClass: "high",
        metadata: { reason: hostileReason, queryLength: question.length },
      });
      return noStoreJson({
        ok: false,
        error: "QueueProof cannot retrieve, disclose, or transmit credentials. Ask about work evidence instead.",
      }, { status: 400 });
    }
    if (request.signal.aborted) {
      return noStoreJson({ ok: false, error: "Request cancelled before retrieval began." }, { status: 499 });
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
    const requestedMode = payload.mode ?? "auto";
    const { automatic, primaryMode } = resolveRetrievalMode(requestedMode);
    let effectiveMode: ExecutedRetrievalMode = primaryMode;
    let routingReason = automatic
      ? "Auto began with Fast retrieval and will escalate only when the first grounded check proves a coverage gap."
      : plan.reason;
    // Exact-identifier questions retrieve more precisely when the identifier
    // leads the HydraDB query text (the router already classified this query as
    // exact_identifier; this is the honest execution of that plan). Call count
    // and cost are unchanged — only the query string is anchored.
    const identifiers = [...new Set(recordIdentifiers(question))];
    const intentTerms = retrievalIntentTerms(question);
    const retrievalQuery = [identifiers.join(" "), question, ...intentTerms].filter(Boolean).join(" ");
    const evidence: RetrievedEvidence[] = [];
    const trace: RetrievalCallTrace[] = [];
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
      runId, workspaceId, actor.id, plan.category, redactSecrets(question), primaryMode,
      JSON.stringify({ ...plan, requestedMode, primaryMode }),
    ).run();
    const requiredProviders = new Set(scopes.flatMap((scope) =>
      scope.sourceIds ? ["document"] : scope.connectors.map((connector) => connector.provider),
    ));
    const recorder = createQueryWorkflowRecorder({
      queryId: runId,
      workspaceId,
      mode: primaryMode,
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
    const primaryQueryMode: ExecutedRetrievalMode = primaryMode === "thinking" ? "fast" : primaryMode;
    await recorder.record(
      "routing",
      automatic
        ? "Auto routing selected a Fast primary pass; escalation depends on the preliminary grounded result."
        : primaryMode === "thinking"
          ? `Investigate selected. QueueProof will preserve a Fast grounded baseline, then run one bounded Thinking follow-up. ${plan.reason}`
          : `Explicit ${primaryMode} mode selected. ${plan.reason}`,
      { mode: primaryMode },
    );
    const client = await hydraClientForWorkspace(workspaceId);
    let issuedCallCount = 0;
    const runQueryBatch = async (
      queryText: string,
      queryVariants: Array<"text" | "hybrid">,
      phase: "primary" | "follow_up",
      queryMode: ExecutedRetrievalMode,
    ) => {
      await Promise.all(scopes.map(async (scope) => {
        await Promise.all(queryVariants.map(async (queryBy) => {
        if (request.signal.aborted) throw new DOMException("Request cancelled.", "AbortError");
        const queryProviders = scope.sourceIds
          ? ["document"]
          : [...new Set(scope.connectors.map((item) => item.provider))];
        const callNumber = ++issuedCallCount;
        const callGraphUsage = automatic && queryMode === "thinking" ? true : plan.graphContext;
        await recorder.markQuerying(
          queryProviders,
          `${phase === "primary" ? "Primary" : "Evidence-derived follow-up"} ${queryMode} ${queryBy} query issued to HydraDB.`,
          callNumber,
          queryMode,
        );
        const callStarted = Date.now();
        const boundedSignal = queryMode === "thinking"
          ? AbortSignal.any([request.signal, AbortSignal.timeout(THINKING_QUERY_TIMEOUT_MS)])
          : request.signal;
        let response: Awaited<ReturnType<typeof client.query>>;
        try {
          response = await client.query({
            database: scope.database,
            ...(scope.collection ? { collections: [scope.collection] } : {}),
            query: queryText,
            type: "knowledge",
            query_by: queryBy,
            mode: queryMode,
            // Document-scoped retrieval asks deeper: a 346-page handbook needs a
            // wider net so exact-fact chunks in the middle/end are not missed by
            // relevance ranking. Connector scopes stay at 12 to bound evidence.
            max_results: scope.sourceIds ? 24 : 12,
            ...(scope.sourceIds ? { ids: scope.sourceIds } : {}),
            query_apps: !scope.sourceIds,
            graph_context: callGraphUsage,
            query_forceful_relations: callGraphUsage,
            recency_bias: plan.recencyBias,
            ...(payload.metadataFilters && Object.keys(payload.metadataFilters).length > 0
              ? { metadata_filters: payload.metadataFilters }
              : {}),
          }, boundedSignal);
        } catch (error) {
          if (request.signal.aborted) throw error;
          const message = error instanceof Error ? error.message : "Bounded retrieval call failed.";
          const callLatencyMs = Date.now() - callStarted;
          trace.push({ phase, mode: queryMode, estimatedCostUnits: retrievalModeCost(queryMode),
            graphUsage: callGraphUsage, connectorIds: scope.connectors.map((item) => item.id),
            providers: scope.sourceIds ? ["document"] : scope.connectors.map((item) => item.provider), database: scope.database,
            collection: scope.collection, queryBy, ok: false, status: 0,
            sourceIds: scope.sourceIds ?? [], requestId: null,
            queryTermCount: queryText.split(/\s+/).filter(Boolean).length,
            latencyMs: callLatencyMs, error: message });
          await recorder.markResponse({
            providers: queryProviders,
            ok: false,
            latencyMs: callLatencyMs,
            callCount: trace.length,
            mode: queryMode,
            evidenceByProvider: new Map(),
          });
          return;
        }
        trace.push({ phase, mode: queryMode, estimatedCostUnits: retrievalModeCost(queryMode),
          graphUsage: callGraphUsage, connectorIds: scope.connectors.map((item) => item.id),
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
            mode: queryMode,
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
          mode: queryMode,
          evidenceByProvider,
        });
        }));
      }));
    };

    const dedupeEvidence = () => evidence.filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.provider}:${candidate.id}` === `${item.provider}:${item.id}`) === index,
    );

    await runQueryBatch(retrievalQuery, retrievalQueryVariants(plan), "primary", primaryQueryMode);
    let preliminaryEvidence = dedupeEvidence();
    let preliminary = synthesiseGroundedAnswer(question, preliminaryEvidence);
    if (shouldRunFastCoverageRepair({
      category: plan.category,
      plannedMode: plan.mode,
      evidenceProviders: preliminaryEvidence.map((item) => item.provider),
      contradictionProviders: preliminary.contradictions.map((item) => item.providers),
    })) {
      const repairQuery = focusedEvidenceFollowUpQuery(
        question,
        preliminaryEvidence.map((item) => `${item.title}. ${item.excerpt}`),
      );
      if (repairQuery) {
        await recorder.record(
          "routing",
          "The Fast pass found only one provider for a multi-step state or identifier question; running one Fast join-key coverage repair.",
          { callCount: trace.length, latencyMs: Date.now() - started, mode: "fast" },
        );
        await runQueryBatch(repairQuery, ["hybrid"], "follow_up", "fast");
        preliminaryEvidence = dedupeEvidence();
        preliminary = synthesiseGroundedAnswer(question, preliminaryEvidence);
      }
    }
    if (automatic) {
      const namedProviders = providersNamedInQuestion(question, [...requiredProviders]);
      const decision = decideAutoEscalation({
        validationStatus: preliminary.validation.status,
        missingInformation: preliminary.missingInformation,
        namedProviders,
        evidenceProviders: preliminaryEvidence.map((item) => item.provider),
      });
      if (decision.escalate) {
        effectiveMode = "thinking";
        routingReason = `Auto began in Fast, then escalated to Thinking because ${decision.reasons.join("; ")}.`;
        await recorder.record("routing", routingReason, {
          callCount: trace.length, latencyMs: Date.now() - started, mode: "thinking",
        });
        const followUpQuery = focusedEvidenceFollowUpQuery(
          question,
          preliminaryEvidence.map((item) => `${item.title}. ${item.excerpt}`),
        ) ?? retrievalQuery;
        await runQueryBatch(followUpQuery, ["hybrid"], "follow_up", "thinking");
      } else {
        routingReason = "Auto kept the Fast result because the preliminary answer was grounded, no requested information was missing, and every explicitly named provider returned evidence.";
        await recorder.record("routing", routingReason, {
          callCount: trace.length, latencyMs: Date.now() - started, mode: "fast",
        });
      }
    } else if (primaryMode === "thinking") {
      const followUpQuery = focusedEvidenceFollowUpQuery(
        question,
        preliminaryEvidence.map((item) => `${item.title}. ${item.excerpt}`),
      );
      if (followUpQuery) {
        await runQueryBatch(followUpQuery, ["hybrid"], "follow_up", "thinking");
      }
    }
    const deduped = dedupeEvidence();
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
    const costUnits = trace.reduce((total, call) => total + call.estimatedCostUnits, 0);
    const actualGraphUsage = trace.some((call) => call.graphUsage);
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
        hydradb_mode: effectiveMode,
        routing_reason: routingReason,
        hydradb_call_count: trace.length,
        total_latency_ms: totalLatencyMs,
        provider_coverage: synthesis.validation.providerCoverage,
        receipt_count: citations.length,
        metadata_filters: payload.metadataFilters ?? {},
        graph_usage: actualGraphUsage,
        estimated_cost_units: costUnits,
        timestamp: new Date().toISOString(),
      },
      routing_reason: routingReason,
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
      mode: effectiveMode,
      routingReason,
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
      question: redactSecrets(question),
      ...groundedContract,
      workflow,
      evidence: synthesis.evidence,
      missingInformation: synthesis.missingInformation,
      validation: synthesis.validation,
      trace: {
        runId,
        category: plan.category,
        mode: effectiveMode,
        calls: trace,
        callCount: trace.length,
        connectorCount: connectors.results.length,
        latencyMs: totalLatencyMs,
        routingReason,
        metadataFilters: payload.metadataFilters ?? {},
        graphUsage: actualGraphUsage,
        cost: {
          unit: "HydraDB query",
          estimatedUnits: costUnits,
          estimatedUsd: null,
          basis: "Call-weight estimate: Fast calls count as 1 unit and Thinking calls count as 3; no public per-query HydraDB price is assumed.",
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
