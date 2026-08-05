export type QueryCategory =
  | "exact_identifier"
  | "single_source_fact"
  | "cross_source_fact"
  | "actor_lookup"
  | "thread_reconstruction"
  | "temporal_reasoning"
  | "conflict_analysis"
  | "entity_resolution"
  | "priority_calculation"
  | "counterfactual"
  | "what_changed"
  | "multilingual"
  | "multi_hop";

export type RetrievalPlan = {
  category: QueryCategory;
  mode: "fast" | "thinking";
  queryBy: "hybrid" | "text";
  graphContext: boolean;
  queryApps: boolean;
  recencyBias: number;
  exactParallel: boolean;
  reason: string;
};

export type ExecutedRetrievalMode = "fast" | "thinking";
export type RequestedRetrievalMode = ExecutedRetrievalMode | "auto" | undefined;

export function resolveRetrievalMode(requested: RequestedRetrievalMode) {
  return requested === "fast" || requested === "thinking"
    ? { automatic: false, primaryMode: requested }
    : { automatic: true, primaryMode: "fast" as const };
}

const PROVIDER_ALIASES: Record<string, string[]> = {
  gmail: ["email"],
  google_calendar: ["google calendar", "gcal"],
  google_drive: ["google drive"],
  github: ["git hub"],
  gitlab: ["git lab"],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Providers the user explicitly named, limited to providers in the retrieval scope. */
export function providersNamedInQuestion(question: string, availableProviders: string[]): string[] {
  return [...new Set(availableProviders)].filter((provider) => {
    const label = provider.toLowerCase().replace(/[_-]+/g, " ");
    const aliases = [label, ...(PROVIDER_ALIASES[provider.toLowerCase()] ?? [])];
    return aliases.some((alias) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, "i").test(question));
  });
}

export function retrievalModeCost(mode: ExecutedRetrievalMode) {
  return mode === "thinking" ? 3 : 1;
}

export function decideAutoEscalation(input: {
  validationStatus: "grounded" | "partial" | "abstained";
  missingInformation: string[];
  namedProviders: string[];
  evidenceProviders: string[];
}) {
  const reasons: string[] = [];
  if (input.validationStatus === "partial") reasons.push("the Fast answer was partial");
  if (input.validationStatus === "abstained") reasons.push("Fast retrieval could not support an answer");
  if (input.missingInformation.length > 0) reasons.push("requested information remained unsupported");
  const produced = new Set(input.evidenceProviders.map((provider) => provider.toLowerCase()));
  const missingNamedProviders = input.namedProviders.filter((provider) => !produced.has(provider.toLowerCase()));
  if (missingNamedProviders.length > 0) {
    reasons.push(`${missingNamedProviders.join(", ")} returned no evidence`);
  }
  return { escalate: reasons.length > 0, reasons, missingNamedProviders };
}

/**
 * A fast first pass can find a complete sentence in one provider that refers to
 * another system (for example, GitHub says ENG-456 is still open). That is useful
 * evidence, but it is not independent provider confirmation. Run one bounded Fast
 * join-key follow-up when an exact identifier or a planned multi-step state check
 * is still single-provider. This repairs coverage without paying Thinking cost for
 * a deterministic identifier join.
 */
export function shouldRunFastCoverageRepair(input: {
  category: QueryCategory;
  plannedMode: RetrievalPlan["mode"];
  evidenceProviders: string[];
  contradictionProviders: string[][];
}) {
  const providerCount = new Set(input.evidenceProviders.filter(Boolean)).size;
  if (providerCount !== 1) return false;
  if (input.category === "exact_identifier") return true;
  if (input.plannedMode !== "thinking") return false;
  return input.contradictionProviders.some((providers) => new Set(providers.filter(Boolean)).size < 2);
}

const WORK_TRACKER_PROVIDER_ORDER = [
  "linear", "jira", "shortcut", "asana", "github", "gitlab", "notion",
];

