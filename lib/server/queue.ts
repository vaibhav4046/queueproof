import { extractQuerySources, matchingChunks, providerFromSource, sourceBelongsToConnector } from "./hydradb-shapes";
import { hydraClientForWorkspace } from "./hydradb-account";
import { requireDb } from "./runtime";
import { audit, createId, ensureCoreSchema } from "./store";
import { ACTIVE_FORMULA, DEFAULT_POLICY_VERSION, rank } from "../../packages/ranking/src";
import { isPotentialPromptInjection, sha256 } from "../../packages/security/src";
import { executionPacketSchema, type RankingInput } from "../../packages/contracts/src";
import { receiptHash, whyAboveNext } from "./decision-receipt";

// Compatibility export for the evidence-integrity regression test and consumers that
// historically imported the join helper from the queue module.
export { matchingChunk } from "./hydradb-shapes";

type RecordValue = Record<string, unknown>;

type VerifiedConnector = {
  id: string;
  hydradb_connector_id: string;
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

type TaskEvidence = Evidence & {
  taskSpan: string;
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

const stableTextFingerprint = (value: string) => {
  let primary = 0x811c9dc5;
  let secondary = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    primary = Math.imul(primary ^ code, 0x01000193);
    secondary = Math.imul(secondary ^ code, 0x85ebca6b);
  }
  return `${(primary >>> 0).toString(16).padStart(8, "0")}${(secondary >>> 0).toString(16).padStart(8, "0")}`;
};

/** Stable across independently relevance-ordered Hydra query responses. */
export function hydraChunkIdentity(chunk: RecordValue): string | null {
  const explicit = firstText(chunk, ["chunk_uuid", "chunk_id", "chunkId"]);
  if (explicit) return explicit;
  const content = firstText(chunk, ["chunk_content", "content", "text", "excerpt"]);
  return content ? `content-${stableTextFingerprint(content)}` : null;
}

/** Collapse repeated query hits without collapsing distinct tasks from one source. */
export function queueEvidenceDedupKey(
  evidence: Pick<Evidence, "provider" | "externalId" | "metadata"> & { taskSpan: string },
): string {
  const sourceExternalId = firstText(evidence.metadata, ["source_external_id"]) ?? evidence.externalId;
  return `${evidence.provider}:${sourceExternalId}:${clean(evidence.taskSpan.toLowerCase(), 360)}`;
}

/** Queue packets must represent positively ranked, actionable work. */
export const canEmitQueueScore = (score: number) => Number.isFinite(score) && score > 0;

const actionable = /\b(will|must|need(?:s)? to|should|please|todo|action|follow[ -]?up|blocked|unblock|due|deadline|urgent|asap|ship|send|review|fix|investigate|resolve|renewal|incident|outage|escalat|deliver|approve)\b/i;

const actorCommitmentSignals = [
  /\b(?:i|we|engineering|the team|support|security|operations)\s+(?:will|'ll|must|should|need(?:s)? to|commit(?:s|ted)?|promis(?:e[sd]?|ed))\b/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:will|must|should|needs? to|commits?|committed|promises?|promised)\b/,
];

const strongTaskSignals = [
  ...actorCommitmentSignals,
  /\b(?:committed|promised)\b/i,
  /\b(?:blocked|blocking|overdue|still\s+(?:showing\s+as\s+)?open|remains?\s+open|escalat(?:ed|ion))\b/i,
  /\bdeadline\b[^.!?]{0,90}\b(?:moved|changed|before|by|on|is|was|to)\b/i,
  /\b(?:slipped|delayed|postponed|moved)\b[^.!?]{0,90}\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i,
  /\b(?:is|are|remains?)\s+(?:(?:being\s+)(?:fixed|investigated|reviewed|worked)|open|blocked|in\s+progress)\b/i,
  /^(?:action\s*:\s*)?(?:please\s+)?(?:review|fix|send|ship|deliver|approve|resolve|investigate|renew|reply|merge|unblock|report|raise|schedule|confirm|complete|provide|update|unsubscribe)\b/i,
  /^(?:must|need to|should)\s+(?:review|fix|send|ship|deliver|approve|resolve|investigate|renew|reply|merge|unblock|report|raise|schedule|confirm|complete|provide|update|unsubscribe)\b/i,
  /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:review|fix|send|ship|deliver|approve|resolve|investigate|renew|reply|merge|unblock|report|raise|schedule|confirm|complete|provide|update|unsubscribe)\b/i,
  /\bplease\s+(?:review|fix|send|ship|deliver|approve|resolve|investigate|renew|reply|merge|unblock|report|raise|schedule|confirm|complete|provide|update|unsubscribe)\b/i,
  /\b(?:action|required action)\s*:\s*(?:review|fix|send|ship|deliver|approve|resolve|investigate|renew|reply|merge|unblock|report|raise|schedule|confirm|complete|provide|update|unsubscribe)\b/i,
  /\b[A-Z][A-Z0-9]{1,9}-\d+\b[^.!?]{0,80}\b(?:will|must|need(?:s)? to|is\s+due|remains?\s+open|is\s+blocked)\b/i,
  /\b(?:[A-Z][A-Z0-9]{1,9}-\d+|task|issue|renewal|follow[ -]?up)\b[^.!?]{0,80}\b(?:is|are)?\s*due\b/i,
  /\b(?:reported|active|ongoing|unresolved)\b[^.!?]{0,90}\b(?:incident|outage)\b/i,
  /\b(?:incident|outage)\b[^.!?]{0,90}\b(?:reported|active|ongoing|blocking|unresolved)\b/i,
];

const hasPairedContext = (value: string, left: RegExp, right: RegExp) =>
  left.test(value) && right.test(value);

const hasCandidatePairedContext = (window: string, candidate: string, left: RegExp, right: RegExp) =>
  hasPairedContext(window, left, right) && (left.test(candidate) || right.test(candidate));

const isObjectlessCompletionCandidate = (candidate: string) => {
  const match = candidate.match(
    /^(?:(?:action\s*:\s*)?(?:please\s+)?(?:complete|finish)|(?:can|could|would)\s+you\s+(?:please\s+)?(?:complete|finish)|(?:must|need to|should)\s+(?:complete|finish)|(?:i|we|you|engineering|the team|support|security|operations|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|must|should|need(?:s)? to)\s+(?:complete|finish))(?:\s+(?:it|this|them))?\s*(.*?)[.!?]?$/i,
  );
  if (!match) return false;
  const suffix = match[1]!.trim();
  if (!suffix) return true;
  return /^(?:(?:by|on)\s+)?(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:this|next)\s+(?:week|month|quarter)|end\s+of\s+(?:day|week|month|quarter)|eod|cob|close\s+of\s+business|\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?z?)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+\d{4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)$/i.test(suffix);
};

