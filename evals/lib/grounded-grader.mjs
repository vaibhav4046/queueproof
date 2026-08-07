/**
 * Pure grading helpers for grounded QueueProof answers.
 *
 * This module performs no I/O. A benchmark case passes only when every explicit
 * required fact is present, every required provider has a supporting cited claim,
 * all claim citation IDs resolve, every claim is textually supported and relevant,
 * and any required contradiction is backed by topically aligned, disagreeing receipts.
 */

export const GROUNDED_GRADER_VERSION = "grounded-grader-v3";

/** @template T @param {T[] | unknown} value @returns {T[]} */
const asArray = (value) => Array.isArray(value) ? value : [];

/** @param {unknown} value */
export function normaliseGradeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function alternativesMatch(corpus, alternatives) {
  return asArray(alternatives).find((candidate) => {
    const normalised = normaliseGradeText(candidate);
    return normalised.length > 0 && corpus.includes(normalised);
  }) ?? null;
}

/**
 * A required fact supports either:
 * - `anyOf`: one complete phrase must occur; or
 * - `allOf`: every inner alternative group must have a match.
 * @param {unknown} answer
 * @param {{ id?: unknown, label?: unknown, anyOf?: unknown[], allOf?: unknown[][] }} fact
 */
export function matchRequiredFact(answer, fact) {
  const corpus = normaliseGradeText(answer);
  const anyMatch = alternativesMatch(corpus, fact?.anyOf);
  const allGroups = asArray(fact?.allOf);
  const allMatches = allGroups.map((group) => alternativesMatch(corpus, group));
  const hasAnyConstraint = asArray(fact?.anyOf).length > 0;
  const hasAllConstraint = allGroups.length > 0;
  const matched = (!hasAnyConstraint || Boolean(anyMatch)) &&
    (!hasAllConstraint || allMatches.every(Boolean)) &&
    (hasAnyConstraint || hasAllConstraint);
  return {
    id: String(fact?.id ?? "unnamed-fact"),
    label: String(fact?.label ?? fact?.id ?? "Unnamed required fact"),
    matched,
    matchedAlternatives: [anyMatch, ...allMatches].filter(Boolean),
  };
}

function claimCitationIds(claim) {
  return [...new Set(asArray(claim?.citation_ids ?? claim?.evidenceIds).map(String).filter(Boolean))];
}

function contradictionCitationIds(contradiction) {
  return [...new Set(asArray(contradiction?.evidenceIds ?? contradiction?.evidence_ids).map(String).filter(Boolean))];
}

const NON_TOPICAL_TOKENS = new Set([
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
  "open", "closed", "merged", "shipped", "released", "resolved",
  "latest", "newest", "recent", "still", "remains", "showing",
  "source", "sources", "says", "said", "tracked", "issue",
  "deadline", "promise", "promised", "commitment", "committed",
]);

const CONTRADICTION_STATE_TOKENS = new Set([
  "active", "approved", "blocked", "cancelled", "canceled", "closed",
  "complete", "completed", "disabled", "enabled", "failed", "fixed",
  "merged", "open", "pending", "rejected", "resolved", "shipped",
]);

const CONTRADICTION_STOP_TOKENS = new Set([
  "according", "cited", "claim", "claims", "contain", "contains",
  "date", "dates", "deadline", "different", "disagree", "disagrees",
  "evidence", "record", "records", "report", "reports", "said", "says",
  "source", "sources", "state", "states", "while", "with",
]);

function phraseIsTopical(phrase) {
  const normalised = normaliseGradeText(phrase);
  if (!normalised) return false;
  return normalised.split(" ").some((token) =>
    /\p{L}/u.test(token) && token.length >= 3 && !NON_TOPICAL_TOKENS.has(token));
}

