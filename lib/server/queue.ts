import { extractQuerySources, providerFromSource } from "./hydradb-shapes";
import { hydraClientForWorkspace } from "./hydradb-account";
import { requireDb } from "./runtime";
import { audit, createId, ensureCoreSchema } from "./store";
import { DEFAULT_POLICY_VERSION, rank } from "../../packages/ranking/src";
import { isPotentialPromptInjection, sha256 } from "../../packages/security/src";
import { executionPacketSchema, type RankingInput } from "../../packages/contracts/src";
import { receiptHash, whyAboveNext } from "./decision-receipt";

type RecordValue = Record<string, unknown>;

type VerifiedConnector = {
  id: string;
  provider: string;
  database: string;
  collection: string | null;
  account_scope: string | null;
};

type Evidence = {
  id: string;
  externalId: string;
  connectorId: string;
  provider: string;
  title: string;
  excerpt: string;
  url: string | null;
  timestamp: string | null;
  ingestionTimestamp: string | null;
  authority: "primary" | "secondary";
  metadata: RecordValue;
  unsafeInstruction: boolean;
};

const asRecord = (value: unknown): RecordValue =>
  typeof value === "object" && value !== null ? (value as RecordValue) : {};

const firstText = (record: RecordValue, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const clean = (value: string, max = 900) =>
  value.replace(/\s+/g, " ").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

const actionable = /\b(will|must|need(?:s)? to|should|please|todo|action|follow[ -]?up|blocked|unblock|due|deadline|urgent|asap|ship|send|review|fix|investigate|resolve|renewal|incident|outage|escalat|deliver|approve)\b/i;

/**
 * Coerce any provider timestamp to Z-suffixed ISO-8601, or null when unparseable.
 *
 * Providers are inconsistent here — numeric offsets, microsecond precision, epoch
 * seconds — and the packet schema accepts exactly one form. Normalising once at the
 * ingestion boundary keeps that variance out of every downstream consumer.
 */
/**
 * Keyword signal detection that is not fooled by negation.
 *
 * A plain keyword test scored a ticket reading "Low priority. No customer impact." as
 * customer-relevant, because "customer" appears in it — and the deterministic
 * explanation then reported "+9 customer or revenue consequence" for an item that
 * explicitly disclaims exactly that. The keyword is only counted when it is not
 * immediately preceded by a negation.
 *
 * This is a heuristic over source prose, not sentiment analysis: it catches the common
 * "no X" / "not X" / "without X" phrasings that invert meaning, and no more.
 */
const NEGATION = /\b(no|not|non|never|without|zero|isn't|aren't|wasn't|weren't|lacks?|excluding)\b[\s\-]*(?:\w+[\s\-]+){0,2}$/i;

export function matchesSignal(text: string, pattern: RegExp): boolean {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const hit of text.matchAll(global)) {
    const preceding = text.slice(Math.max(0, (hit.index ?? 0) - 40), hit.index ?? 0);
    // One unnegated occurrence is enough for the signal to count.
    if (!NEGATION.test(preceding)) return true;
  }
  return false;
}