const isTrainingCandidateContext = (window: string, candidate: string) =>
  hasPairedContext(
    window,
    /\b(?:codelabs?|mcq assessment|workshops? completed)\b/i,
    /\b(?:submission deadline|complete|finish|assessment|workshops?)\b/i,
  ) && (
    /\b(?:codelabs?|mcq assessment|workshops?|assessment)\b/i.test(candidate) ||
    isObjectlessCompletionCandidate(candidate)
  );

/** Reject non-work candidate windows without discarding unrelated tasks in one source. */
const isNonLiveCandidateContext = (window: string, candidate: string) =>
  hasCandidatePairedContext(
    window,
    candidate,
    /\bhomework\b/i,
    /\b(?:question\s+\d+|provide (?:the )?subject and body|based on the above findings|section\s+\d+)\b/i,
  ) ||
  hasCandidatePairedContext(
    window,
    candidate,
    /\b(?:academic support|academic writing)\b/i,
    /\b(?:student pricing|assignment help|thesis|dissertation|our services?)\b/i,
  ) ||
  hasCandidatePairedContext(
    window,
    candidate,
    /\b(?:employment agreement|successful application)\b/i,
    /\b(?:exclusive jurisdiction|confidential and proprietary|for internal use only)\b/i,
  ) ||
  hasCandidatePairedContext(
    window,
    candidate,
    /\b(?:successful application|pre-contract documentation|right to work|photo identification|passport|e-?visa|national insurance)\b/i,
    /\b(?:written offer|onboarding|identity documents?|payroll employment)\b/i,
  ) ||
  /\bno payment(?: of any kind)?\b[\s\S]{0,180}\b(?:equipment|training|software|onboarding)\b/i.test(candidate) ||
  isTrainingCandidateContext(window, candidate);

const hasDiscriminativeNonLiveMarker = (candidate: string) =>
  /\b(?:homework|question\s+\d+|academic support|academic writing|student pricing|assignment help|employment agreement|successful application|pre-contract documentation|right to work|photo identification|passport|e-?visa|national insurance|written offer|onboarding|identity documents?|payroll employment|codelabs?|mcq assessment|workshops? completed)\b/i.test(candidate);

const isNonLiveSourceArtifact = (header: string, corpus: string) =>
  hasPairedContext(
    header,
    /\bpre-contract documentation\b/i,
    /\bsuccessful application\b/i,
  ) ||
  (
    /\bhomework\b/i.test(header) &&
    hasPairedContext(
      corpus,
      /\bhomework\b/i,
      /\b(?:question\s+\d+|provide (?:the )?subject and body|based on the above findings|section\s+\d+)\b/i,
    )
  ) ||
  (
    /\b(?:your receipt|receipt from)\b/i.test(header) &&
    hasPairedContext(
      corpus,
      /\b(?:invoice number|date of issue|bill to)\b/i,
      /\b(?:amount due|date due|subtotal|payment address|vat)\b/i,
    )
  );

const negativeObligation = /\b(?:must|should|need(?:s)? to)\s+not\b/i;
const nonTaskCandidateContext = /\b(?:(?:recipients?|employee|agreement|information).{0,100}(?:confidential|proprietary|jurisdiction|unauthori[sz]ed)|(?:agreement|parties).{0,100}(?:operation of law|automatically|binding|governed|jurisdiction)|students?.{0,100}(?:assignment|coursework|homework|submit)|(?:academic|assignment|coursework|homework|essay|thesis|dissertation).{0,100}(?:submit|complete|deadline)|example (?:issue|task|answer)|question\s+\d+.{0,100}provide|help (?:you|your)|business grow|achieve (?:your|their) goals|special offer|student pricing|for internal use only|must not be shared|all rights reserved)\b/i;
const exactTaskIdentity = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;
const operationalTaskAction = /\b(?:review|fix|send|ship|deliver|deploy|launch|approve|resolve|investigate|renew|reply|respond|response|merge|unblock|report|raise|schedule|confirm|complete|finish|provide|update|write|prepare|submit|rotate|book|call|refund|own|unsubscribe)\b/i;
const liveTaskState = /\b(?:blocked|blocking|overdue|due|still\s+(?:showing\s+as\s+)?open|remains?\s+open|(?:is|are)\s+open|(?:is|are|remains?)\s+being\s+(?:fixed|investigated|reviewed|worked)|in\s+progress|escalat(?:ed|ion)|incident|outage|deadline|slipped|delayed|postponed|moved)\b/i;
const temporalTaskAnchor = /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this\s+(?:week|month|quarter)|next\s+(?:week|month|quarter)|end\s+of\s+(?:day|week|month|quarter)|eod|cob|close\s+of\s+business|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i;

const hasConcreteTaskStructure = (entry: string) =>
  exactTaskIdentity.test(entry) ||
  operationalTaskAction.test(entry) ||
  liveTaskState.test(entry) ||
  (temporalTaskAnchor.test(entry) && actorCommitmentSignals.some((pattern) => pattern.test(entry)));

const hasLocalActionableTaskIdentity = (entry: string) => {
  const identityPattern = new RegExp(exactTaskIdentity.source, "g");
  return [...entry.matchAll(identityPattern)].some((match) => {
    const index = match.index ?? 0;
    const before = entry.slice(Math.max(0, index - 70), index);
    // Invoice numbers and attachment filenames share the lexical shape of issue IDs.
    if (/\b(?:attachment|file(?:name)?|invoice(?: number)?|receipt)\b[^.!?\n]{0,60}$/i.test(before)) return false;
    const local = entry.slice(Math.max(0, index - 120), index + match[0].length + 120);
    return operationalTaskAction.test(local) || liveTaskState.test(local) ||
      actorCommitmentSignals.some((pattern) => pattern.test(local));
  });
};

