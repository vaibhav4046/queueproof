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

const exactId = /\b(?:[A-Z][A-Z0-9]+-\d+|[0-9a-f]{8}-[0-9a-f-]{27,})\b/i;

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
    /\b(despite|still .* open|already .* (?:shipped|merged|resolved)|appears? resolved elsewhere)\b/.test(normalized);
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
    temporal || conflictSignal || counterfactualSignal || crossSourceSignal || multiHopSignal ||
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