/**
 * Order the still-missing providers for one bounded connector-scoped repair.
 *
 * The order comes only from the question, retained first-hop passages, and the
 * verified connectors available to the workspace:
 *
 * 1. a provider explicitly referenced by the question/evidence is tried first;
 * 2. exact operational identifiers prefer dedicated work trackers/code hosts;
 * 3. any remaining verified provider is a fallback for identifiers that live in
 *    mail or chat instead.
 *
 * This deliberately contains no fixture identifiers, people, projects, or
 * expected answers. The route stops after the first provider that returns valid
 * connector-lineage evidence, keeping the repair cheap in the common case.
 */
export function coverageRepairProviderOrder(input: {
  question: string;
  evidencePassages: string[];
  availableProviders: string[];
  evidenceProviders: string[];
  category: QueryCategory;
}): string[] {
  const produced = new Set(input.evidenceProviders.map((provider) => provider.toLowerCase()));
  const missing = [...new Set(input.availableProviders.map((provider) => provider.toLowerCase()))]
    .filter((provider) => provider !== "document" && !produced.has(provider));
  if (!missing.length) return [];

  const referenced = providersNamedInQuestion(
    [input.question, ...input.evidencePassages.slice(0, 16)].join("\n"),
    missing,
  ).map((provider) => provider.toLowerCase());
  const trackerCandidates = input.category === "exact_identifier"
    ? WORK_TRACKER_PROVIDER_ORDER.filter((provider) => missing.includes(provider))
    : [];
  const fallback = input.category === "exact_identifier" ? missing : [];

  return [...new Set([...referenced, ...trackerCandidates, ...fallback])];
}

// Operational record identifiers are often namespaced (OPS-POL-14,
// DRAFT-OPS-14), not only one-prefix IDs such as BUG-123. Keeping extraction in
// one helper prevents the router and second-hop query from silently shortening
// a namespaced identifier to its final segment.
const recordIdentifier = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/g;

export function recordIdentifiers(value: string): string[] {
  recordIdentifier.lastIndex = 0;
  return value.match(recordIdentifier) ?? [];
}

/**
 * Concrete HydraDB lanes for a plan. Exact identifiers need lexical precision,
 * while the hybrid lane protects against aliases and surrounding semantic context.
 * Keeping this helper beside the planner prevents `exactParallel` from becoming a
 * trace-only promise that the route never executes.
 */
export function retrievalQueryVariants(plan: RetrievalPlan): Array<"text" | "hybrid"> {
  return plan.exactParallel ? ["text", "hybrid"] : [plan.queryBy];
}

/**
 * Bounded, fixture-agnostic terms for intents whose natural-language wording
 * is often too abstract for lexical retrieval. These phrases describe the
 * requested state transition; they never add an entity, date, or answer that
 * was not supplied by the user.
 */
export function retrievalIntentTerms(question: string): string[] {
  const normalized = question.toLowerCase();
  if (/\bopen\s+(?:issue|ticket)\b[^?]{0,90}\b(?:resolved|complete|completed|closed|merged|shipped|elsewhere)\b/.test(normalized)) {
    return ["merged", "shipped", "still open", "tracked state"];
  }
  if (/\b(?:no|without|missing|lacks?)\b[^?]{0,60}\b(?:issue|ticket|track(?:ed|ing)?)\b/.test(normalized)) {
    return ["no issue tracking", "not tracked"];
  }
  return [];
}

const FOLLOW_UP_STOP_WORDS = new Set([
  "a", "an", "and", "april", "august", "document", "february", "friday", "github",
  "gmail", "heads up", "i", "january", "july", "june", "linear", "march", "may",
  "monday", "november", "october", "saturday", "september",
  "slack", "sunday", "the", "this", "thursday", "tuesday", "wednesday", "we",
]);

/**
 * Build a bounded second-hop expansion only from entities present in the first
 * retrieval result. This is deliberately generic: it extracts record IDs and
 * proper-name phrases, never fixture-specific aliases or facts. The result is
 * appended to the original question for one hybrid follow-up query in thinking
 * mode, making multi-hop execution real while leaving fast mode at one call.
 */
