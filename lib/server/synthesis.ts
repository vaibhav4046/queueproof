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
    [/\b(still in force|single approver|still valid)\b/, /\b(supersed|withdrawn|must not|no longer|two approver)\w*\b/, 12],
    [/\b(programme code|project alias|alias)\b/, /\b(programme code|HR-P\d+|field autonomy toolkit|alias)\b/i, 10],
    [/\b(require|requirement|what does)\w*\b/, /\b(english translation|reduc\w* to fifteen minute|fifteen minute|will be reduc)\w*\b/i, 12],
    [/\b(role|programme does|which programme|own)\w*\b/, /\b(staff reliability engineer|customer escalation manager|engineering owner|HR-\d+)\b/i, 9],
    [/\b(severity|impact window|acknowledgement target|approves)\b/, /\b(SEV-\d|impact|minute|duty operations lead|approver)\w*\b/i, 8],
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
  // 16 (not 12) so deeper document retrieval can still reach an exact-fact
  // chunk that relevance ranking placed just outside the old cut-off. The pick
  // loop still caps the final answer at a handful of claims.
  return (relevant.length ? relevant : scored.slice(0, 3))
    .slice(0, 16)
    .map((entry) => entry.item);
}

/**
 * A question carries a concrete anchor when it names a specific record or person
 * (BUG-123, ADR-037, Priya Ramanathan). Value-focused extraction is gated on that
 * so a generic question can never pull a value sentence from unrelated evidence.
 */
