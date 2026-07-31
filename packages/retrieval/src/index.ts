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
  if (exactId.test(query)) {
    return {
      category: "exact_identifier",
      mode: "fast",
      queryBy: "text",
      graphContext: false,
      queryApps: true,
      recencyBias: 0,
      exactParallel: true,
      reason: "Exact identifier detected; run text and hybrid retrieval in parallel.",
    };
  }
  const temporal = /\b(since|before|after|changed|yesterday|today|latest|timeline)\b/.test(normalized);
  const conflict = /\b(conflict(?:ing|ed|s)?|contradict(?:ory|ing|ed|s)?|disagree(?:ment|ments|d|s)?|inconsistent|inconsistency)\b/.test(normalized);
  const counterfactual = /\b(what if|would move|if .* resolved|why .* above)\b/.test(normalized);
  const crossSource = /\b(across|slack|gmail|linear|github|email)\b/.test(normalized);
  const category: QueryCategory = counterfactual
    ? "counterfactual"
    : conflict
      ? "conflict_analysis"
      : temporal
        ? "temporal_reasoning"
        : crossSource
          ? "cross_source_fact"
          : "single_source_fact";
  const thinking = conflict || temporal || counterfactual || crossSource;
  return {
    category,
    mode: thinking ? "thinking" : "fast",
    queryBy: "hybrid",
    graphContext: thinking,
    queryApps: true,
    recencyBias: temporal ? 0.3 : 0.1,
    exactParallel: false,
    reason: thinking
      ? "The question needs multi-source, temporal, conflict, or counterfactual reasoning."
      : "A single-pass grounded lookup is sufficient.",
  };
}