const isExplicitlyIndependentCandidate = (entry: string) =>
  /^(?:[-*]\s*)?(?:separately|independently|on a separate note|separate action)\b/i.test(entry);

/**
 * Extract one local, bounded task claim instead of scoring a whole source record.
 * Scattered words such as "incident", "review", and "deadline" in a handbook must not
 * combine into a synthetic task; one sentence/bullet must carry an explicit commitment,
 * live blocker, escalation, deadline change, or active incident.
 */
export function extractActionableTaskSpan(value: string): string | null {
  const corpus = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .trim()
    .slice(0, 7_000);
  if (!corpus) return null;
  const candidates: string[] = [];
  const segments = corpus
    .split(/\r?\n+|(?<=[.!?])\s+|\s+(?=[*-]\s+)/)
    .map((entry) => clean(entry, 1_200))
    .filter(Boolean);
  // Read the source title before bullet-aware segmentation: titles commonly contain
  // " - " (for example, pre-contract email subjects), which is not a list boundary.
  const sourceHeader = clean(corpus.split(/\r?\n+|(?<=[.!?])\s+/)[0] ?? "", 1_200);
  const sourceHeaderHasTaskIdentity = exactTaskIdentity.test(sourceHeader);
  const sourceIsNonLiveArtifact = isNonLiveSourceArtifact(sourceHeader, corpus);
  for (let index = 0; index < segments.length; index += 1) {
    const entry = segments[index]!;
    const identityBacked = sourceHeaderHasTaskIdentity || exactTaskIdentity.test(entry);
    if (
      sourceIsNonLiveArtifact &&
      !sourceHeaderHasTaskIdentity &&
      !hasLocalActionableTaskIdentity(entry) &&
      !isExplicitlyIndependentCandidate(entry)
    ) continue;
    if (entry.length < 12 || !strongTaskSignals.some((pattern) => pattern.test(entry))) continue;
    if (!hasConcreteTaskStructure(entry)) continue;
    if (negativeObligation.test(entry) && !identityBacked) continue;
    if (nonTaskCandidateContext.test(entry) && !identityBacked) continue;
    const nextSegment = segments[index + 1];
    const linkedForwardContext = /^(?:this|that|it|these|those)\s+(?:is|are|was|were|means?|follows?|relates?|refers?|concerns?|covers?)\b/i.test(nextSegment ?? "") &&
      !/\b(?:separate|unrelated|independent|different|not\s+related)\b/i.test(nextSegment ?? "");
    const includeNext = hasDiscriminativeNonLiveMarker(entry) || (
      isObjectlessCompletionCandidate(entry) && linkedForwardContext
    );
    const localWindow = [
      segments[index - 1],
      entry,
      ...(includeNext ? [nextSegment] : []),
    ].filter(Boolean).join(" ");
    if (isNonLiveCandidateContext(localWindow, entry) && !identityBacked) continue;
    candidates.push(entry);
  }
  if (!candidates.length) return null;
  const score = (entry: string) =>
    (entry.match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g)?.length ?? 0) * 4 +
    (/\b(?:committed|commits?|promised|will|must|need(?:s)? to)\b/i.test(entry) ? 3 : 0) +
    (/\b(?:customer|enterprise|incident|outage|blocked|deadline|overdue|escalat)\b/i.test(entry) ? 2 : 0) +
    (/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December))\b/i.test(entry) ? 1 : 0);
  const selected = [...candidates].sort((left, right) => score(right) - score(left) || left.length - right.length)[0]!;
  if (selected.length <= 360) return selected;
  const signalIndex = Math.max(0, strongTaskSignals.map((pattern) => selected.search(pattern)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0);
  const start = Math.max(0, signalIndex - 90);
  return clean(`${start > 0 ? "..." : ""}${selected.slice(start, start + 352)}${start + 352 < selected.length ? "..." : ""}`, 360);
}

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

const DOCUMENT_FILE_EXTENSION = /\.(?:pdf|docx?|md|markdown|txt|rtf|odt|csv|tsv|json|ya?ml|toml|html?|pptx?|xlsx?)$/i;

/**
 * Identify Hydra document/file results from both the official source shape and the
 * matched chunk. A file may carry a misleading `app_provider` inherited from the
 * database that indexed it, so provider labels are intentionally not consulted.
 */