function isoTimestamp(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function sourceMetadata(source: RecordValue) {
  return {
    ...asRecord(source.metadata),
    ...asRecord(source.additional_metadata),
  };
}

/**
 * Pair a source with the chunk it actually came from.
 *
 * EVIDENCE INTEGRITY: this previously matched on chunk.source_id / context_id /
 * document_id / parent_id. None of those fields exist on the HydraDB chunk shape â€” the
 * real join key is `chunk.id` (used correctly in app/api/query/route.ts). So the lookup
 * never matched and every call fell through to `chunks[index]`, pairing a *deduplicated*
 * source list positionally against a *relevance-ranked* chunk list. That silently
 * attached excerpts to the wrong source, which for a product whose entire claim is
 * citable evidence is a correctness failure, not a cosmetic one.
 *
 * There is deliberately no positional fallback now. An unmatched source yields no
 * excerpt: a missing citation is honest, a confidently wrong one is not.
 */
export function matchingChunk(source: RecordValue, chunks: RecordValue[]): RecordValue {
  const candidateIds = [source.id, source.source_id, source.context_id]
    .filter(Boolean)
    .map(String);
  if (candidateIds.length === 0) return {};

  const exact = chunks.find((chunk) => {
    const chunkKeys = [chunk.id, chunk.source_id, chunk.context_id]
      .filter(Boolean)
      .map(String);
    return chunkKeys.some((key) => candidateIds.includes(key));
  });
  return exact ?? {};
}

function evidenceFromHydra(
  connector: VerifiedConnector,
  source: RecordValue,
  chunk: RecordValue,
  index: number,
): Evidence {
  const metadata = sourceMetadata(source);
  const externalId = String(
    source.id ?? source.source_id ?? source.context_id ?? metadata.external_id ?? `result-${index + 1}`,
  );
  const excerpt = clean(
    firstText(chunk, ["chunk_content", "content", "text", "excerpt"]) ??
      firstText(source, ["content", "text", "excerpt", "description"]) ??
      "",
  );
  const title = clean(
    firstText(source, ["title", "name", "subject", "filename"]) ??
      excerpt.split(/[.!?]\s/)[0] ??
      `${connector.provider} record`,
    180,
  );
  const provider = providerFromSource(source) ?? connector.provider.toLowerCase();
  return {
    id: createId("source"),
    externalId,
    connectorId: connector.id,
    provider,
    title: title || `${provider} record`,
    excerpt,
    url: firstText(source, ["url", "source_url", "web_url", "permalink"]),
    // Normalised to Z-suffixed ISO-8601. HydraDB returns timestamps such as
    // "2026-08-01T22:20:43.520449+00:00" — a numeric UTC offset with microsecond
    // precision. The execution packet schema validates these with zod .datetime(),
    // which rejects offsets by default, so real provider data failed validation and
    // queue generation returned 500 for every workspace with a live connector.
    timestamp: isoTimestamp(firstText(source, ["timestamp", "source_timestamp", "created_at", "updated_at"])),
    ingestionTimestamp: isoTimestamp(
      firstText(source, ["ingestion_timestamp", "uploaded_at", "indexed_at", "source_upload_time"]),
    ),
    authority: "primary",
    metadata,
    unsafeInstruction: isPotentialPromptInjection(excerpt),
  };
}

function freshness(timestamp: string | null) {
  if (!timestamp) return 1;
  const age = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(age)) return 1;
  if (age <= 86_400_000) return 4;
  if (age <= 7 * 86_400_000) return 3;
  if (age <= 30 * 86_400_000) return 2;
  return 1;
}

function taskTitle(evidence: Evidence) {
  const generic = /^(message|email|thread|record|untitled|slack|gmail|linear)(\s|$)/i;
  if (evidence.title.length >= 8 && !generic.test(evidence.title)) return evidence.title;
  const sentence = clean(evidence.excerpt.split(/(?<=[.!?])\s/)[0] ?? evidence.excerpt, 150);
  return sentence || evidence.title;
}

function ownerFromEvidence(evidence: Evidence) {
  return firstText(evidence.metadata, ["owner_name", "assignee_name", "assignee", "author_name"]);
}