function topicalFactAlternatives(requiredFacts) {
  return [...new Set(asArray(requiredFacts).flatMap((fact) => [
    ...asArray(fact?.anyOf),
    ...asArray(fact?.allOf).flatMap((group) => asArray(group)),
  ]).map(normaliseGradeText).filter(phraseIsTopical))];
}

function citationExcerptSentences(citation) {
  return String(citation?.excerpt ?? "")
    .split(/[.!?;\n]+/)
    .map(normaliseGradeText)
    .filter(Boolean);
}

function citationExcerptClauses(citation) {
  return String(citation?.excerpt ?? "")
    .split(/[.!?;,\n]+|\b(?:and|but|however|whereas|while)\b/i)
    .map(normaliseGradeText)
    .filter(Boolean);
}

function claimLocalContext(claim, citation) {
  const claimText = normaliseGradeText(claim?.text);
  if (!claimText) return "";
  const sentences = citationExcerptSentences(citation);
  const isWholeSentenceClaim = sentences.some((sentence) => sentence === claimText);
  const matchingClauses = citationExcerptClauses(citation)
    .filter((clause) => clause.includes(claimText));
  // A topical title can bind an exact excerpt sentence. A neighbouring clause
  // cannot lend its topic to a narrower, unrelated claim in the same sentence.
  const titleContext = isWholeSentenceClaim ? normaliseGradeText(citation?.title) : "";
  return [claimText, titleContext, ...matchingClauses].filter(Boolean).join(" ");
}

function claimCarriesRequiredFactSignal(claim, supportedCitations, requiredFacts) {
  const claimCorpus = normaliseGradeText(claim?.text);
  if (!claimCorpus) return false;
  const contextualCorpus = [
    claimCorpus,
    ...asArray(supportedCitations).map((citation) => claimLocalContext(claim, citation)),
  ].join(" ");
  const topicalAnchors = topicalFactAlternatives(requiredFacts);

  return asArray(requiredFacts).some((fact) => {
    const anyMatch = alternativesMatch(claimCorpus, fact?.anyOf);
    if (anyMatch) {
      // Dates and generic state words are not topical on their own. They must
      // appear in a claim/citation context that also names the case subject.
      if (phraseIsTopical(anyMatch) || topicalAnchors.length === 0) return true;
      return topicalAnchors.some((anchor) => contextualCorpus.includes(anchor));
    }

    const groups = asArray(fact?.allOf);
    if (groups.length === 0) return false;
    const matchedGroups = groups.filter((group) => alternativesMatch(claimCorpus, group)).length;
    // One generic entity token must not make an unrelated claim relevant to a
    // compound fact. Single-group facts still require their complete alternative.
    return matchedGroups >= Math.min(2, groups.length);
  });
}

function contradictionClauseSignals(clause, provider, topicalAnchors) {
  const corpus = normaliseGradeText(clause);
  const signals = new Set();
  const monthPattern = "january|february|march|april|may|june|july|august|september|october|november|december";
  for (const match of corpus.matchAll(new RegExp(`\\b\\d{1,2} (?:${monthPattern})\\b`, "g"))) {
    signals.add(match[0]);
  }
  for (const token of corpus.split(" ")) {
    if (
      token.length < 3 ||
      token === provider ||
      /^\d+$/.test(token) ||
      CONTRADICTION_STOP_TOKENS.has(token)
    ) continue;
    if (CONTRADICTION_STATE_TOKENS.has(token)) signals.add(token);
    else if (
      !NON_TOPICAL_TOKENS.has(token) &&
      !topicalAnchors.some((anchor) => anchor.split(" ").includes(token))
    ) signals.add(token);
  }
  return [...signals];
}

function citationSignalHasTopicalClaim(citation, signal, claimAssessments) {
  const citationId = String(citation?.id ?? "");
  const sentences = citationExcerptSentences(citation);
  return asArray(claimAssessments).some((assessment) => {
    const claimText = normaliseGradeText(assessment?.text);
    return assessment?.touchesRequiredFact === true &&
      asArray(assessment?.supportedIds).includes(citationId) &&
      claimText.includes(signal) &&
      sentences.some((sentence) => sentence === claimText);
  });
}

