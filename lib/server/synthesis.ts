export type SynthesisEvidence = {
  id: string;
  provider: string;
  title: string;
  excerpt: string;
  timestamp?: string | null;
  url?: string | null;
};

export type GroundedClaim = {
  text: string;
  evidenceIds: string[];
  providers: string[];
};

export type GroundedContradiction = {
  summary: string;
  evidenceIds: string[];
  providers: string[];
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "already", "and", "are", "been", "before", "being",
  "but", "can", "could", "did", "does", "for", "from", "had", "has", "have", "he", "her", "him", "how",
  "into", "it", "its", "not", "our", "out", "said", "say", "she", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "was", "were", "what", "when", "where",
  "which", "who", "why", "will", "with", "would", "you", "your",
]);

// These describe the shape of a question rather than the entity it is about.
// When a question contains a concrete anchor (for example Northwind, Priya
// Raman, AuthShield, or BUG-123), a candidate must contain at least one such
// anchor before intent boosts are allowed to promote it.
const GENERIC_QUESTION_TOKENS = new Set([
  "against", "answer", "appear", "commit", "committ", "context", "deadline", "disagree",
  "elsewhere", "engineer", "exact", "fil", "fix", "issue", "merge", "open",
  "project", "promi", "resolv", "source", "track", "work",
]);

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function tokenise(value: string) {
  return clean(value.toLowerCase())
    .replace(/[^a-z0-9-]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => token.replace(/(?:ing|ed|es|s)$/i, ""));
}

function intentBoost(question: string, text: string) {
  const q = question.toLowerCase();
  const candidate = text.toLowerCase();
  let score = 0;
  const groups: Array<[RegExp, RegExp, number]> = [
    [/\b(merge|merged|ship|shipped|resolved|closed|fix)\b/, /\b(merge|merged|ship|shipped|resolved|closed|fix)\b/, 7],
    [/\b(commit|committed|promise|promised|deadline|when)\b/, /\b(commit|committed|promise|promised|deadline|before|due|will)\b/, 7],
    [/\b(escalat|who)\w*\b/, /\b(escalat|filed|reported|owner|assigned)\w*\b/, 5],
    [/\b(disagree|conflict|inconsistent|changed|moved)\w*\b/, /\b(disagree|conflict|inconsistent|changed|moved|from|to)\w*\b/, 6],
    [/\b(project|work|working)\b/, /\b(project|working|against|assigned)\b/, 3],
  ];
  for (const [questionPattern, candidatePattern, boost] of groups) {
    if (questionPattern.test(q) && candidatePattern.test(candidate)) score += boost;
  }
  return score;
}

function relevance(question: string, text: string) {
  const q = question.toLowerCase();
  const candidate = text.toLowerCase();
  const questionTokens = new Set(tokenise(question));
  const candidateTokens = new Set(tokenise(text));
  const anchors = [...questionTokens].filter((token) => !GENERIC_QUESTION_TOKENS.has(token));
  let overlap = 0;
  let anchorMatches = 0;
  for (const token of questionTokens) {
    if (!candidateTokens.has(token)) continue;
    overlap += 1;
    if (anchors.includes(token)) anchorMatches += 1;
  }
  let identifierScore = 0;
  for (const identifier of question.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []) {
    if (text.toUpperCase().includes(identifier.toUpperCase())) identifierScore += 12;
  }
  if (/\bpromise\b/.test(q) && !/\b(promise|promised|commit|committed)\b/.test(candidate)) return 0;
  if (/\b(disagree|conflict)\w*\b/.test(q) && anchors.length >= 2 && anchorMatches < 2 && identifierScore === 0) return 0;
  if (/\bopen\b/.test(q) && /\b(resolved|complete|completed|closed)\b/.test(q)) {
    const hasTrackedState = /\b(issue|ticket|tracked|tracking|open)\b/.test(candidate);
    const hasCompletionState = /\b(merged|shipped|resolved|closed|completed|complete)\b/.test(candidate);
    if (!hasTrackedState || !hasCompletionState) return 0;
  }
  if (anchors.length && anchorMatches === 0 && identifierScore === 0) return 0;
  if (overlap === 0 && identifierScore === 0) return 0;
  return overlap * 3 + anchorMatches * 2 + identifierScore + intentBoost(question, text);
}