export function isHydraDocumentSource(source: RecordValue, chunk: RecordValue = {}): boolean {
  const metadata = {
    ...sourceMetadata(source),
    ...asRecord(chunk.metadata),
    ...asRecord(chunk.additional_metadata),
  };
  const combined = { ...metadata, ...source, ...chunk };
  const kind = firstText(combined, ["app_kind", "source_type", "type", "kind", "object_type"]);
  const mime = firstText(combined, ["mime_type", "mimetype", "content_type", "media_type"]);
  const filename = firstText(combined, ["filename", "file_name", "source_title", "title", "name"]);
  return /^(?:file|document|uploaded_document|pdf)$/i.test(kind ?? "") ||
    /^(?:application\/(?:pdf|msword|rtf|vnd\.(?:ms-|openxmlformats-officedocument))|text\/rtf)/i.test(mime ?? "") ||
    DOCUMENT_FILE_EXTENSION.test(filename ?? "");
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
function evidenceFromHydra(
  connector: VerifiedConnector,
  source: RecordValue,
  chunk: RecordValue,
): Evidence {
  const metadata = {
    ...sourceMetadata(source),
    ...asRecord(chunk.metadata),
    ...asRecord(chunk.additional_metadata),
  };
  const sourceIdentity = source.id ?? source.source_id ?? source.context_id ?? metadata.external_id;
  const sourceExternalId = sourceIdentity === undefined || sourceIdentity === null || String(sourceIdentity).trim() === ""
    ? `result-${stableTextFingerprint(JSON.stringify(source))}`
    : String(sourceIdentity);
  const chunkExternalId = hydraChunkIdentity(chunk);
  const externalId = chunkExternalId ? `${sourceExternalId}#${chunkExternalId}` : sourceExternalId;
  const excerpt = clean(
    firstText(chunk, ["chunk_content", "content", "text", "excerpt"]) ??
      firstText(source, ["content", "text", "excerpt", "description"]) ??
      "",
    2_400,
  );
  const title = clean(
    firstText(source, ["title", "name", "subject", "filename"]) ??
      firstText(chunk, ["source_title", "title", "name", "filename"]) ??
      excerpt.split(/[.!?]\s/)[0] ??
      `${connector.provider} record`,
    180,
  );
  const provider = connector.provider === "document"
    ? "document"
    : providerFromSource(source) ?? connector.provider.toLowerCase();
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
    metadata: { ...metadata, source_external_id: sourceExternalId },
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

function taskTitle(evidence: TaskEvidence) {
  const generic = /^(message|email|thread|record|untitled|slack|gmail|linear)(\s|$)/i;
  if (evidence.title.length >= 8 && !generic.test(evidence.title) && !DOCUMENT_FILE_EXTENSION.test(evidence.title)) {
    return evidence.title;
  }
  return clean(evidence.taskSpan, 150) || evidence.title;
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

/**
 * Conservative task identity: exact work IDs and distinctive CamelCase product names
 * may join records; generic keywords never do. Ambiguous records stay separate.
 */
export function taskClusterKey(evidence: Pick<Evidence, "provider" | "externalId" | "title" | "excerpt">) {
  const corpus = `${evidence.title} ${evidence.excerpt}`;
  const exactIds = [...new Set(corpus.match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g) ?? [])].sort();
  if (exactIds.length) return `id:${exactIds.join("|")}`;
  const productNames = [...new Set(corpus.match(/\b[A-Z][a-z]{2,}[A-Z][A-Za-z0-9]{2,}\b/g) ?? [])]
    .filter((token) => !["QueueProof", "HydraDB"].includes(token))
    .sort();
  if (productNames.length) return `entity:${productNames.join("|")}`;
  return `source:${evidence.provider}:${evidence.externalId}`;
}

type ClusterableEvidence = Pick<Evidence, "provider" | "externalId" | "title" | "excerpt"> & {
  taskSpan?: string;
  timestamp?: string | null;
};

const clusteringCorpus = (evidence: ClusterableEvidence) =>
  `${evidence.title} ${evidence.taskSpan ?? evidence.excerpt}`;

const exactTaskIds = (evidence: ClusterableEvidence) => new Set(
  clusteringCorpus(evidence).match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g) ?? [],
);

const distinctiveEntities = (evidence: ClusterableEvidence) => new Set(
  (clusteringCorpus(evidence).match(/\b[A-Z][a-z]{2,}[A-Z][A-Za-z0-9]{2,}\b/g) ?? [])
    .filter((token) => !["QueueProof", "HydraDB"].includes(token)),
);

const TASK_WORDING_STOPWORDS = new Set([
  "about", "after", "against", "before", "being", "between", "could", "from", "have",
  "into", "must", "need", "needs", "please", "should", "someone", "that", "their", "there",
  "these", "this", "those", "through", "under", "until", "very", "what", "when", "where",
  "which", "while", "will", "with", "would", "your",
]);

const taskWordingTokens = (evidence: ClusterableEvidence) => new Set(
  clean(evidence.taskSpan ?? evidence.excerpt, 360)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length >= 3 && !TASK_WORDING_STOPWORDS.has(token)) ?? [],
);

const overlaps = (left: ReadonlySet<string>, right: ReadonlySet<string>) =>
  [...left].some((value) => right.has(value));

const MONTH_NUMBER = new Map([
  ["jan", "01"], ["january", "01"], ["feb", "02"], ["february", "02"],
  ["mar", "03"], ["march", "03"], ["apr", "04"], ["april", "04"],
  ["may", "05"], ["jun", "06"], ["june", "06"], ["jul", "07"], ["july", "07"],
  ["aug", "08"], ["august", "08"], ["sep", "09"], ["sept", "09"], ["september", "09"],
  ["oct", "10"], ["october", "10"], ["nov", "11"], ["november", "11"],
  ["dec", "12"], ["december", "12"],
]);
const WEEKDAY_NUMBER = new Map([
  ["sunday", 0], ["monday", 1], ["tuesday", 2], ["wednesday", 3],
  ["thursday", 4], ["friday", 5], ["saturday", 6],
]);
const MONTH_PATTERN = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const absoluteDateAnchor = (year: string, month: string, day: string) =>
  `absolute:${year}:${month}-${day.padStart(2, "0")}`;

const utcDateAnchor = (date: Date) => absoluteDateAnchor(
  String(date.getUTCFullYear()),
  String(date.getUTCMonth() + 1).padStart(2, "0"),
  String(date.getUTCDate()),
);