function citationSupportsContradictionSignal(citation, signal, topicalAnchors, claimAssessments) {
  const clauses = citationExcerptClauses(citation);
  if (clauses.some((clause) =>
    clause.includes(signal) && topicalAnchors.some((anchor) => clause.includes(anchor)))) {
    return true;
  }
  const title = normaliseGradeText(citation?.title);
  return topicalAnchors.some((anchor) => title.includes(anchor)) &&
    citationSignalHasTopicalClaim(citation, signal, claimAssessments);
}

function citationSupportsContradictionTopic(citation, topicalAnchors, claimAssessments) {
  if (citationExcerptClauses(citation)
    .some((clause) => topicalAnchors.some((anchor) => clause.includes(anchor)))) {
    return true;
  }
  const title = normaliseGradeText(citation?.title);
  return topicalAnchors.some((anchor) => title.includes(anchor)) &&
    asArray(claimAssessments).some((assessment) => {
      const claimText = normaliseGradeText(assessment?.text);
      return assessment?.touchesRequiredFact === true &&
        asArray(assessment?.supportedIds).includes(String(citation?.id ?? "")) &&
        citationExcerptSentences(citation).some((sentence) => sentence === claimText);
    });
}

function contradictionHasAttributedDifference(citations, summary, topicalAnchors, claimAssessments) {
  const clauses = String(summary ?? "")
    .split(/\b(?:but|however|whereas|while)\b|[;.!?]+/i)
    .map(normaliseGradeText)
    .filter(Boolean);
  const signalSets = citations.map((citation) => {
    const provider = normaliseGradeText(citation?.provider);
    const signals = clauses
      .filter((clause) => new RegExp(`\\b${provider}\\b`).test(clause))
      .flatMap((clause) => contradictionClauseSignals(clause, provider, topicalAnchors))
      .filter((signal) =>
        citationSupportsContradictionSignal(citation, signal, topicalAnchors, claimAssessments));
    return [...new Set(signals)].sort();
  });
  if (signalSets.some((signals) => signals.length === 0)) return false;
  return new Set(signalSets.map((signals) => signals.join("|"))).size >= 2;
}

function contradictionSupportedByEvidence(citations, requiredFacts, summary, claimAssessments) {
  const anchors = topicalFactAlternatives(requiredFacts);
  if (
    anchors.length === 0 ||
    citations.some((citation) =>
      !citationSupportsContradictionTopic(citation, anchors, claimAssessments))
  ) return false;
  return contradictionHasAttributedDifference(citations, summary, anchors, claimAssessments);
}

function claimSupportedByCitation(claim, citation) {
  const claimText = normaliseGradeText(claim?.text);
  const excerpt = normaliseGradeText(citation?.excerpt);
  if (!claimText || !excerpt || !excerpt.includes(claimText)) return false;
  const claimProviders = asArray(claim?.providers).map((provider) => normaliseGradeText(provider));
  const citationProvider = normaliseGradeText(citation?.provider);
  return citationProvider.length > 0 && claimProviders.includes(citationProvider);
}

const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;

/**
 * @param {{
 *   answer?: unknown,
 *   claims?: Array<{ text?: unknown, citation_ids?: unknown[], evidenceIds?: unknown[], providers?: unknown[] }>,
 *   citations?: Array<{ id?: unknown, provider?: unknown, title?: unknown, excerpt?: unknown }>,
 *   contradictions?: Array<{ summary?: unknown, evidenceIds?: unknown[], evidence_ids?: unknown[], providers?: unknown[] }>,
 *   providerCoverage?: unknown[],
 *   requiredFacts?: Array<{ id?: unknown, label?: unknown, anyOf?: unknown[], allOf?: unknown[][] }>,
 *   requiredProviders?: unknown[],
 *   requiresContradiction?: boolean,
 * }} [input]
 */