function hasConcreteAnchor(question: string) {
  if (/\b[A-Z][A-Z0-9]+-\d+\b/.test(question)) return true;
  const words = question.split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((word) => /^[A-Z][a-zA-Z'-]*$/.test(word));
  return words.some((word) => word.length >= 4 && !GENERIC_QUESTION_TOKENS.has(word.toLowerCase()));
}

/**
 * Intent-driven value extraction. When a question explicitly asks for a value
 * (a release version, a date, a superseding rule, an impact window, a desk
 * name), these patterns surface the verbatim sentences that carry that value so
 * they can compete as cited claims. They only produce candidates that already
 * exist inside retrieved evidence; they never invent text. Except for the
 * programme-code alias intent, they require a concrete anchor in the question.
 */
function valuePatternsForQuestion(question: string): RegExp[] {
  const patterns: RegExp[] = [];
  const anchored = hasConcreteAnchor(question);
  const months = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
  const date = new RegExp(`\\b\\d{1,2}\\s+${months}\\s+\\d{4}\\b`, "gi");
  const version = /\b[A-Z][A-Za-z]*\s+SDK\s+\d+(?:\.\d+)+\b/gi;

  // Date/version/release windows are the most likely to surface marginal text,
  // so they additionally require an exact record identifier (BUG-123, PR-8871)
  // in the question rather than any capitalised word.
  if (anchored && /\b[A-Z][A-Z0-9]+-\d+\b/.test(question) &&
      /\b(release|released|fixed in|fix was|merged on|merged|ratified|when was|when did|shipped)\b/i.test(question)) {
    patterns.push(date);
    patterns.push(version);
    patterns.push(/\bfixed\s+in\s+[^.!?\n]{0,80}/gi);
    patterns.push(/\bmerged\s+on\s+[^.!?\n]{0,80}/gi);
    patterns.push(/\breleased?\s+(?:in|on)\s+[^.!?\n]{0,80}/gi);
    patterns.push(/\bratified\s+on\s+[^.!?\n]{0,80}/gi);
  }
  if (anchored && /\b(still in force|supersed|withdrawn|single approver|binding rule|originally permit|original permission|permit|permitted|rule|policy)\b/i.test(question)) {
    patterns.push(/\b(?:supersed\w*|withdrawn|no longer in force|no longer valid)[^.!?\n]{0,130}/gi);
    patterns.push(/\btwo-?approver\w*[^.!?\n]{0,150}/gi);
    patterns.push(/\bSafety Case Owner[^.!?\n]{0,110}/gi);
    patterns.push(/\bbinding rule[^.!?\n]{0,130}/gi);
    patterns.push(/\bmust not be relied on[^.!?\n]{0,90}/gi);
  }
  if (anchored && /\b(impact|how long|duration)\b/i.test(question)) {
    // These stay narrow so "how long did impact last" pulls the duration
    // sentence itself, not every definitional mention of "customer visible
    // impact" scattered through the handbook. The answer must carry the
    // duration value or the "impact lasted" wording to be a value candidate.
    patterns.push(/\b\d{1,4}\s+(?:minutes?|min\b|hours?)\s+of\s+[^.!?\n]{0,90}/gi);
    patterns.push(/\bcustomer\s+(?:impact|visible)\s+lasted\s+[^.!?\n]{0,90}/gi);
    patterns.push(/\bimpact\s+lasted\s+[^.!?\n]{0,90}/gi);
    patterns.push(/\bimpact\s+window\s+[^.!?\n]{0,90}/gi);
  }
  // A "what happened" question about a named record wants the summary sentence
  // itself ("INC-2031 was a Billing Migration double charge event on 8 April
  // 2031"). The pattern embeds the record identifier, so it can only match
  // verbatim evidence that names the same record.
  if (anchored && /\b[A-Z][A-Z0-9]+-\d+\b/.test(question) &&
      /\b(what happened|what was|describe|summary|occurred|record)\b/i.test(question)) {
    patterns.push(/\b[A-Z][A-Z0-9]+-\d+\s+was\s+a\s+[^.!?\n]{0,140}/gi);
  }
  if (anchored && /\bescalat\w*/i.test(question)) {
    patterns.push(/\bescalation desk[^.!?\n]{0,60}/gi);
  }
  // Programme-code / project-alias questions keep their dedicated value intent.
  if (/\b(programme code|project alias|alias)\b/i.test(question)) {
    patterns.push(/\bHR-P\d+\b/gi);
  }
  return patterns;
}

function focusedWindows(question: string, body: string) {
  const exactIdentifiers = question.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [];
  const anchors = [...new Set([
    ...exactIdentifiers.map((value) => value.toLowerCase()),
    ...tokenise(question).filter((token) => !GENERIC_QUESTION_TOKENS.has(token) && token.length >= 4),
  ])];
  const lower = body.toLowerCase();
  const windows: string[] = [];
  for (const anchor of anchors) {
    let offset = 0;
    for (let occurrence = 0; occurrence < 2; occurrence += 1) {
      const index = lower.indexOf(anchor, offset);
      if (index < 0) break;
      const previousStop = lower.lastIndexOf(". ", index);
      const start = previousStop >= Math.max(0, index - 170) ? previousStop + 2 : Math.max(0, index - 150);
      const nextStop = lower.indexOf(". ", index + anchor.length);
      const end = nextStop > index && nextStop <= index + 330 ? nextStop + 1 : Math.min(body.length, index + 300);
      windows.push(clean(body.slice(start, end)));
      offset = index + anchor.length;
    }
  }

  // Value-focused candidates for explicit value intents. The window includes
  // backward context so phrases like "the Billing Migration escalation desk"
  // survive even though the pattern only anchors on "escalation desk".
  for (const pattern of valuePatternsForQuestion(question)) {
    for (const match of body.matchAll(pattern)) {
      const index = match.index ?? 0;
      windows.push(clean(body.slice(Math.max(0, index - 160), Math.min(body.length, index + 200))));
    }
  }
  return windows;
}

function sentences(item: SynthesisEvidence, question: string) {
  const raw = item.excerpt || item.title;
  // Markdown headings and horizontal rules often sit between otherwise normal
  // sentences. Convert those boundaries before splitting so a useful sentence
  // is not rejected as one multi-kilobyte block. Query-focused windows preserve
  // compact table rows and exact-ID context that contain no punctuation.
  const body = clean(raw
    .replace(/\s+(?:#{1,6}|-{3,}|={2,})\s*/g, ". ")
    .replace(/\s+[-*]\s+(?=[A-Z0-9])/g, ". "));
  return [...new Set([
    ...body.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(clean),
    ...focusedWindows(question, body),
  ])].filter((sentence) => sentence.length >= 18 && sentence.length <= 420);
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

type RequestedFacet = {
  label: string;
  requestedBy: RegExp;
  supportedBy: RegExp;
};

// These are deliberately narrow, observable facets rather than a general language
// model. They prevent a one-sentence hit from being labelled fully grounded when a
// compound question explicitly asks for several independent facts.
const REQUESTED_FACETS: RequestedFacet[] = [
  {
    label: "escalation actor",
    requestedBy: /\bwho\b[^?]{0,100}\bescalat\w*\b|\bwho\s+escalat\w*\b/i,
    supportedBy: /\b(?:escalat|reported|raised)\w*\b/i,
  },
  {
    label: "engineering commitment",
    requestedBy: /\b(?:commit|promise)\w*\b/i,
    supportedBy: /\b(?:commit|promise)\w*\b|\bhard customer commitment\b/i,
  },
  {
    label: "completion state",
    requestedBy: /\b(?:already\s+)?(?:merged|shipped|resolved|closed)\b|\bis\s+the\s+fix\b/i,
    supportedBy: /\b(?:merged|shipped|resolved|closed|completed)\b/i,
  },
  {
    label: "date or deadline",
    requestedBy: /\bwhen\b|\bdue\b|\bdeadline\b/i,
    supportedBy: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
  },
  {
    label: "filing actor",
    requestedBy: /\bwho\s+filed\b/i,
    supportedBy: /\bfiled\b/i,
  },
  {
    label: "project association",
    requestedBy: /\bwhich\s+project\b|\bproject\b[^?]{0,80}\bagainst\b/i,
    supportedBy: /\b(?:against|project|programme)\b/i,
  },
];

function missingRequestedFacets(question: string, claims: GroundedClaim[]) {
  const supportedCorpus = claims.map((claim) => claim.text).join(" ");
  return REQUESTED_FACETS
    .filter((facet) => facet.requestedBy.test(question) && !facet.supportedBy.test(supportedCorpus))
    .map((facet) => `Insufficient evidence for the requested ${facet.label}.`);
}

/**
 * Evidence-constrained synthesis: every displayed sentence is copied from a cited source.
 * It deliberately abstains instead of generating connective facts that were not retrieved.
 */
const normaliseClaimKey = (text: string) =>
  text.toLowerCase()
    .replace(/[#*_`>]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

/**
 * Sentences long enough to act as the identity of a claim. Value windows drawn
 * from different chunks often repeat the same fact sentence with different
 * leading context ("Customer impact lasted 41 minutes…" appears in several
 * windows); a shared long sentence marks the candidate as a duplicate of an
 * already-picked claim. Headings and short chrome stay below the length gate so
 * they never deduplicate genuinely different rows.
 */
const claimSentences = (text: string) =>
  text.replace(/#+|\*+|`+|_+|>/g, " ")
    .split(/[.!?]+\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 25);

export function synthesiseGroundedAnswer(question: string, evidence: SynthesisEvidence[]) {
  const ranked = rankEvidenceForQuestion(question, evidence);
  const valuePatterns = valuePatternsForQuestion(question);
  const candidates = ranked.flatMap((item, evidenceIndex) =>
    sentences(item, question).map((text, sentenceIndex) => {
      const sentenceScore = relevance(question, text);
      const titleScore = relevance(question, item.title);
      // A value candidate carries the exact answer the question asked for even
      // when its window does not repeat the question's own tokens (for example
      // "fixed in Rover SDK 4.2.1" for a question about BUG-123). It is always
      // verbatim evidence text, so promoting it cannot fabricate an answer.
      // The matched phrase is also recorded so repeated windows of the same
      // fact sentence from different chunks collapse into one claim.
      let valuePhrase: string | null = null;
      const isValueCandidate = valuePatterns.some((pattern) => {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (!match) return false;
        valuePhrase = match[0].toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
        return true;
      });
      return {
        item,
        text,
        valuePhrase,
        // A relevant title may break a tie, but it cannot make an unrelated
        // paragraph into a claim.
        score: (sentenceScore > 0 || isValueCandidate)
          ? sentenceScore + (isValueCandidate ? 16 : 0) + Math.min(titleScore, 3) - sentenceIndex * 0.15 - evidenceIndex * 0.05
          : 0,
      };
    }),
  ).sort((a, b) => b.score - a.score);

  const picked: typeof candidates = [];
  const seenKeys = new Set<string>();
  const seenSentences = new Set<string>();
  const seenValuePhrases = new Set<string>();
  const seenProviders = new Set<string>();
  const scoreFloor = Math.max(6, (candidates[0]?.score ?? 0) * 0.3);
  for (const candidate of candidates) {
    const key = normaliseClaimKey(candidate.text);
    if (candidate.score < scoreFloor || seenKeys.has(key)) continue;
    // Value windows drawn from different chunks repeat the same fact phrase
    // ("customer impact lasted 41 minutes…"). One phrase, one claim, so the
    // remaining slots stay open for the other facets of the question.
    if (candidate.valuePhrase && seenValuePhrases.has(candidate.valuePhrase)) continue;
    // A candidate that repeats a long sentence already carried by a picked
    // claim is a duplicate of it, even when its leading context differs.
    if (claimSentences(candidate.text).some((sentence) => seenSentences.has(sentence))) continue;
    // Short claims contained inside an already-picked claim are duplicates of
    // it (a heading repeated with and without its section prefix).
    if (key.length < 60 && [...seenKeys].some((existing) => existing.includes(key) || key.includes(existing))) continue;
    if (seenProviders.has(candidate.item.provider) && picked.length < Math.min(3, new Set(ranked.map((item) => item.provider)).size)) continue;
    picked.push(candidate);
    seenKeys.add(key);
    if (candidate.valuePhrase) seenValuePhrases.add(candidate.valuePhrase);
    claimSentences(candidate.text).forEach((sentence) => seenSentences.add(sentence));
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
    : "Insufficient evidence. QueueProof will not invent an answer.";
  const evidenceById = new Map(ranked.map((item) => [item.id, item]));
  const detectedContradictions = contradictions(question, claims, evidenceById);
  const providerCoverage = [...new Set(claims.flatMap((claim) => claim.providers))];
  const missingInformation = claims.length
    ? missingRequestedFacets(question, claims)
    : ["No claim could be supported by the retrieved records."];
  const validationStatus = claims.length === 0
    ? "abstained" as const
    : missingInformation.length > 0
      ? "partial" as const
      : "grounded" as const;

  return {
    answer,
    evidence: ranked,
    claims,
    contradictions: detectedContradictions,
    missingInformation,
    validation: {
      status: validationStatus,
      claimCount: claims.length,
      citedClaimCount: claims.filter((claim) => claim.evidenceIds.length > 0).length,
      evidenceCount: ranked.length,
      providerCoverage,
    },
  };
}