const taskDateAnchors = (evidence: ClusterableEvidence) => {
  const text = clean(evidence.taskSpan ?? evidence.excerpt, 360).toLowerCase();
  const anchors = new Set<string>();
  const timestamp = evidence.timestamp ? new Date(evidence.timestamp) : null;
  const base = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp : null;
  let unresolvedRelative = false;

  const withoutIsoDates = text.replace(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g, " ");
  if (/\b(?:next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:this|next)\s+(?:week|month|quarter)|end\s+of\s+(?:day|week|month|quarter)|eod|cob|close\s+of\s+business|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/i.test(withoutIsoDates)) {
    unresolvedRelative = true;
  }

  for (const match of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    anchors.add(absoluteDateAnchor(match[1]!, match[2]!, match[3]!));
  }
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?(?:,?\\s+(\\d{4}))?\\b`, "g");
  for (const match of text.matchAll(dayFirst)) {
    anchors.add(absoluteDateAnchor(match[3] ?? (base ? String(base.getUTCFullYear()) : "*"), MONTH_NUMBER.get(match[2]!)!, match[1]!));
  }
  const monthFirst = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "g");
  for (const match of text.matchAll(monthFirst)) {
    anchors.add(absoluteDateAnchor(match[3] ?? (base ? String(base.getUTCFullYear()) : "*"), MONTH_NUMBER.get(match[1]!)!, match[2]!));
  }

  for (const relativeMatch of text.matchAll(/\b(?:(next)\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g)) {
    if (relativeMatch[1]) continue;
    const relative = relativeMatch[2]!;
    if (!base) {
      unresolvedRelative = true;
      continue;
    }
    const resolved = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
    if (relative === "tomorrow") resolved.setUTCDate(resolved.getUTCDate() + 1);
    else if (relative !== "today") {
      const target = WEEKDAY_NUMBER.get(relative)!;
      resolved.setUTCDate(resolved.getUTCDate() + ((target - resolved.getUTCDay() + 7) % 7));
    }
    anchors.add(utcDateAnchor(resolved));
  }
  return { anchors, unresolvedRelative };
};

const compatibleDateAnchors = (left: string, right: string) => {
  if (!left.startsWith("absolute:") || !right.startsWith("absolute:")) return left === right;
  const [, leftYear, leftMonthDay] = left.split(":");
  const [, rightYear, rightMonthDay] = right.split(":");
  return leftMonthDay === rightMonthDay && (leftYear === "*" || rightYear === "*" || leftYear === rightYear);
};

const compatibleTaskDates = (left: ClusterableEvidence, right: ClusterableEvidence) => {
  const leftDates = taskDateAnchors(left);
  const rightDates = taskDateAnchors(right);
  if (leftDates.unresolvedRelative || rightDates.unresolvedRelative) return false;
  if (!leftDates.anchors.size || !rightDates.anchors.size) return true;
  return [...leftDates.anchors].some((leftDate) =>
    [...rightDates.anchors].some((rightDate) => compatibleDateAnchors(leftDate, rightDate)));
};

const TASK_ACTION_SIGNAL = /\b(?:approve|call|commit(?:ted)?|complete|confirm|deliver|finish|fix|investigate|launch|need(?:s)? to|prepare|promis(?:e[sd]?|ed)|raise|report|resolve|review|send|ship|should|update|will|write)\b/i;

const taskActorTokens = (evidence: ClusterableEvidence) => {
  const text = clean(evidence.taskSpan ?? evidence.excerpt, 360);
  const actionAt = text.search(TASK_ACTION_SIGNAL);
  if (actionAt <= 0) return new Set<string>();
  const prefix = text.slice(0, actionAt).trim().replace(/[,:-]+$/g, "").trim();
  if (/\b(?:and|&)\b|,/.test(prefix)) return new Set<string>();
  const knownRole = /^(?:i|we|you|engineering|the team|support|security|operations)$/i.test(prefix);
  const properName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(prefix);
  if (!knownRole && !properName) {
    return new Set<string>();
  }
  return new Set(prefix.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length >= 3) ?? []);
};

const taskProductTokens = (evidence: ClusterableEvidence) => new Set(
  (clean(evidence.taskSpan ?? evidence.excerpt, 360).match(/\b[A-Z][a-z]+[A-Z][A-Za-z0-9]*\b/g) ?? [])
    .map((token) => token.toLowerCase()),
);

const GENERIC_NAMED_SCOPES = new Set([
  "action", "access", "billing", "customer", "client", "document", "email", "engineering",
  "enterprise", "followup", "github", "gmail", "important", "incident", "issue", "linear",
  "mortem", "operations", "please", "post", "request", "renewal", "security", "slack",
  "status", "support", "task", "team", "the", "this", "today", "tomorrow", "update",
  "there",
  ...MONTH_NUMBER.keys(),
  ...WEEKDAY_NUMBER.keys(),
]);

const taskNamedScopes = (evidence: ClusterableEvidence) => {
  const actors = taskActorTokens(evidence);
  const products = taskProductTokens(evidence);
  return new Set(
    (`${evidence.title} ${evidence.taskSpan ?? evidence.excerpt}`.match(/\b[A-Z][A-Za-z0-9]{2,}\b/g) ?? [])
      .filter((token) => !/^[A-Z0-9]+$/.test(token))
      .map((token) => token.toLowerCase())
      .filter((token) => !GENERIC_NAMED_SCOPES.has(token) && !actors.has(token) && !products.has(token)),
  );
};

const explicitTaskDateYears = (evidence: ClusterableEvidence) => {
  const text = clean(evidence.taskSpan ?? evidence.excerpt, 360).toLowerCase();
  const years = new Set<string>();
  for (const match of text.matchAll(/(?<!\d)(\d{4})-\d{2}-\d{2}(?!\d)/g)) years.add(match[1]!);
  const dayFirst = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_PATTERN})\\.?(?:,?\\s+(\\d{4}))\\b`, "g");
  for (const match of text.matchAll(dayFirst)) years.add(match[1]!);
  const monthFirst = new RegExp(`\\b(?:${MONTH_PATTERN})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))\\b`, "g");
  for (const match of text.matchAll(monthFirst)) years.add(match[1]!);
  return years;
};

const controlledTaskWordingDifferences = (
  left: ClusterableEvidence,
  right: ClusterableEvidence,
  leftTokens: ReadonlySet<string>,
  rightTokens: ReadonlySet<string>,
) => {
  const leftOnly = [...leftTokens].filter((token) => !rightTokens.has(token));
  const rightOnly = [...rightTokens].filter((token) => !leftTokens.has(token));
  const allowed = (token: string, evidence: ClusterableEvidence) =>
    explicitTaskDateYears(evidence).has(token) || taskActorTokens(evidence).has(token) || taskProductTokens(evidence).has(token);
  if (leftOnly.some((token) => !allowed(token, left)) || rightOnly.some((token) => !allowed(token, right))) return false;
  const leftDateYears = explicitTaskDateYears(left);
  const rightDateYears = explicitTaskDateYears(right);
  const leftSemanticExtras = leftOnly.filter((token) => !leftDateYears.has(token));
  const rightSemanticExtras = rightOnly.filter((token) => !rightDateYears.has(token));
  return !leftSemanticExtras.length || !rightSemanticExtras.length;
};