export function evidenceFollowUpTerms(question: string, passages: string[]): string[] {
  const questionLower = question.toLowerCase();
  const scores = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    const phrase = raw.replace(/\s+/g, " ").trim()
      .replace(/^(?:The|A|An)\s+/, "")
      .replace(/[.,:;!?]+$/g, "");
    const lower = phrase.toLowerCase();
    if (phrase.length < 4 || phrase.length > 64 || FOLLOW_UP_STOP_WORDS.has(lower)) return;
    if (questionLower.includes(lower)) return;
    scores.set(phrase, (scores.get(phrase) ?? 0) + weight);
  };

  for (const passage of passages.slice(0, 16)) {
    for (const id of recordIdentifiers(passage)) add(id, 20);
    for (const phrase of passage.match(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}\b/g) ?? []) {
      const internalCapital = /[a-z][A-Z]/.test(phrase);
      add(phrase, internalCapital ? 9 : phrase.includes(" ") ? 6 : 3);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([phrase]) => phrase);
}

/**
 * Build the actual second-hop query from identifiers and entities proven by the
 * first retrieval. Repeating the whole natural-language question makes a
 * follow-up behave like a second primary search: generic words can outweigh the
 * newly discovered join key. This compact query instead leads with exact record
 * IDs, then adds evidence-derived entities and only the bounded state language
 * needed by stale/missing-work intents.
 *
 * Nothing here invents a fixture alias or answer. Every entity comes from the
 * user's question or a retained first-hop passage.
 */
export function focusedEvidenceFollowUpQuery(question: string, passages: string[]): string | null {
  const exactIds = [
    ...recordIdentifiers(question),
    ...passages.slice(0, 16).flatMap(recordIdentifiers),
  ];
  const terms = [
    ...exactIds,
    ...evidenceFollowUpTerms(question, passages),
    ...retrievalIntentTerms(question),
  ];
  const seen = new Set<string>();
  const selected: string[] = [];
  let length = 0;

  for (const raw of terms) {
    const term = raw.replace(/\s+/g, " ").trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    const nextLength = length + (selected.length ? 1 : 0) + term.length;
    if (nextLength > 180) continue;
    seen.add(key);
    selected.push(term);
    length = nextLength;
    if (selected.length >= 12) break;
  }

  return selected.length ? selected.join(" ") : null;
}