export function gradeGroundedAnswer({
  answer = "",
  claims = [],
  citations = [],
  contradictions = [],
  providerCoverage = [],
  requiredFacts = [],
  requiredProviders = [],
  requiresContradiction = false,
} = {}) {
  const factResults = asArray(requiredFacts).map((fact) => matchRequiredFact(answer, fact));
  const matchedFacts = factResults.filter((fact) => fact.matched);
  const missingFacts = factResults.filter((fact) => !fact.matched);

  const citationById = new Map(asArray(citations)
    .filter((citation) => citation && citation.id)
    .map((citation) => [String(citation.id), citation]));
  const invalidCitationIds = new Set();
  const referencedCitationIds = new Set();
  const supportedCitationIds = new Set();
  const relevantSupportedCitationIds = new Set();
  const supportedContradictionCitationIds = new Set();
  const unsupportedClaims = [];
  const irrelevantClaims = [];
  const claimAssessments = [];
  let claimCitationPairCount = 0;
  let supportedClaimCitationPairCount = 0;
  let supportedClaimCount = 0;
  let relevantClaimCount = 0;

  for (const [index, claim] of asArray(claims).entries()) {
    const ids = claimCitationIds(claim);
    const supportedIds = [];
    let supported = false;
    for (const id of ids) {
      claimCitationPairCount += 1;
      referencedCitationIds.add(id);
      const citation = citationById.get(id);
      if (!citation) {
        invalidCitationIds.add(id);
        continue;
      }
      if (!claimSupportedByCitation(claim, citation)) continue;
      supported = true;
      supportedClaimCitationPairCount += 1;
      supportedCitationIds.add(id);
      supportedIds.push(id);
    }
    if (supported) {
      supportedClaimCount += 1;
    } else {
      unsupportedClaims.push({
        index,
        text: String(claim?.text ?? ""),
        citationIds: ids,
      });
    }
    claimAssessments.push({
      index,
      text: String(claim?.text ?? ""),
      citationIds: ids,
      supportedIds,
      touchesRequiredFact: claimCarriesRequiredFactSignal(
        claim,
        supportedIds.map((id) => citationById.get(id)).filter(Boolean),
        requiredFacts,
      ),
    });
  }

  const supportedContradictions = [];
  for (const [index, contradiction] of asArray(contradictions).entries()) {
    const ids = contradictionCitationIds(contradiction);
    ids.forEach((id) => referencedCitationIds.add(id));
    const resolved = ids.map((id) => {
      const citation = citationById.get(id);
      if (!citation) invalidCitationIds.add(id);
      return citation;
    }).filter(Boolean);
    const providers = [...new Set(resolved.map((citation) => normaliseGradeText(citation.provider)).filter(Boolean))];
    if (
      ids.length >= 2 &&
      resolved.length === ids.length &&
      providers.length >= 2 &&
      String(contradiction?.summary ?? "").trim() &&
      contradictionSupportedByEvidence(resolved, requiredFacts, contradiction?.summary, claimAssessments)
    ) {
      ids.forEach((id) => {
        supportedCitationIds.add(id);
        supportedContradictionCitationIds.add(id);
        relevantSupportedCitationIds.add(id);
      });
      supportedContradictions.push({ index, summary: String(contradiction.summary), evidenceIds: ids, providers });
    }
  }

  for (const assessment of claimAssessments) {
    const relevant = assessment.touchesRequiredFact ||
      assessment.citationIds.some((id) => supportedContradictionCitationIds.has(id));
    if (relevant) {
      relevantClaimCount += 1;
      assessment.supportedIds.forEach((id) => relevantSupportedCitationIds.add(id));
    } else {
      irrelevantClaims.push({
        index: assessment.index,
        text: assessment.text,
        citationIds: assessment.citationIds,
      });
    }
  }

  const supportedProviders = [...new Set([...relevantSupportedCitationIds]
    .map((id) => citationById.get(id)?.provider)
    .map(normaliseGradeText)
    .filter(Boolean))].sort();
  const expectedProviders = [...new Set(asArray(requiredProviders).map(normaliseGradeText).filter(Boolean))].sort();
  const missingProviders = expectedProviders.filter((provider) => !supportedProviders.includes(provider));
  const reportedProviders = [...new Set(asArray(providerCoverage).map(normaliseGradeText).filter(Boolean))].sort();
  const reportedWithoutSupportingCitation = reportedProviders.filter((provider) => !supportedProviders.includes(provider));
  const citedButUnreportedProviders = supportedProviders.filter((provider) => !reportedProviders.includes(provider));

  const claimCount = asArray(claims).length;
  const citationPrecision = ratio(supportedClaimCitationPairCount, claimCitationPairCount);
  const citationCompleteness = ratio(supportedClaimCount, claimCount);
  const unsupportedClaimRate = ratio(unsupportedClaims.length, claimCount);
  const relevancePrecision = ratio(relevantClaimCount, claimCount);
  const irrelevantClaimRate = ratio(irrelevantClaims.length, claimCount);
  const citationPass = claimCount > 0 && invalidCitationIds.size === 0 && unsupportedClaims.length === 0 &&
    citationPrecision === 1 && citationCompleteness === 1;
  const relevancePass = claimCount > 0 && asArray(requiredFacts).length > 0 &&
    irrelevantClaims.length === 0 && relevancePrecision === 1;
  const contradictionPass = !requiresContradiction || supportedContradictions.length > 0;
  const factPass = factResults.length > 0 && missingFacts.length === 0;
  const providerPass = expectedProviders.length > 0 && missingProviders.length === 0;

  const citedSources = [...referencedCitationIds]
    .map((id) => citationById.get(id))
    .filter(Boolean)
    .map((citation) => ({
      id: String(citation.id),
      provider: String(citation.provider ?? "unknown"),
      title: String(citation.title ?? "Untitled source"),
      excerpt: String(citation.excerpt ?? "").slice(0, 700),
      supported: supportedCitationIds.has(String(citation.id)),
      relevant: relevantSupportedCitationIds.has(String(citation.id)),
    }));

  return {
    pass: factPass && providerPass && citationPass && relevancePass && contradictionPass,
    factPass,
    factResults,
    matchedFacts,
    missingFacts,
    matchedFactCount: matchedFacts.length,
    requiredFactCount: factResults.length,
    requiredFactRecall: ratio(matchedFacts.length, factResults.length),
    providerPass,
    requiredProviders: expectedProviders,
    supportedProviders,
    missingProviders,
    reportedProviders,
    reportedWithoutSupportingCitation,
    citedButUnreportedProviders,
    citationPass,
    citationPrecision,
    citationCompleteness,
    unsupportedClaimRate,
    relevancePass,
    relevancePrecision,
    irrelevantClaimRate,
    relevantClaimCount,
    irrelevantClaims,
    claimCount,
    supportedClaimCount,
    claimCitationPairCount,
    supportedClaimCitationPairCount,
    invalidCitationIds: [...invalidCitationIds],
    unsupportedClaims,
    requiresContradiction: Boolean(requiresContradiction),
    contradictionPass,
    supportedContradictions,
    citedSources,
  };
}

export const PDF_CANARY_KINDS = Object.freeze({
  beginning: "beginning_load_bearing",
  middle: "middle_load_bearing",
  end: "end_load_bearing",
});

/** @param {Array<{ kind?: string, pass?: boolean }> | undefined} rows */
export function summarisePdfCanaries(rows) {
  return Object.fromEntries(Object.entries(PDF_CANARY_KINDS).map(([position, kind]) => [
    position,
    asArray(rows).find((row) => row?.kind === kind)?.pass === true,
  ]));
}