/** High-overlap local wording can identify the same task without an explicit work ID. */
const sameTaskWording = (left: ClusterableEvidence, right: ClusterableEvidence) => {
  if (!compatibleTaskDates(left, right)) return false;
  const leftScopes = taskNamedScopes(left);
  const rightScopes = taskNamedScopes(right);
  if (leftScopes.size !== rightScopes.size || [...leftScopes].some((scope) => !rightScopes.has(scope))) return false;
  const leftTokens = taskWordingTokens(left);
  const rightTokens = taskWordingTokens(right);
  if (!controlledTaskWordingDifferences(left, right, leftTokens, rightTokens)) return false;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  if (shared < 5) return false;
  const smallerCoverage = shared / Math.min(leftTokens.size, rightTokens.size);
  const jaccard = shared / new Set([...leftTokens, ...rightTokens]).size;
  return smallerCoverage >= 0.8 && jaccard >= 0.65;
};

/**
 * Conflict-aware clustering follows identity evidence, not product-name vibes:
 * records with overlapping exact IDs form components; an ID-less entity record may
 * join only when exactly one exact-ID component matches it. Two disjoint exact-ID
 * components are never collapsed merely because they mention the same product.
 */
export function clusterTaskEvidence<T extends ClusterableEvidence>(evidences: T[]): T[][] {
  const records = evidences.map((evidence) => ({
    evidence,
    ids: exactTaskIds(evidence),
    entities: distinctiveEntities(evidence),
  }));
  const parent = records.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]!));
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < records.length; left += 1) {
    if (!records[left]!.ids.size) continue;
    for (let right = left + 1; right < records.length; right += 1) {
      if (records[right]!.ids.size && overlaps(records[left]!.ids, records[right]!.ids)) union(left, right);
    }
  }

  const exactComponents = () => {
    const components = new Map<number, { member: number; members: number[]; entities: Set<string> }>();
    records.forEach((record, index) => {
      if (!record.ids.size) return;
      const root = find(index);
      const component = components.get(root) ?? { member: index, members: [], entities: new Set<string>() };
      component.members.push(index);
      record.entities.forEach((entity) => component.entities.add(entity));
      components.set(root, component);
    });
    return [...components.values()];
  };

  records.forEach((record, index) => {
    if (record.ids.size) return;
    const components = exactComponents();
    const wordingMatches = components.filter((component) =>
      component.members.some((member) =>
        record.evidence.provider !== records[member]!.evidence.provider &&
        sameTaskWording(record.evidence, records[member]!.evidence),
      ),
    );
    if (wordingMatches.length === 1) {
      union(index, wordingMatches[0]!.member);
      return;
    }
    if (wordingMatches.length > 1) return;
    const entityMatches = components.filter((component) =>
      component.members.some((member) =>
        compatibleTaskDates(record.evidence, records[member]!.evidence) &&
        overlaps(record.entities, records[member]!.entities),
      ),
    );
    if (entityMatches.length === 1) union(index, entityMatches[0]!.member);
  });

  return [...records.reduce((groups, record, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(record.evidence);
    groups.set(root, group);
    return groups;
  }, new Map<number, T[]>()).values()];
}

type QueueClusterEvidence = ClusterableEvidence & {
  taskSpan: string;
  timestamp?: string | null;
};

const localTaskIds = (evidence: QueueClusterEvidence) => new Set(
  `${evidence.title} ${evidence.taskSpan}`.match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g) ?? [],
);

/** Documents can corroborate an existing workplace task, but never originate one. */
export function canOriginateQueueTask<T extends Pick<QueueClusterEvidence, "provider">>(evidence: T): boolean {
  return evidence.provider !== "document";
}

/**
 * Attach a document only when its bounded local span maps to exactly one workplace
 * component. A handbook mentioning ENG-456 and INC-2031 cannot bridge those tasks.
 */
export function attachUnambiguousDocumentEvidence<T extends QueueClusterEvidence>(
  workplaceClusters: T[][],
  documents: T[],
): T[][] {
  const result = workplaceClusters.map((cluster) => [...cluster]);
  const workplaceIds = workplaceClusters.map((cluster) =>
    new Set(cluster.flatMap((item) => [...localTaskIds(item)])),
  );
  for (const document of documents) {
    const documentIds = localTaskIds(document);
    if (!documentIds.size) continue;
    const matches = workplaceIds.flatMap((clusterIds, index) =>
      overlaps(documentIds, clusterIds) ? [index] : [],
    );
    if (matches.length === 1) result[matches[0]]!.push(document);
  }
  return result;
}

/** Prefer the original workplace record over longer or newer document prose. */
export function selectPrimaryQueueEvidence<T extends QueueClusterEvidence>(evidences: T[]): T {
  const selected = [...evidences].sort((left, right) =>
    Number(right.provider !== "document") - Number(left.provider !== "document") ||
    Number(Boolean(right.timestamp)) - Number(Boolean(left.timestamp)) ||
    right.taskSpan.length - left.taskSpan.length,
  )[0];
  if (!selected) throw new Error("Cannot select primary evidence from an empty cluster.");
  return selected;
}

/** Supporting evidence is every cluster member except the selected primary, by ID. */
export function queueSupportingEvidence<T extends { id: string }>(evidences: T[], primary: T): T[] {
  return evidences.filter((evidence) => evidence.id !== primary.id);
}

function clusterContradictions(evidences: TaskEvidence[]) {
  const result: Array<Record<string, unknown>> = [];
  const completed = evidences.find((item) => /\b(merged|shipped|resolved|closed|completed)\b/i.test(`${item.title} ${item.taskSpan}`));
  const open = evidences.find((item) => /\b(still\s+(?:showing\s+as\s+)?open|remains?\s+open|ticket\s+still\s+open)\b/i.test(`${item.title} ${item.taskSpan}`));
  if (completed && open) {
    result.push({
      summary: `${completed.provider} reports completion while ${open.provider} still reports open work.`,
      evidenceIds: [completed.id, open.id], providers: [completed.provider, open.provider],
    });
  }
  const dated = evidences.flatMap((item) =>
    /\b(deadline|due|ship|before|moved|date)\b/i.test(`${item.title} ${item.taskSpan}`)
      ? (item.taskSpan.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)\b/gi) ?? [])
        .map((date) => ({ item, date }))
      : [],
  );
  const distinct = dated.filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.date.toLowerCase() === entry.date.toLowerCase()) === index,
  );
  if (distinct.length > 1) {
    result.push({
      summary: `Cited records contain different dates: ${distinct.slice(0, 3).map(({ item, date }) => `${item.provider} says ${date}`).join("; ")}.`,
      evidenceIds: distinct.slice(0, 3).map(({ item }) => item.id),
      providers: [...new Set(distinct.slice(0, 3).map(({ item }) => item.provider))],
    });
  }
  return result;
}