/** Stable relevance order used by both the answer and its citation cards. */
export function rankEvidenceForQuestion<T extends SynthesisEvidence>(question: string, evidence: T[]): T[] {
  const scored = evidence
    .map((item, index) => ({
      item,
      index,
      score: relevance(question, `${item.title}. ${item.excerpt}`),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const relevant = scored.filter((entry) => entry.score > 0);
  return (relevant.length ? relevant : scored.slice(0, 3))
    .slice(0, 12)
    .map((entry) => entry.item);
}

function sentences(item: SynthesisEvidence) {
  const body = clean(item.excerpt || item.title);
  return body
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(clean)
    .filter((sentence) => sentence.length >= 22 && sentence.length <= 360);
}

function normalisedDate(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : value.toLowerCase();
}

function contradictions(question: string, claims: GroundedClaim[], evidenceById: Map<string, SynthesisEvidence>) {
  const result: GroundedContradiction[] = [];
  const selected = claims.flatMap((claim) => claim.evidenceIds.map((id) => evidenceById.get(id))).filter(Boolean) as SynthesisEvidence[];
  const dated = selected.flatMap((item) => {
    const text = `${item.title}. ${item.excerpt}`;
    if (!/\b(deadline|due|ship|before|moved|date)\b/i.test(text)) return [];
    const dates = text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi) ?? [];
    return dates.map((date) => ({ item, date, normalised: normalisedDate(date) }));
  });
  const distinctDates = [...new Set(dated.map((entry) => entry.normalised))];
  if (/\b(disagree|conflict|inconsistent|changed|moved|deadline)\w*\b/i.test(question) && distinctDates.length > 1) {
    const conflicts = dated.filter((entry, index, all) => all.findIndex((candidate) => candidate.normalised === entry.normalised) === index).slice(0, 3);
    result.push({
      summary: `The cited records contain different dates: ${conflicts.map((entry) => `${entry.item.provider} says ${entry.date}`).join("; ")}.`,
      evidenceIds: conflicts.map((entry) => entry.item.id),
      providers: [...new Set(conflicts.map((entry) => entry.item.provider))],
    });
  }

  const completed = selected.find((item) => /\b(merged|shipped|resolved|closed|completed)\b/i.test(`${item.title} ${item.excerpt}`));
  const open = selected.find((item) => /\b(still\s+(?:showing\s+as\s+)?open|remains?\s+open|ticket\s+still\s+open)\b/i.test(`${item.title} ${item.excerpt}`));
  if (completed && open) {
    result.push({
      summary: `${completed.provider} reports the work complete while the tracked issue is still open.`,
      evidenceIds: [...new Set([completed.id, open.id])],
      providers: [...new Set([completed.provider, open.provider])],
    });
  }
  return result;
}

/**
 * Evidence-constrained synthesis: every displayed sentence is copied from a cited source.
 * It deliberately abstains instead of generating connective facts that were not retrieved.
 */
export function synthesiseGroundedAnswer(question: string, evidence: SynthesisEvidence[]) {
  const ranked = rankEvidenceForQuestion(question, evidence);
  const candidates = ranked.flatMap((item, evidenceIndex) =>
    sentences(item).map((text, sentenceIndex) => {
      const sentenceScore = relevance(question, text);
      const titleScore = relevance(question, item.title);
      return {
        item,
        text,
        // A relevant title may break a tie, but it cannot make an unrelated
        // paragraph into a claim.
        score: sentenceScore > 0
          ? sentenceScore + Math.min(titleScore, 3) - sentenceIndex * 0.15 - evidenceIndex * 0.05
          : 0,
      };
    }),
  ).sort((a, b) => b.score - a.score);

  const picked: typeof candidates = [];
  const seenText = new Set<string>();
  const seenProviders = new Set<string>();
  const scoreFloor = Math.max(6, (candidates[0]?.score ?? 0) * 0.3);
  for (const candidate of candidates) {
    const key = candidate.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 120);
    if (candidate.score < scoreFloor || seenText.has(key)) continue;
    if (seenProviders.has(candidate.item.provider) && picked.length < Math.min(3, new Set(ranked.map((item) => item.provider)).size)) continue;
    picked.push(candidate);
    seenText.add(key);
    seenProviders.add(candidate.item.provider);
    if (picked.length === 4) break;
  }
  if (picked.length < 2) {
    for (const candidate of candidates) {
      if (picked.includes(candidate) || candidate.score < scoreFloor) continue;
      picked.push(candidate);
      if (picked.length === 3) break;
    }
  }

  const claims: GroundedClaim[] = picked.map((candidate) => ({
    text: candidate.text,
    evidenceIds: [candidate.item.id],
    providers: [candidate.item.provider],
  }));
  const citedOrder = [...new Set(claims.flatMap((claim) => claim.evidenceIds))];
  const evidenceIndex = new Map(citedOrder.map((id, index) => [id, index + 1]));
  const answer = claims.length
    ? claims.map((claim) => `${claim.text} [${evidenceIndex.get(claim.evidenceIds[0])}]`).join(" ")
    : "No safe supporting evidence was returned. QueueProof will not invent an answer.";
  const evidenceById = new Map(ranked.map((item) => [item.id, item]));
  const detectedContradictions = contradictions(question, claims, evidenceById);
  const providerCoverage = [...new Set(claims.flatMap((claim) => claim.providers))];

  return {
    answer,
    evidence: ranked,
    claims,
    contradictions: detectedContradictions,
    missingInformation: claims.length ? [] : ["No claim could be supported by the retrieved records."],
    validation: {
      status: claims.length ? "grounded" as const : "abstained" as const,
      claimCount: claims.length,
      citedClaimCount: claims.filter((claim) => claim.evidenceIds.length > 0).length,
      evidenceCount: ranked.length,
      providerCoverage,
    },
  };
}