function deadlineFromEvidence(evidence: Evidence) {
  const value = firstText(evidence.metadata, ["deadline", "due_date", "due_at"]);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function rankingInput(evidence: Evidence, id: string, title: string): RankingInput {
  const text = `${title} ${evidence.excerpt}`;
  const security = matchesSignal(text, /\b(security|vulnerability|breach|incident|outage|sev[ -]?[01])\b/i);
  const customer = matchesSignal(text, /\b(customer|client|enterprise|renewal|revenue|contract|churn)\b/i);
  const urgent = matchesSignal(text, /\b(today|urgent|asap|immediately|blocking|deadline|overdue|before (?:monday|tuesday|wednesday|thursday|friday))\b/i);
  const dependency = matchesSignal(text, /\b(blocked|blocking|unblock|depends? on|prerequisite)\b/i);
  const commitment = /\b(i will|we will|promised|committed|must|need(?:s)? to|please)\b/i.test(text);
  const owner = ownerFromEvidence(evidence);
  const fresh = freshness(evidence.timestamp);
  // Evidence completeness: the fraction of independent corroborating signals present on
  // this candidate. This replaces an invented weighted sum whose 0.38 floor meant nothing
  // could ever report below 38% confidence â€” including a candidate with no owner, no
  // timestamp, no link and no actionable verb â€” and whose 0.96 ceiling was unreachable
  // (the weights summed to 0.86), so the cap was dead code presented as a measurement.
  //
  // This value is deliberately NOT a probability. It answers "how much of the evidence we
  // look for is actually here", which is the question the receipt needs, and it can
  // legitimately reach 0 when nothing corroborates the candidate.
  const completenessSignals = [
    actionable.test(text),
    Boolean(owner),
    Boolean(evidence.timestamp),
    Boolean(evidence.url),
  ];
  const confidence = completenessSignals.filter(Boolean).length / completenessSignals.length;
  return {
    id,
    title,
    status: /\b(completed|resolved|closed|cancelled)\b/i.test(text) ? "completed" : dependency ? "blocked" : "open",
    businessImpact: security || customer ? 18 : urgent ? 14 : 9,
    urgency: urgent ? 17 : evidence.timestamp ? 10 : 6,
    dependencyUnlock: dependency ? 15 : 5,
    customerRevenue: customer ? 11 : 2,
    incidentSecurity: security ? 10 : 0,
    commitmentStrength: commitment ? 8 : 4,
    authorityReliability: 5,
    evidenceFreshness: fresh,
    quickWinLeverage: /\b(send|review|approve|reply|merge|fix)\b/i.test(text) ? 5 : 2,
    penalties: {
      likelyResolved: /\b(completed|resolved|closed|cancelled)\b/i.test(text) ? 40 : 0,
      duplicate: 0,
      unresolvedDependency: dependency ? 8 : 0,
      weakEvidence: evidence.excerpt.length < 40 ? 9 : 0,
      conflictingEvidence: 0,
      staleEvidence: fresh === 1 ? 5 : 0,
      missingOwner: owner ? 0 : 6,
      lowActionability: actionable.test(text) ? 0 : 8,
    },
    confidence,
    evidence: [
      {
        sourceId: evidence.id,
        provider: evidence.provider,
        externalId: evidence.externalId,
        title: evidence.title,
        excerpt: evidence.excerpt,
        timestamp: evidence.timestamp,
        ingestionTimestamp: evidence.ingestionTimestamp,
        url: evidence.url,
        authority: evidence.authority,
        metadata: evidence.metadata,
      },
    ],
  };
}

export async function generateQueueForWorkspace(workspaceId: string, actorId: string) {
  await ensureCoreSchema();
  const db = requireDb();
  const connectors = await db
    .prepare(
      `SELECT id, provider, database, collection, account_scope
       FROM connectors WHERE workspace_id = ? AND state = 'data_verified'
       ORDER BY provider ASC`,
    )
    .bind(workspaceId)
    .all<VerifiedConnector>();
  if (!connectors.results.length) {
    throw new Response("Verify at least one live connector before generating a queue.", { status: 409 });
  }

  const client = await hydraClientForWorkspace(workspaceId);
  const query =
    "Find current unresolved commitments, promised work, deadlines, blockers, escalations, incidents, customer risks, and explicit required actions. Return original source records.";
  const retrieved: Evidence[] = [];
  const diagnostics: Array<Record<string, unknown>> = [];

  await Promise.all(connectors.results.map(async (connector) => {
    const started = Date.now();
    const response = await client.query({
      database: connector.database,
      ...(connector.collection ? { collections: [connector.collection] } : {}),
      query,
      type: "knowledge",
      query_by: "hybrid",
      mode: "thinking",
      max_results: 20,
      query_apps: true,
      graph_context: true,
      query_forceful_relations: true,
      recency_bias: 0.3,
    });
    diagnostics.push({
      connectorId: connector.id,
      provider: connector.provider,
      ok: response.ok,
      status: response.status,
      requestId: response.requestId,
      latencyMs: Date.now() - started,
      error: response.error,
    });
    if (!response.ok) return;
    const extracted = extractQuerySources(response.data);
    extracted.sources.forEach((source, index) => {
      const evidence = evidenceFromHydra(
        connector,
        source,
        matchingChunk(source, extracted.chunks),
        index,
      );
      if (evidence.excerpt || evidence.title) retrieved.push(evidence);
    });
  }));

  const safeEvidence = retrieved
    .filter((item) => !item.unsafeInstruction)
    .filter((item) => actionable.test(`${item.title} ${item.excerpt}`))
    .filter((item, index, all) => all.findIndex((other) => `${other.provider}:${other.externalId}` === `${item.provider}:${item.externalId}`) === index)
    .slice(0, 18);
  if (!safeEvidence.length) {
    await audit({
      workspaceId,
      actorId,
      operation: "queue.generate",
      outcome: "failure",
      metadata: { reason: "no_actionable_evidence", diagnostics },
    });
    throw new Response(
      "Live retrieval completed, but no actionable commitment with safe source evidence was found.",
      { status: 422 },
    );
  }

  const rankingRunId = createId("ranking");
  const ranked = safeEvidence.map((evidence) => {
    const taskId = createId("task");
    const title = taskTitle(evidence);
    const input = rankingInput(evidence, taskId, title);
    return { evidence, taskId, title, input, result: rank(input) };
  }).sort((a, b) => b.result.finalScore - a.result.finalScore || a.taskId.localeCompare(b.taskId));

  const packetIds: string[] = [];
  const statements = [
    db.prepare(
      `INSERT INTO ranking_runs
       (id, workspace_id, policy_version, input_hash, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      rankingRunId,
      workspaceId,
      DEFAULT_POLICY_VERSION,
      await sha256(JSON.stringify(ranked.map((item) => item.input))),
      new Date().toISOString(),
      new Date().toISOString(),
    ),
  ];

  for (let index = 0; index < ranked.length; index += 1) {
    const item = ranked[index];
    const packetId = createId("packet");
    packetIds.push(packetId);
    const owner = ownerFromEvidence(item.evidence);
    const deadline = deadlineFromEvidence(item.evidence);
    const packet = executionPacketSchema.parse({
      packet_id: packetId,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      policy_version: item.result.policyVersion,
      task: {
        title: item.title,
        objective: item.evidence.excerpt,
        owner,
        project: firstText(item.evidence.metadata, ["project_name", "project"]),
        deadline,
        priority_score: item.result.finalScore,
        confidence: item.result.confidence,
      },
      why_now: item.result.explanation,
      constraints: item.input.status === "blocked" ? ["The source indicates an unresolved dependency."] : [],
      dependencies: item.input.status === "blocked" ? ["Resolve the evidenced blocker before direct execution."] : [],
      acceptance_criteria: ["Confirm completion against the cited source record."],
      evidence: [{
        sourceId: item.evidence.id,
        provider: item.evidence.provider,
        externalId: item.evidence.externalId,
        title: item.evidence.title,
        timestamp: item.evidence.timestamp,
        ingestionTimestamp: item.evidence.ingestionTimestamp,
        url: item.evidence.url,
        excerpt: item.evidence.excerpt,
        authority: item.evidence.authority,
        metadata: item.evidence.metadata,
      }],
      contradictions: [],
      missing_information: [!owner ? "Owner is not explicit in source metadata." : null, !deadline ? "Deadline is not explicit in source metadata." : null].filter(Boolean),
      recommended_agent: "human",
      permissions: { read: [item.evidence.provider], write: [], approval_required: true },
      completion_callback: { type: "mcp_tool", tool: "queueproof_report_execution_result" },
    });

    // Explain the gap to the next-ranked item, computed from score components only.
    // The last item has no runner-up, so it carries null rather than an invented reason.
    const runnerUp = ranked[index + 1];
    const whyAbove = runnerUp ? whyAboveNext(item.input, runnerUp.input) : null;

    // The receipt hash is computed once, here, and persisted inside packet_json. Every
    // surface — web, API, MCP, CLI — reads that same stored object, so parity holds by
    // construction rather than by three code paths agreeing to recompute it identically.
    const packetWithProof = {
      ...packet,
      why_above_next: whyAbove,
      receipt_hash: await receiptHash({ ...packet, why_above_next: whyAbove }),
    };

    statements.push(
      db.prepare(
        `INSERT INTO source_references
         (id, workspace_id, provider, connector_id, external_id, title, excerpt, source_url,
          source_timestamp, ingestion_timestamp, authority, content_hash, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        item.evidence.id, workspaceId, item.evidence.provider, item.evidence.connectorId,
        item.evidence.externalId, item.evidence.title, item.evidence.excerpt, item.evidence.url,
        item.evidence.timestamp, item.evidence.ingestionTimestamp, item.evidence.authority,
        await sha256(`${item.evidence.provider}:${item.evidence.externalId}:${item.evidence.excerpt}`),
        JSON.stringify(item.evidence.metadata),
      ),
      db.prepare(
        `INSERT INTO task_candidates
         (id, workspace_id, title, recommended_action, owner, project, customer, deadline,
          status, attributes_json, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        item.taskId, workspaceId, item.title,
        item.input.status === "blocked" ? "clarify" : "execute", owner,
        firstText(item.evidence.metadata, ["project_name", "project"]),
        firstText(item.evidence.metadata, ["customer_name", "customer"]),
        deadline, item.input.status, JSON.stringify(item.input), Math.round(item.result.confidence * 100),
      ),
      db.prepare(
        `INSERT INTO task_evidence
         (id, workspace_id, task_id, source_id, relation, claim)
         VALUES (?, ?, ?, ?, 'supports', ?)`,
      ).bind(createId("evidence"), workspaceId, item.taskId, item.evidence.id, item.evidence.excerpt),
      db.prepare(
        `INSERT INTO ranking_items
         (id, workspace_id, ranking_run_id, task_id, rank, component_scores_json,
          penalties_json, final_score, confidence, explanation_json, sensitivity_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        createId("ranked"), workspaceId, rankingRunId, item.taskId, index + 1,
        JSON.stringify(item.result.componentScores), JSON.stringify(item.result.penalties),
        Math.round(item.result.finalScore), Math.round(item.result.confidence * 100),
        // Persist the exact RankingInput that produced this row. It was previously
        // written as {}, which made the ranking unreplayable: a counterfactual could not
        // re-score the item, and explain_priority's promised sensitivity was always
        // empty. Storing the input is what makes scoring deterministic *and* auditable —
        // the same input and policy version must always yield the same score.
        JSON.stringify(item.result.explanation), JSON.stringify(item.input),
      ),
      db.prepare(
        `INSERT INTO execution_packets
         (id, workspace_id, task_id, policy_version, packet_json, status)
         VALUES (?, ?, ?, ?, ?, 'available')`,
      ).bind(packetId, workspaceId, item.taskId, item.result.policyVersion, JSON.stringify(packetWithProof)),
    );
  }
  statements.push(
    db.prepare(
      `INSERT INTO queue_snapshots (id, workspace_id, ranking_run_id, item_ids_json, reason)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(createId("queue"), workspaceId, rankingRunId, JSON.stringify(packetIds), "live_evidence_refresh"),
  );
  await db.batch(statements);
  await audit({
    workspaceId,
    actorId,
    operation: "queue.generate",
    targetType: "ranking_run",
    targetId: rankingRunId,
    outcome: "success",
    metadata: { taskCount: ranked.length, sourceCount: safeEvidence.length, diagnostics },
  });
  return listQueueForWorkspace(workspaceId);
}

export async function listQueueForWorkspace(workspaceId: string) {
  await ensureCoreSchema();
  const latest = await requireDb()
    .prepare(
      `SELECT id, completed_at FROM ranking_runs
       WHERE workspace_id = ? ORDER BY completed_at DESC, created_at DESC LIMIT 1`,
    )
    .bind(workspaceId)
    .first<{ id: string; completed_at: string }>();
  if (!latest) return { generatedAt: null, items: [] };
  const rows = await requireDb()
    .prepare(
      `SELECT ri.rank, ri.final_score AS finalScore, ri.confidence,
              ri.component_scores_json AS componentScores, ri.penalties_json AS penalties,
              tc.id AS taskId, tc.title, tc.recommended_action AS recommendedAction,
              tc.owner, tc.project, tc.customer, tc.deadline, tc.status,
              ep.id AS packetId, ep.packet_json AS packetJson
       FROM ranking_items ri
       JOIN task_candidates tc ON tc.id = ri.task_id
       JOIN execution_packets ep ON ep.task_id = tc.id AND ep.workspace_id = tc.workspace_id
       WHERE ri.workspace_id = ? AND ri.ranking_run_id = ?
       ORDER BY ri.rank ASC`,
    )
    .bind(workspaceId, latest.id)
    .all<Record<string, unknown>>();
  return {
    generatedAt: latest.completed_at,
    items: rows.results.map((row) => ({
      ...row,
      componentScores: JSON.parse(String(row.componentScores ?? "{}")),
      penalties: JSON.parse(String(row.penalties ?? "{}")),
      packet: JSON.parse(String(row.packetJson ?? "{}")),
      packetJson: undefined,
    })),
  };
}

export async function executionPacketForWorkspace(workspaceId: string, packetId: string) {
  await ensureCoreSchema();
  const row = await requireDb()
    .prepare(
      `SELECT packet_json FROM execution_packets
       WHERE workspace_id = ? AND id = ? LIMIT 1`,
    )
    .bind(workspaceId, packetId)
    .first<{ packet_json: string }>();
  return row ? JSON.parse(row.packet_json) : null;
}