function rankingInput(evidence: TaskEvidence, id: string, title: string): RankingInput {
  const text = `${title} ${evidence.taskSpan}`;
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
      weakEvidence: evidence.taskSpan.length < 40 ? 9 : 0,
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
      `SELECT id, hydradb_connector_id, provider, database, collection, account_scope
       FROM connectors WHERE workspace_id = ? AND state = 'data_verified'
       ORDER BY provider ASC`,
    )
    .bind(workspaceId)
    .all<VerifiedConnector>();
  if (!connectors.results.length) {
    throw new Response("Verify at least one live connector before generating a queue.", { status: 409 });
  }
  const selectedResources = await db.prepare(
    `SELECT connector_id, external_resource_id FROM connector_resources
     WHERE workspace_id = ? AND selected = 1`,
  ).bind(workspaceId).all<{ connector_id: string; external_resource_id: string }>();
  const resourceIdsByConnector = selectedResources.results.reduce((map, row) => {
    const ids = map.get(row.connector_id) ?? new Set<string>();
    ids.add(row.external_resource_id);
    map.set(row.connector_id, ids);
    return map;
  }, new Map<string, Set<string>>());
  const ownedDocuments = await db.prepare(
    `SELECT id, hydradb_source_id, hydradb_database FROM documents
     WHERE workspace_id = ? AND stage = 'indexed' AND hydradb_source_id IS NOT NULL`,
  ).bind(workspaceId).all<{ id: string; hydradb_source_id: string; hydradb_database: string }>();
  const ownedDocumentByScope = new Map(ownedDocuments.results.map((document) => [
    `${document.hydradb_database}\u0000${document.hydradb_source_id}`,
    document,
  ]));

  const client = await hydraClientForWorkspace(workspaceId);
  const queueQueries = [
    {
      kind: "commitments",
      text: "Find current company work with explicit promised actions, owned follow-ups, changed deadlines, due actions, or tracked work still open. Return original workplace messages, emails, issues, and threads with concrete task identity. Exclude examples, homework, recruitment, marketing, newsletters, contract boilerplate, policies, and attachment prose.",
    },
    {
      kind: "risks",
      text: "Find current unresolved company customer escalations, active incidents or outages, security risks, and blockers. Return original workplace messages, emails, issues, and threads with concrete task identity. Exclude examples, homework, recruitment, marketing, newsletters, contract boilerplate, policies, and attachment prose.",
    },
  ] as const;
  const diagnostics: Array<Record<string, unknown>> = [];
  const scopes = [...connectors.results.reduce((map, connector) => {
    const key = `${connector.database}\u0000${connector.collection ?? ""}`;
    const current = map.get(key) ?? {
      database: connector.database,
      collection: connector.collection,
      connectors: [] as VerifiedConnector[],
    };
    current.connectors.push(connector);
    map.set(key, current);
    return map;
  }, new Map<string, { database: string; collection: string | null; connectors: VerifiedConnector[] }>()).values()];

  const scopeResults: Evidence[][] = [];
  // Bound expensive thinking-mode fanout to two concurrent calls per database scope.
  // Workspaces with several scopes are processed serially instead of bursting 2 x N.
  for (const scope of scopes) {
    const currentScopeResults = await Promise.all(queueQueries.map(async (query) => {
      const scopeEvidence: Evidence[] = [];
      const started = Date.now();
      const response = await client.query({
        database: scope.database,
        ...(scope.collection ? { collections: [scope.collection] } : {}),
        query: query.text,
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
        connectorIds: scope.connectors.map((connector) => connector.id),
        providers: scope.connectors.map((connector) => connector.provider),
        database: scope.database,
        collection: scope.collection,
        queryKind: query.kind,
        ok: response.ok,
        status: response.status,
        requestId: response.requestId,
        latencyMs: Date.now() - started,
        error: response.error,
      });
      if (!response.ok) return scopeEvidence;
      const extracted = extractQuerySources(response.data);
      extracted.sources.forEach((source) => {
        const sourceChunks = matchingChunks(source, extracted.chunks);
        const sourceProvider = providerFromSource(source);
        const sourceId = String(source.id ?? source.source_id ?? source.context_id ?? "");
        const ownedDocument = ownedDocumentByScope.get(`${scope.database}\u0000${sourceId}`);
        const connector = ownedDocument
          ? {
            ...scope.connectors[0]!,
            id: `document:${ownedDocument.id}`,
            hydradb_connector_id: `document:${ownedDocument.hydradb_source_id}`,
            provider: "document",
            account_scope: null,
          }
          : scope.connectors.find((item) => sourceBelongsToConnector(
            source,
            item.hydradb_connector_id,
            resourceIdsByConnector.get(item.id) ?? new Set<string>(),
        ));
        // Exact ledger membership owns uploads. File-shaped connector records still
        // follow connector lineage and are not silently discarded as pseudo-uploads.
        if (!connector || (!ownedDocument && sourceProvider !== null && connector.provider !== sourceProvider)) return;
        const chunks = sourceChunks.length ? sourceChunks : [{}];
        chunks.forEach((chunk) => {
          const evidence = evidenceFromHydra(connector, source, chunk);
          if (evidence.excerpt || evidence.title) scopeEvidence.push(evidence);
        });
      });
      return scopeEvidence;
    }));
    scopeResults.push(...currentScopeResults);
  }
  const retrieved = scopeResults.flat();

  const safeEvidence = retrieved
    .filter((item) => !item.unsafeInstruction)
    .map((item) => ({
      ...item,
      taskSpan: extractActionableTaskSpan(`${item.title}. ${item.excerpt}`),
    }))
    .filter((item): item is TaskEvidence => Boolean(item.taskSpan))
    .filter((item, index, all) => all.findIndex((other) =>
      queueEvidenceDedupKey(other) === queueEvidenceDedupKey(item),
    ) === index);
  const workplaceEvidence = safeEvidence.filter(canOriginateQueueTask);
  if (!workplaceEvidence.length) {
    await audit({
      workspaceId,
      actorId,
      operation: "queue.generate",
      outcome: "failure",
      metadata: {
        reason: "no_actionable_workplace_evidence",
        actionableSourceCount: safeEvidence.length,
        diagnostics,
      },
    });
    throw new Response(
      "Live retrieval completed, but no actionable commitment with safe workplace evidence was found.",
      { status: 422 },
    );
  }

  const clusters = attachUnambiguousDocumentEvidence(
    clusterTaskEvidence(workplaceEvidence),
    safeEvidence.filter((item) => !canOriginateQueueTask(item)),
  );

  const rankingRunId = createId("ranking");
  const ranked = clusters.map((evidences) => {
    const evidence = selectPrimaryQueueEvidence(evidences);
    const supportingEvidences = queueSupportingEvidence(evidences, evidence);
    const taskId = createId("task");
    const title = taskTitle(evidence);
    const input = rankingInput(evidence, taskId, title);
    const providers = [...new Set(evidences.map((item) => item.provider))];
    input.authorityReliability = Math.min(6, 4 + providers.length);
    input.evidence = evidences.map((item) => ({
      sourceId: item.id, provider: item.provider, externalId: item.externalId,
      title: item.title, excerpt: item.excerpt, timestamp: item.timestamp,
      ingestionTimestamp: item.ingestionTimestamp, url: item.url,
      authority: item.authority, metadata: item.metadata,
    }));
    return { evidence, evidences, supportingEvidences, providers, taskId, title, input, result: rank(input) };
  }).filter((item) => canEmitQueueScore(item.result.finalScore))
    .sort((a, b) => b.result.finalScore - a.result.finalScore ||
    `${a.evidence.provider}:${a.evidence.externalId}`.localeCompare(`${b.evidence.provider}:${b.evidence.externalId}`))
    .slice(0, 18);

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
    const disagreements = clusterContradictions(item.evidences);
    const packet = executionPacketSchema.parse({
      packet_id: packetId,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      policy_version: item.result.policyVersion,
      task: {
        title: item.title,
        objective: item.evidence.taskSpan,
        owner,
        project: firstText(item.evidence.metadata, ["project_name", "project"]),
        deadline,
        priority_score: item.result.finalScore,
        confidence: item.result.confidence,
      },
      why_now: [
        ...item.result.explanation,
        ...(item.providers.length > 1 ? [`Corroborated across ${item.providers.join(", ")}.`] : []),
        ...(disagreements.length ? [`${disagreements.length} disagreement${disagreements.length === 1 ? "" : "s"} preserved for review.`] : []),
      ],
      constraints: item.input.status === "blocked" ? ["The source indicates an unresolved dependency."] : [],
      dependencies: item.input.status === "blocked" ? ["Resolve the evidenced blocker before direct execution."] : [],
      acceptance_criteria: [
        "Confirm completion against every cited source receipt.",
        ...(disagreements.length ? ["Resolve or explicitly accept each preserved disagreement before execution."] : []),
      ],
      evidence: item.input.evidence,
      contradictions: disagreements,
      missing_information: [!owner ? "Owner is not explicit in source metadata." : null, !deadline ? "Deadline is not explicit in source metadata." : null].filter(Boolean),
      score_breakdown: item.result.componentScores,
      penalties: item.result.penalties,
      active_formula: ACTIVE_FORMULA,
      recommended_safe_action: item.input.status === "blocked"
        ? "Clarify the evidenced dependency before proposing any external write."
        : "Review the cited receipt, then send the exact provider write through QueueProof approval.",
      provider_coverage: item.providers,
      deduplicated_tasks: item.supportingEvidences.map((evidence) => `${evidence.provider}:${evidence.externalId}`),
      status: item.input.status,
      recommended_agent: "human",
      permissions: { read: item.providers, write: [], approval_required: true },
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

    for (const corroborating of item.supportingEvidences) {
      statements.push(
        db.prepare(
          `INSERT INTO source_references
           (id, workspace_id, provider, connector_id, external_id, title, excerpt, source_url,
            source_timestamp, ingestion_timestamp, authority, content_hash, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          corroborating.id, workspaceId, corroborating.provider, corroborating.connectorId,
          corroborating.externalId, corroborating.title, corroborating.excerpt, corroborating.url,
          corroborating.timestamp, corroborating.ingestionTimestamp, corroborating.authority,
          await sha256(`${corroborating.provider}:${corroborating.externalId}:${corroborating.excerpt}`),
          JSON.stringify(corroborating.metadata),
        ),
        db.prepare(
          `INSERT INTO task_evidence
           (id, workspace_id, task_id, source_id, relation, claim)
           VALUES (?, ?, ?, ?, 'supports', ?)`,
        ).bind(createId("evidence"), workspaceId, item.taskId, corroborating.id, corroborating.taskSpan),
      );
    }

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
      ).bind(createId("evidence"), workspaceId, item.taskId, item.evidence.id, item.evidence.taskSpan),
      db.prepare(
        `INSERT INTO ranking_items
         (id, workspace_id, ranking_run_id, task_id, rank, component_scores_json,
          penalties_json, final_score, confidence, explanation_json, sensitivity_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        createId("ranked"), workspaceId, rankingRunId, item.taskId, index + 1,
        JSON.stringify(item.result.componentScores), JSON.stringify(item.result.penalties),
        item.result.finalScore, Math.round(item.result.confidence * 100),
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
        metadata: {
          taskCount: ranked.length,
          sourceCount: safeEvidence.length,
          originatingSourceCount: workplaceEvidence.length,
          corroboratingDocumentCount: safeEvidence.length - workplaceEvidence.length,
          diagnostics,
        },
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
       WHERE ri.workspace_id = ? AND ri.ranking_run_id = ? AND ri.final_score > 0
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