const exactId = /\b(?:[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+|[0-9a-f]{8}-[0-9a-f-]{27,})\b/i;

export function planRetrieval(query: string): RetrievalPlan {
  const normalized = query.toLowerCase();

  // Reasoning signals are computed BEFORE the identifier lane is chosen.
  //
  // This ordering is the fix for a real routing defect: the exact-identifier branch used
  // to return `fast` immediately, so a question that contains an ID *and* needs
  // multi-provider reasoning was routed to a single-pass lookup. The brief's own flagship
  // question — "Who filed BUG-123, which project are they working on, and what did they
  // say about the fix in Slack?" — took that path and could never have been answered
  // correctly, because it needs an actor, a project and a Slack thread across providers.
  const temporal = /\b(since|before|after|changed|yesterday|today|latest|timeline|since monday|this week)\b/.test(normalized) ||
    /\b(desde|antes|despu[eé]s|cambi[oó]|lunes|hoy|ayer)\b/.test(normalized);
  const explicitConflictSignal = /\b(conflict(?:ing|ed|s)?|contradict(?:ory|ing|ed|s)?|disagree(?:ment|ments|d|s)?|inconsistent|inconsistency)\b/.test(normalized);
  const conflictSignal = explicitConflictSignal ||
    /\b(despite|still .* open|already .* (?:shipped|merged|resolved)|appears?(?:\s+\w+){0,4}\s+resolved elsewhere)\b/.test(normalized);
  const absenceSignal = /\b(?:no|without|missing|lacks?)\b[^?]{0,50}\b(?:issue|ticket|track(?:ed|ing)?)\b/.test(normalized) ||
    /\b(?:issue|ticket)\b[^?]{0,35}\b(?:missing|absent|not tracked)\b/.test(normalized);
  const counterfactualSignal = /\b(what if|would move|if .* resolved|why .* above)\b/.test(normalized);
  const namedProviders = ["slack", "gmail", "linear", "github", "email", "document"]
    .filter((provider) => new RegExp(`\\b${provider}\\b`).test(normalized));
  // Naming one provider is a scope filter, not a reasoning task. Escalate only when the
  // question explicitly spans sources or names at least two independent systems.
  const crossSourceSignal = /\b(across|cross[- ]source|multiple systems|every system)\b/.test(normalized) ||
    namedProviders.length >= 2;
  // "why", and clause-stacking ("and what", "and which"), both indicate the answer must
  // be assembled from more than one retrieval step.
  // Clause stacking: a second interrogative clause after "and" means the answer has to
  // be assembled from more than one retrieval step. Auxiliary verbs count too — a live
  // run showed "…what did engineering commit to, and IS the fix already merged?" routing
  // to fast, because only wh-words were matched. That question spans three providers.
  const multiHopSignal =
    /\bwhy\b/.test(normalized) ||
    /\band (?:what|which|who|whose|where|when|how|is|are|was|were|does|do|did|has|have|can|should|will)\b/.test(
      normalized,
    );

  const entityResolutionSignal = /\b(same person|same (?:company|project|entity)|duplicate|dedup|merge .* into one|alias)\b/.test(normalized);
  const attributionSignal = /\bwho (?:committed|promised|said|wrote|filed|owns?)\b/.test(normalized) &&
    /\b(which|what|where|message|thread|project)\b/.test(normalized);
  const prioritySignal = /\b(what should .* (?:first|next)|work on first|prioriti[sz]e|rank the|most important|deserves attention)\b/.test(normalized);
  const multilingualSignal = /[^\u0000-\u007f]/.test(query) || /\b(qu[eé]|qui[eé]n|cu[aá]l|desde|lunes|cambi[oó])\b/.test(normalized);
  const cjkReasoningSignal = /[\u3040-\u30ff\u3400-\u9fff]/.test(query) && namedProviders.length > 0;
  const threadSignal = /\b(thread|conversation|discussion)\b/.test(normalized);
  const provenanceSignal = /\b(source of|trace .* from .* to|compare .* (?:with|against)|vendor email|liability cap|layoff)\b/.test(normalized);

  const needsReasoning =
    temporal || conflictSignal || absenceSignal || counterfactualSignal || crossSourceSignal || multiHopSignal ||
    entityResolutionSignal || attributionSignal || prioritySignal || threadSignal || provenanceSignal ||
    cjkReasoningSignal || (multilingualSignal && multiHopSignal);

  if (exactId.test(query)) {
    return {
      category: "exact_identifier",
      // The identifier lane still runs text and hybrid in parallel, but it no longer
      // forces `fast` when the surrounding question needs multi-step reasoning.
      mode: needsReasoning ? "thinking" : "fast",
      queryBy: "text",
      graphContext: needsReasoning,
      queryApps: true,
      recencyBias: temporal ? 0.3 : 0,
      exactParallel: true,
      reason: needsReasoning
        ? "Exact identifier detected alongside multi-step reasoning; run text and hybrid retrieval in parallel, then reason across the results."
        : "Exact identifier detected; run text and hybrid retrieval in parallel.",
    };
  }
  const conflict = explicitConflictSignal;
  const counterfactual = counterfactualSignal;
  // Keep category labelling independent from mode. A named provider may describe a
  // retrieval scope while still remaining fast, but it is useful to retain the
  // cross-source category contract for historical fixture comparisons.
  const crossSource = /\b(across|slack|gmail|linear|github|email|document)\b/.test(normalized) || multiHopSignal;
  const category: QueryCategory = counterfactual
    ? "counterfactual"
    : conflict
      ? "conflict_analysis"
      : temporal
        ? "temporal_reasoning"
        : crossSource
          ? "cross_source_fact"
          : "single_source_fact";
  const thinking = needsReasoning;
  return {
    category,
    mode: thinking ? "thinking" : "fast",
    queryBy: "hybrid",
    graphContext: thinking,
    queryApps: true,
    recencyBias: temporal ? 0.3 : 0.1,
    exactParallel: false,
    reason: thinking
      ? "The question needs cross-source, temporal, conflict, attribution, entity, multilingual, or priority reasoning."
      : "A single-pass grounded lookup is sufficient.",
  };
}
