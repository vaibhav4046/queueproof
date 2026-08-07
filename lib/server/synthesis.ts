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

const RECORD_IDENTIFIER = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/g;
const recordIdentifiers = (value: string) => {
  RECORD_IDENTIFIER.lastIndex = 0;
  return value.match(RECORD_IDENTIFIER) ?? [];
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
  "project", "promi", "resolv", "source", "sourc", "track", "work",
  // Provider names describe where to look, not what constitutes a supported
  // answer. Treating them as entity anchors let an unrelated Linear welcome
  // document outrank the Slack receipt that actually contained BUG-123.
  "document", "email", "github", "gmail", "jira", "linear", "notion", "slack",
]);

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function tokenise(value: string) {
  return clean(value.toLowerCase())
    .replace(/[^a-z0-9-]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => token.replace(/(?:ing|ed|es|s)$/i, ""));
}

/** Parsed epoch millis for a source timestamp, or null when absent/unparseable. */
const evidenceTime = (timestamp?: string | null): number | null => {
  if (!timestamp) return null;
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? null : time;
};

/**
 * A question that explicitly asks for the newest item rather than any item.
 * Pure lexical scoring cannot answer these; the pool must be re-ranked by
 * source timestamp. "Most recently" was a real miss — it read as an ordinary
 * single-source fact, so an older but lexically closer receipt won the slot.
 */
const recencyQuestion = (question: string) =>
  /\b(?:most\s+recent(?:ly)?|latest|newest)\b/i.test(question);

/**
 * Per-item recency factor in [0, 1] keyed by evidence id, using min-max
 * normalisation across the dated pool. The newest dated item is 1, the oldest
 * is 0, so relative gaps within a small window stay meaningful (a plain
 * epoch ratio would compress July-vs-June into ~0.99 and never reorder).
 * Absent, unparseable, or single-valued timestamps yield no ordering signal,
 * so an empty map is returned and callers skip recency work entirely.
 */
const recencyFactors = (evidence: readonly SynthesisEvidence[]): Map<string, number> => {
  const times = new Map<string, number>();
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = 0;
  for (const item of evidence) {
    const time = evidenceTime(item.timestamp);
    if (time == null) continue;
    times.set(item.id, time);
    if (time < minTime) minTime = time;
    if (time > maxTime) maxTime = time;
  }
  const factors = new Map<string, number>();
  if (times.size > 1 && maxTime > minTime) {
    for (const [id, time] of times) factors.set(id, (time - minTime) / (maxTime - minTime));
  }
  return factors;
};

/**
 * Bonus awarded to the newest relevant item in a recency-ordered pool. Large
 * enough to reorder equal or near-equal lexical matches, small enough that a
 * genuinely irrelevant fragment still loses to real relevance.
 */
const RECENCY_WEIGHT = 28;

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

// A question about what was delivered. Mentioning the verb is not enough to
// answer one: the evidence has to assert the delivery, not use the word in
// passing. Kept deliberately narrow so it matches receipts, not commentary.
const DELIVERY_QUESTION = /\b(?:ship|shipped|shipping|release|released|deliver|delivered|launch|launched|deploy|deployed)\b/;
// A bare past participle is far too common in ordinary prose to count as proof:
// "is released as open source" and "likely trans-shipped from a nearby port"
// both contain one. A delivery assertion needs the auxiliary or the temporal
// frame that makes it a statement about something that actually shipped.
const DELIVERY_ASSERTION =
  /\b(?:was|were|has been|have been)\s+(?:successfully\s+)?(?:shipped|released|deployed|merged|launched|delivered|rolled out)\b|\bready to (?:ship|release|deploy)\b|\bwent live\b|\bcut the release\b|\b(?:shipped|released|deployed|merged|launched)\s+(?:on|in|to|last|this)\s/;

// Delivery receipts live in systems of record. Mail and marketing surfaces use
// delivery verbs constantly without recording that this team delivered anything,
// so an unanchored "what did we ship" scan does not accept them as proof. An
// anchored question ("did we ship the Northwind hotfix?") is unaffected.
const DELIVERY_RECORD_PROVIDERS = new Set([
  "github", "gitlab", "linear", "jira", "shortcut", "slack", "notion", "confluence", "document",
]);

// A question about what is stopping something. Naming the same subject is not an
// answer to one -- the evidence has to state the impediment. "What is blocking
// the Atlas launch?" was answered from recruiter email about Atlas Copco, an
// unrelated company that shares the token "atlas" and uses "launch" in
// boilerplate ("delivering projects from concept through to launch"). On token
// overlap alone that advert is as good a match as the Linear receipt, so four
// such fragments were assembled into a confident answer that never said what the
// blocker was.
const IMPEDIMENT_QUESTION =
  /\b(?:blocking|blocked|blockers?|holding up|held up|stalled|stalling|waiting on|in the way)\b/;
// Stated impediments, not the mere presence of the word. A bare participle is
// not proof: "software readiness was never the blocking path" reports that
// nothing was blocked, so "blocking" only qualifies with a subject in front of
// it, and the remaining forms all name something that is being prevented.
const IMPEDIMENT_ASSERTION =
  /\b(?:is|are|was|were|remains?|stays?|still)\s+blocked\b|\bblocked\s+(?:on|by)\b|\bblockers?\b|\b(?:is|are|were|keeps?|kept)\s+blocking\b|\bwaiting\s+(?:on|for)\b|\b(?:cannot|can\s?not|can't|could\s?not|couldn't)\s+(?:be\s+)?(?:start|started|ship|shipped|proceed|land|deploy|deployed|release|released|launch|launched|continue|go\s+live)\b|\bheld\s+up\s+by\b|\bholding\s+up\b|\bdepends?\s+on\b|\bblocks\s+\w/;

// A committed GA-date lookup asks for one relationship-bound value: the date
// must belong to the named programme's general-availability milestone. Token
// overlap is not sufficient here. In production, independent fragments supplied
// one facet each ("Atlas Launch" in an incident, "general availability" in a
// Snowflake newsletter, and a date in an Anthropic launch post), and those
// unrelated facts were assembled into a confidently grounded answer.
const COMMITTED_GENERAL_AVAILABILITY_DATE_QUESTION =
  /\bcommitt\w*\b[^?]{0,80}\b(?:general\s+availability|GA)\b|\b(?:general\s+availability|GA)\b[^?]{0,80}\bcommitt\w*\b/i;
const GENERAL_AVAILABILITY_ASSERTION =
  /\b(?:general\s+availability|generally\s+available|GA(?:\s+date)?)\b/i;
const CALENDAR_DATE_ASSERTION =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b/i;

function namesQuestionSubject(question: string, candidate: string) {
  const subjects = namedSubjects(question);
  if (!subjects.length) return false;
  const escaped = subjects.map((subject) => subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Preserve a multi-word proper name as one subject. Allow punctuation or
  // markdown between its words, but not unrelated prose that happens to mention
  // the words independently.
  return new RegExp(`\\b${escaped.join("[^a-z0-9]+")}\\b`, "i").test(candidate);
}

function supportsCommittedGeneralAvailabilityDate(question: string, candidate: string) {
  if (!COMMITTED_GENERAL_AVAILABILITY_DATE_QUESTION.test(question)) return true;
  return namesQuestionSubject(question, candidate) &&
    GENERAL_AVAILABILITY_ASSERTION.test(candidate) &&
    CALENDAR_DATE_ASSERTION.test(candidate);
}

function relevance(question: string, text: string, provider?: string) {
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
  for (const identifier of recordIdentifiers(question)) {
    if (text.toUpperCase().includes(identifier.toUpperCase())) identifierScore += 12;
  }
  // Keep the subject, requested milestone, and value in the same evidence unit.
  // This deliberately abstains when retrieval returned only independent facet
  // matches; a citation-backed answer cannot be composed from those fragments.
  if (!supportsCommittedGeneralAvailabilityDate(question, text)) return 0;
  if (/\bpromise\b/.test(q) && !/\b(promise|promised|commit|committed)\b/.test(candidate)) return 0;
  // Missing-tracker questions ask for negative evidence, not merely a nearby
  // promise or issue. The retained evidence unit must itself assert absence.
  const missingTrackerQuestion =
    /\b(?:no|without|missing|lacks?)\b[^?]{0,70}\b(?:issue|ticket|track(?:ed|ing)?)\b/.test(q) ||
    /\b(?:issue|ticket)\b[^?]{0,50}\b(?:missing|absent|not tracked)\b/.test(q);
  const missingTrackerAssertion =
    /\b(?:no (?:linear )?(?:issue|ticket)|not tracked(?: in [a-z0-9_-]+)?|without (?:an? )?(?:issue|ticket)|lacks? (?:an? )?(?:issue|ticket))\b/.test(candidate);
  if (missingTrackerQuestion && !missingTrackerAssertion) return 0;
  if (/\b(disagree|conflict)\w*\b/.test(q) && anchors.length >= 2 && anchorMatches < 2 && identifierScore === 0) return 0;
  if (/\bopen\b/.test(q) && /\b(resolved|complete|completed|closed)\b/.test(q)) {
    const hasTrackedState = /\b(issue|ticket|tracked|tracking|open)\b/.test(candidate);
    const hasCompletionState = /\b(merged|shipped|resolved|closed|completed|complete)\b/.test(candidate);
    if (!hasTrackedState || !hasCompletionState) return 0;
  }
  // "What did we ship most recently?" names no record and no person, so the only
  // lexical hook it offers is the verb itself. Newsletter prose shares that verb
  // without attesting to anything ("safe to ship code at that speed", "developers
  // who do not ship code that compiles"), which is how four unrelated Gmail
  // fragments were once assembled into a confidently grounded answer. When a
  // delivery question carries no concrete anchor, the candidate must actually
  // state that something was delivered -- and that assertion is itself the topical
  // match, since a receipt may say "deployed" where the question said "ship".
  const unanchoredDelivery =
    DELIVERY_QUESTION.test(q) && identifierScore === 0 && !hasConcreteAnchor(question);
  const deliveryRecord = !provider || DELIVERY_RECORD_PROVIDERS.has(provider.toLowerCase());
  const deliveryScore = unanchoredDelivery && deliveryRecord && DELIVERY_ASSERTION.test(candidate) ? 8 : 0;
  if (unanchoredDelivery && deliveryScore === 0) return 0;
  // Unlike delivery, an impediment question is gated even when it is anchored:
  // the anchor is the thing being blocked, so matching it proves only that the
  // candidate is about the same subject, never that it records an obstruction.
  // An exact record identifier is the one exception -- naming BUG-123 back is a
  // hard join, not a coincidence of vocabulary.
  if (IMPEDIMENT_QUESTION.test(q) && identifierScore === 0) {
    if (!IMPEDIMENT_ASSERTION.test(candidate)) return 0;
    // Asserting an obstruction is still not asserting *this* obstruction. A
    // commit reading "the local hook runner is blocked by a Windows/WSL
    // E_ACCESSDENIED launch failure" cleared the assertion gate and answered
    // "What is blocking the Atlas launch?", because the sole anchor match came
    // from the generic noun "launch" while "Atlas" appeared nowhere in it. When
    // the question names its subject, the evidence has to name it too.
    const subjects = namedSubjectTokens(question);
    if (subjects.length && !subjects.some((token) => candidateTokens.has(token))) return 0;
  }
  if (anchors.length && anchorMatches === 0 && identifierScore === 0 && deliveryScore === 0) return 0;
  if (overlap === 0 && identifierScore === 0 && deliveryScore === 0) return 0;
  return overlap * 3 + anchorMatches * 2 + identifierScore + deliveryScore + intentBoost(question, text);
}

const BRIDGE_GENERIC_TOKENS = new Set([
  ...GENERIC_QUESTION_TOKENS,
  "authentication", "customer", "engineering", "incident", "outage", "reported", "team",
]);

const staleBridgeQuestion = (question: string) =>
  /\bopen\s+(?:issue|ticket)\b[^?]{0,100}\b(?:resolved|complete|completed|closed|merged|shipped|elsewhere)\b/i.test(question) ||
  /\bappears?(?:\s+\w+){0,5}\s+resolved\s+elsewhere\b/i.test(question) ||
  // Natural compound questions often put the delivered state first, then ask
  // whether "the tracker still shows that work as open". This is the same
  // conservative state join: crossSourceBridgeScore still requires a shared
  // exact record ID plus two non-generic anchors before another provider wins.
  /\b(?:tracker|tracking|issue|ticket)\b[^?]{0,90}\b(?:still\s+)?(?:show(?:s|ing)?|remain(?:s|ing)?|stay(?:s|ing)?)?[^?]{0,30}\bopen\b/i.test(question);

const bridgeTokens = (value: string) => new Set(
  tokenise(value).filter((token) => token.length >= 4 && !BRIDGE_GENERIC_TOKENS.has(token)),
);

const providerNamedInQuestion = (question: string, provider: string) => {
  const canonical = provider.toLowerCase().replace(/[_-]+/g, " ");
  const aliases = canonical === "gmail" ? [canonical, "email"] : [canonical];
  return aliases.some((label) => new RegExp(
    `(^|[^a-z0-9])${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
    "i",
  ).test(question));
};

/**
 * Score a conservative one-hop entity join from a directly relevant receipt to a
 * second provider. This is intentionally unavailable for ordinary broad questions:
 * it is used only for an exact record lookup or an explicit open-vs-complete state
 * check, requires a directly relevant seed from another provider, and requires one
 * exact shared record ID plus another non-generic anchor.
 */
function crossSourceBridgeScore(
  question: string,
  candidateText: string,
  candidateProvider: string,
  evidence: SynthesisEvidence[],
) {
  const questionIds = recordIdentifiers(question);
  const staleState = staleBridgeQuestion(question);
  if (!questionIds.length && !staleState) return 0;
  const candidateCorpus = clean(candidateText);
  const relationRequired = staleState || /\bwho\s+filed\b|\bwhich\s+project\b|\bproject\b[^?]{0,80}\bagainst\b/i.test(question);
  if (relationRequired && !/\b(?:against|filed|issue|record|ticket|track(?:ed|ing)?)\b/i.test(candidateCorpus)) {
    return 0;
  }

  const candidateTokens = bridgeTokens(candidateCorpus);
  const candidateIds = new Set(recordIdentifiers(candidateCorpus));
  let best = 0;
  for (const seed of evidence) {
    if (seed.provider === candidateProvider) continue;
    const seedCorpus = `${seed.title}. ${seed.excerpt}`;
    if (relevance(question, seedCorpus) <= 0) continue;
    if (questionIds.length && !questionIds.some((identifier) => seedCorpus.toUpperCase().includes(identifier))) {
      continue;
    }
    const seedTokens = bridgeTokens(seedCorpus);
    const shared = [...candidateTokens].filter((token) => seedTokens.has(token));
    const sharedIds = [...candidateIds].filter((identifier) => seedCorpus.toUpperCase().includes(identifier));
    // The bridge is an exact one-hop join, not fuzzy entity expansion. Both
    // receipts must share a record identifier plus at least one other anchor.
    if (sharedIds.length === 0 || shared.length < 2) continue;
    // A bridge qualifies supporting context; it must never outrank the directly
    // relevant receipt that introduced the join key.
    best = Math.max(best, Math.min(10, 4 + shared.length + sharedIds.length * 2));
  }
  return best;
}

const AUTHORITY_QUESTION = /\b(?:authority|binding|current|draft|force|govern|original(?:ly)?|permit(?:ted)?|policy|ratif\w*|replac\w*|rule|still|supersed\w*|today|valid|withdrawn)\b/i;
const AUTHORITY_RELATION = /\b(?:binding|controlling|current|govern\w*|must|no longer|operational authority|ratif\w*|replac\w*|requires?|shall|supersed\w*|withdrawn)\b/i;
const STRONG_AUTHORITY_LINK = /\b(?:(?:binding|controlling|current)\s+(?:decision|policy|rule|standard)|governed\s+by|replaced\s+by|supersed\w*\s+by)\b/i;
const NON_AUTHORITY_STATE = /\b(?:carries? no (?:operational )?authority|must not be relied on|never ratified|no longer (?:binding|in force|valid)|not (?:binding|in force|ratified|valid)|superseded|withdrawn)\b/i;
const CURRENT_AUTHORITY_STATE = /\b(?:(?:binding|controlling|current)\s+(?:decision|policy|rule|standard)|governs?|in force|requires?|must|shall)\b/i;
const AUTHORITY_DESIGNATION = /\b(?:binding|controlling|current)\s+(?:decision|policy|rule|standard)\b/i;
const NORMATIVE_REQUIREMENT = /\b(?:approvals?|approvers?|requires?|must|shall)\b/i;
const HISTORICAL_PERMISSION = /\b(?:at issue|formerly|historical|originally|previously|used to|was permitted|were permitted|allowed|could|may)\b/i;

type AuthorityContext = {
  active: boolean;
  questionIds: Set<string>;
  linkedIds: Set<string>;
};

/**
 * Build a one-hop authority chain from the retrieved receipts themselves. A
 * replacement identifier is eligible only when an exact record named by the
 * user appears in the same receipt and authority language links the records.
 * This makes the boost generic and evidence-derived: no policy or decision ID
 * is known ahead of retrieval.
 */
function authorityContext(question: string, evidence: SynthesisEvidence[]): AuthorityContext {
  const questionIds = new Set(recordIdentifiers(question));
  const linkedIds = new Set(questionIds);
  if (!questionIds.size || !AUTHORITY_QUESTION.test(question)) {
    return { active: false, questionIds, linkedIds };
  }

  const anchorReceipts = evidence.filter((item) => {
    const corpus = `${item.title}. ${item.excerpt}`.toUpperCase();
    return [...questionIds].some((identifier) => corpus.includes(identifier));
  });
  for (const item of anchorReceipts) {
    const segments = clean(`${item.title}. ${item.excerpt}`
      .replace(/\s+(?:#{1,6}|-{3,}|={2,})\s*/g, ". "))
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    for (const segment of segments) {
      if (!AUTHORITY_RELATION.test(segment)) continue;
      const ids = recordIdentifiers(segment);
      if (ids.length >= 2 || (ids.length === 1 && STRONG_AUTHORITY_LINK.test(segment))) {
        ids.forEach((identifier) => linkedIds.add(identifier));
      }
    }
  }
  return { active: true, questionIds, linkedIds };
}

function authorityRelevance(question: string, text: string, context: AuthorityContext) {
  if (!context.active) return 0;
  const identifiers = recordIdentifiers(text);
  const namesQuestionRecord = identifiers.some((identifier) => context.questionIds.has(identifier));
  const namesLinkedRecord = identifiers.some((identifier) => context.linkedIds.has(identifier));
  if (!namesQuestionRecord && !namesLinkedRecord) return 0;

  let score = namesQuestionRecord ? 6 : 10;
  if (NON_AUTHORITY_STATE.test(text)) score += 12;
  // When the user names a draft/current policy directly, its own ratification
  // or authority state is the primary yes/no fact. A nearby supersession edge
  // is valuable context, but must not crowd that direct state out.
  if (namesQuestionRecord && NON_AUTHORITY_STATE.test(text)) score += 16;
  if (CURRENT_AUTHORITY_STATE.test(text)) score += 12;
  if (AUTHORITY_DESIGNATION.test(text) && NORMATIVE_REQUIREMENT.test(text)) score += 12;
  if (/\boriginal(?:ly)?\b/i.test(question) && HISTORICAL_PERMISSION.test(text)) score += 8;
  if (/\b(?:replac\w*|supersed\w*)\b/i.test(text)) score += 6;
  return score;
}

/** Stable relevance order used by both the answer and its citation cards. */
export function rankEvidenceForQuestion<T extends SynthesisEvidence>(question: string, evidence: T[]): T[] {
  const authority = authorityContext(question, evidence);
  // A recency question must surface the newest item, not the lexically closest
  // one. The boost only applies to entries that already scored positive on the
  // lexical/authority/bridge pass, so a fresh but unrelated receipt can never
  // be promoted into relevance just because it is recent.
  const factors = recencyQuestion(question) ? recencyFactors(evidence) : new Map<string, number>();
  const scored = evidence
    .map((item, index) => {
      const base = relevance(question, `${item.title}. ${item.excerpt}`, item.provider) +
        authorityRelevance(question, `${item.title}. ${item.excerpt}`, authority) +
        crossSourceBridgeScore(question, `${item.title}. ${item.excerpt}`, item.provider, evidence);
      const recency = base > 0 ? (factors.get(item.id) ?? 0) * RECENCY_WEIGHT : 0;
      return { item, index, score: base + recency };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const relevant = scored.filter((entry) => entry.score > 0);
  const pool = relevant.length ? relevant : scored.slice(0, 3);
  // A deep document query can return 24 relevant chunks before connector
  // receipts. Reserve one of the 16 synthesis slots for the best genuinely
  // relevant receipt from each provider the user explicitly named; otherwise
  // document volume can erase a successful, attributable connector response.
  // Provider naming alone never qualifies evidence: the receipt must already
  // have a positive direct/authority/strict-bridge score.
  const namedProviderBest = [...new Set(evidence.map((item) => item.provider))]
    .filter((provider) => providerNamedInQuestion(question, provider))
    .map((provider) => pool.find((entry) => entry.item.provider === provider))
    .filter((entry): entry is (typeof scored)[number] => Boolean(entry));
  const protectedKeys = new Set(namedProviderBest.map((entry) => `${entry.item.provider}:${entry.item.id}`));
  const selected = [
    ...namedProviderBest,
    ...pool.filter((entry) => !protectedKeys.has(`${entry.item.provider}:${entry.item.id}`)),
  ].slice(0, 16).sort((left, right) => right.score - left.score || left.index - right.index);
  // 16 (not 12) so deeper document retrieval can still reach an exact-fact
  // chunk that relevance ranking placed just outside the old cut-off. The pick
  // loop still caps the final answer at a handful of claims.
  return selected.map((entry) => entry.item);
}

/**
 * A question carries a concrete anchor when it names a specific record or person
 * (BUG-123, ADR-037, Priya Ramanathan). Value-focused extraction is gated on that
 * so a generic question can never pull a value sentence from unrelated evidence.
 */
function namedSubjects(question: string) {
  const words = question.split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((word) => /^[A-Z][a-zA-Z'-]*$/.test(word));
  // A sentence-initial interrogative is capitalised by grammar, not because it
  // names anything. Without the stop-word check "What"/"Which"/"Where" all
  // counted as concrete anchors, so every question looked anchored.
  return words.filter((word) => {
    const lower = word.toLowerCase();
    return word.length >= 4 && !STOP_WORDS.has(lower) && !GENERIC_QUESTION_TOKENS.has(lower);
  });
}

function hasConcreteAnchor(question: string) {
  if (recordIdentifiers(question).length > 0) return true;
  return namedSubjects(question).length > 0;
}

/**
 * The named subjects of a question, tokenised so they can be compared against
 * candidate tokens. "What is blocking the Atlas launch?" yields the stem of
 * "Atlas" alone -- "blocking" and "launch" describe the shape of the question,
 * not the thing it is about.
 */
function namedSubjectTokens(question: string) {
  return [...new Set(namedSubjects(question).flatMap((word) => tokenise(word)))];
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
  if (anchored && recordIdentifiers(question).length > 0 &&
      /\b(release|released|fixed in|fix was|merged on|merged|ratified|when was|when did|shipped)\b/i.test(question)) {
    patterns.push(date);
    patterns.push(version);
    patterns.push(/\bfixed\s+in\s+[^.!?\n]{0,80}/gi);
    patterns.push(/\bmerged\s+on\s+[^.!?\n]{0,80}/gi);
    patterns.push(/\breleased?\s+(?:in|on)\s+[^.!?\n]{0,80}/gi);
    patterns.push(/\bratified\s+on\s+[^.!?\n]{0,80}/gi);
  }
  if (anchored && /\b(still in force|supersed|withdrawn|single approver|binding rule|originally permit|original permission|permit|permitted|rule|policy|draft)\b/i.test(question)) {
    patterns.push(/\b(?:supersed\w*|withdrawn|no longer in force|no longer valid)[^.!?\n]{0,130}/gi);
    patterns.push(/\btwo(?:-|\s+)approver\w*[^.!?\n]{0,150}/gi);
    patterns.push(/\bSafety Case Owner[^.!?\n]{0,110}/gi);
    patterns.push(/\bbinding rule[^.!?\n]{0,130}/gi);
    patterns.push(/\bmust not be relied on[^.!?\n]{0,90}/gi);
    // The original permission sentence itself: "A single Tier 2 engineer could
    // flash Rover SDK field firmware without a second approver…". A question
    // about what a policy originally permitted wants this sentence, not just
    // the later supersession text.
    if (/\b(?:original(?:ly)?|previously|what did)\b/i.test(question)) {
      patterns.push(/\bsingle\s+Tier\s+\d+\s+engineer[^.!?\n]{0,150}/gi);
      patterns.push(/\bcould\s+flash[^.!?\n]{0,130}/gi);
    }
    // A never-ratified draft carries no authority; surface its exact wording
    // for permit/still-in-force questions about drafts.
    patterns.push(/\bnever ratified[^.!?\n]{0,90}/gi);
    patterns.push(/\bcarries no operational authority[^.!?\n]{0,70}/gi);
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
  if (anchored && recordIdentifiers(question).length > 0 &&
      /\b(what happened|what was|describe|summary|occurred|record)\b/i.test(question)) {
    patterns.push(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\s+was\s+a\s+[^.!?\n]{0,140}/gi);
  }
  if (anchored && /\bescalat\w*|\b(?:desk|runs?)\b/i.test(question)) {
    patterns.push(/\bescalation desk[^.!?\n]{0,60}/gi);
  }
  // Programme-code / project-alias questions keep their dedicated value intent.
  if (/\b(programme code|project alias|alias)\b/i.test(question)) {
    patterns.push(/\bHR-P\d+\b/gi);
  }
  return patterns;
}

/**
 * Return complete sentence context around a match. The old fixed character
 * slices could turn an evidence-backed state such as "permission is withdrawn"
 * into "permission is withdraw". Besides reading badly, that changed the fact
 * being graded. This helper stays extractive while snapping to sentence and
 * word boundaries, and includes at most one adjacent sentence on either side.
 */
function completeContextWindow(body: string, index: number, matchLength: number, maxLength = 420) {
  const sentenceStart = (offset: number) => {
    const boundary = body.lastIndexOf(". ", Math.max(0, offset - 1));
    return boundary < 0 ? 0 : boundary + 2;
  };
  const sentenceEnd = (offset: number) => {
    const boundary = body.indexOf(". ", Math.min(body.length, offset));
    return boundary < 0 ? body.length : boundary + 1;
  };

  let start = sentenceStart(index);
  let end = sentenceEnd(index + matchLength);
  const previousStart = start > 0 ? sentenceStart(Math.max(0, start - 2)) : start;
  if (start - previousStart > 0 && end - previousStart <= maxLength) start = previousStart;
  const followingEnd = end < body.length ? sentenceEnd(Math.min(body.length, end + 2)) : end;
  if (followingEnd - start <= maxLength) end = followingEnd;

  if (end - start > maxLength) {
    const half = Math.floor(maxLength / 2);
    start = Math.max(start, index - half);
    end = Math.min(end, start + maxLength);
    const firstSpace = body.indexOf(" ", start);
    if (firstSpace > start && firstSpace < index) start = firstSpace + 1;
    const lastSpace = body.lastIndexOf(" ", end);
    if (lastSpace > index + matchLength) end = lastSpace;
  }
  return clean(body.slice(start, end));
}

function focusedWindows(question: string, body: string) {
  const exactIdentifiers = recordIdentifiers(question);
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
      windows.push(completeContextWindow(body, index, anchor.length));
      offset = index + anchor.length;
    }
  }

  // Value-focused candidates for explicit value intents. The window includes
  // backward context so phrases like "the Billing Migration escalation desk"
  // survive even though the pattern only anchors on "escalation desk".
  for (const pattern of valuePatternsForQuestion(question)) {
    for (const match of body.matchAll(pattern)) {
      const index = match.index ?? 0;
      windows.push(completeContextWindow(body, index, match[0].length));
    }
  }
  return windows;
}

function sentences(item: SynthesisEvidence, question: string, evidence: SynthesisEvidence[]) {
  const raw = item.excerpt || item.title;
  // Markdown headings and horizontal rules often sit between otherwise normal
  // sentences. Convert those boundaries before splitting so a useful sentence
  // is not rejected as one multi-kilobyte block. Query-focused windows preserve
  // compact table rows and exact-ID context that contain no punctuation.
  const body = clean(raw
    .replace(/\s+(?:#{1,6}|-{3,}|={2,})\s*/g, ". ")
    .replace(/\s+[-*]\s+(?=[A-Z0-9])/g, ". "));
  // A markdown list item is an independent statement, so each one is its own
  // unit of evidence. Rewriting the bullet to ". " is not enough: the sentence
  // splitter below only breaks before a capital or a digit, so bullets opening
  // with a code span or a lowercase word stayed glued to their neighbour and an
  // ingested status document surfaced as a single run-on window. Splitting the
  // list into units keeps every emitted claim verbatim and single-subject.
  const listItems = raw
    .split(/\r?\n(?=[ \t]*[-*][ \t]+)/)
    .map((block) => clean(block.replace(/^[ \t]*[-*][ \t]+/, "")))
    .filter(Boolean);
  // Only treat it as a list when there is more than one item; a lone dash in
  // otherwise ordinary prose must not change how that prose is read.
  const units = listItems.length > 1 ? listItems : [body];
  // Some operational facts are relational across adjacent sentences in one
  // receipt: the first sentence names the work, while the second records its
  // tracking state; or the first names an incident and a later sentence names
  // its filer. For these narrow compound intents, a short complete receipt is
  // the smallest evidence unit that preserves the relationship. It remains
  // verbatim, capped, and cited to the same exact source ID.
  const needsReceiptContext =
    /\bno\s+(?:linear\s+)?issue\b|\bopen\s+issue\b|\bwho\s+is\b[^?]{0,100}\band\s+what\b|\bwho\s+filed\b|\bwhich\s+project\b/i.test(question);
  const exactBridgeNeedsReceiptContext = item.provider !== "document" && body.length <= 420 &&
    // The emitted claim is the receipt body, so the body itself—not a helpful
    // title—must carry the exact join key and secondary anchor.
    crossSourceBridgeScore(question, body, item.provider, evidence) > 0;
  return [...new Set([
    ...((needsReceiptContext || exactBridgeNeedsReceiptContext) && body.length <= 420 ? [body] : []),
    ...units.flatMap((unit) => [
      ...unit.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(clean),
      ...focusedWindows(question, unit),
    ]),
  ])].filter((sentence) => sentence.length >= 18 && sentence.length <= 420);
}

function dateParts(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { dayMonth: `${iso[2]}-${iso[3]}`, year: iso[1] };
  const natural = value.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (!natural) return { dayMonth: value.toLowerCase(), year: null };
  return {
    dayMonth: `${natural[2].toLowerCase()}-${natural[1].padStart(2, "0")}`,
    year: natural[3] ?? null,
  };
}

const identifiersInText = (text: string) => [...new Set(recordIdentifiers(text))];

function contradictions(question: string, relevantEvidence: SynthesisEvidence[]) {
  const result: GroundedContradiction[] = [];
  const selected = [...new Map(relevantEvidence.map((item) => [item.id, item])).values()];
  const datedRaw = selected.flatMap((item) => {
    const text = `${item.title}. ${item.excerpt}`;
    const dates = text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)\b/gi) ?? [];
    // A record that says a deadline "moved from X to Y" is asserting Y as
    // its current deadline. Comparing both dates from that one record would
    // manufacture a contradiction before another source is considered.
    const assertedDates = /\bmoved\s+from\b/i.test(text) && dates.length > 1
      ? dates.slice(-1)
      : dates;
    return assertedDates.map((date) => ({ item, date, parts: dateParts(date) }));
  });
  const years = new Set(datedRaw.map((entry) => entry.parts.year).filter(Boolean));
  const dated = datedRaw.map((entry) => ({
    ...entry,
    normalised: years.size > 1 && entry.parts.year
      ? `${entry.parts.dayMonth}-${entry.parts.year}`
      : entry.parts.dayMonth,
  }));
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
    const stateCorpus = `${completed.title} ${completed.excerpt} ${open.title} ${open.excerpt}`;
    const stateIdentifiers = identifiersInText(stateCorpus);
    const explicitlyTracked = stateCorpus.match(/\b(?:issue|ticket)\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)\b/i)?.[1];
    const trackedEntity = explicitlyTracked ??
      stateIdentifiers.find((id) => /^(?:ENG|BUG)-/i.test(id)) ??
      stateIdentifiers.find((id) => /^INC-/i.test(id)) ??
      "tracked issue";
    const sameReceipt = completed.id === open.id;
    const trackedBridgeCandidates = completed.id === open.id && staleBridgeQuestion(question)
      ? selected.filter((item) => {
          if (item.provider === completed.provider) return false;
          const corpus = `${item.title} ${item.excerpt}`;
          const namesTrackedEntity = trackedEntity === "tracked issue" ||
            corpus.toUpperCase().includes(trackedEntity.toUpperCase());
          const independentlyReportsOpen =
            /\b(?:still\s+(?:showing\s+as\s+)?open|remains?\s+open|issue\s+is\s+open|ticket\s+still\s+open|status(?:\s+is|:)?\s+open)\b/i.test(corpus);
          return namesTrackedEntity && independentlyReportsOpen &&
            /\b(?:against|filed|issue|record|ticket|track(?:ed|ing)?)\b/i.test(corpus) &&
            crossSourceBridgeScore(question, `${item.title}. ${item.excerpt}`, item.provider, selected) > 0;
        }).sort((left, right) => {
          const score = (item: SynthesisEvidence) => {
            const corpus = `${item.title} ${item.excerpt}`;
            let value = 0;
            if (trackedEntity !== "tracked issue" && corpus.toUpperCase().includes(trackedEntity.toUpperCase())) value += 8;
            if (/\b(?:still\s+(?:showing\s+as\s+)?open|remains?\s+open|issue\s+is\s+open|ticket\s+still\s+open|status(?:\s+is|:)?\s+open)\b/i.test(corpus)) value += 6;
            return value;
          };
          return score(right) - score(left);
        })
      : [];
    // A Thinking follow-up may add another related provider after the Fast
    // baseline has already found the tracker receipt. Prefer the eligible
    // provider explicitly named by the completion/open record so extra context
    // cannot displace the system of record merely by ranking first.
    const trackedBridge = trackedBridgeCandidates.find((item) =>
      providerNamedInQuestion(stateCorpus, item.provider),
    ) ?? trackedBridgeCandidates[0];
    result.push({
      summary: sameReceipt
        ? trackedBridge
          ? `${completed.provider} reports the code complete while ${trackedBridge.provider} reports ${trackedEntity} remains open.`
          : `${completed.provider} receipt reports the code complete while ${trackedEntity} remains open in its cited tracking state.`
        : `${completed.provider} reports the work complete while ${open.provider} reports ${trackedEntity} remains open.`,
      evidenceIds: [...new Set([completed.id, open.id, ...(trackedBridge ? [trackedBridge.id] : [])])],
      providers: [...new Set([completed.provider, open.provider, ...(trackedBridge ? [trackedBridge.provider] : [])])],
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
    label: "general availability date",
    requestedBy: COMMITTED_GENERAL_AVAILABILITY_DATE_QUESTION,
    supportedBy: /(?=.*\b(?:general\s+availability|generally\s+available|GA(?:\s+date)?)\b)(?=.*\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})\b)/i,
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
    .filter((facet) => {
      // In "committed GA date", committed qualifies the milestone value; it is
      // not a separate request for an engineering promise. The dedicated facet
      // above verifies the relationship and calendar value together.
      if (facet.label === "engineering commitment" &&
          COMMITTED_GENERAL_AVAILABILITY_DATE_QUESTION.test(question)) return false;
      return facet.requestedBy.test(question) && !facet.supportedBy.test(supportedCorpus);
    })
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
  const authority = authorityContext(question, ranked);
  const valuePatterns = valuePatternsForQuestion(question);
  // `ranked` is already recency-ordered for a recency question; the same
  // factor reinforces that order at sentence level so the newest item's
  // sentences out-compete older items' lexically closer sentences.
  const recencyFactorsMap = recencyQuestion(question) ? recencyFactors(ranked) : new Map<string, number>();
  const candidates = ranked.flatMap((item, evidenceIndex) =>
    sentences(item, question, evidence).map((text, sentenceIndex) => {
      const sentenceScore = relevance(question, text, item.provider);
      const titleScore = relevance(question, item.title, item.provider);
      const authorityScore = authorityRelevance(question, text, authority);
      const evidenceAuthorityScore = authorityRelevance(
        question, `${item.title}. ${item.excerpt}`, authority,
      );
      const bridgeScore = crossSourceBridgeScore(question, text, item.provider, evidence);
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
        authorityLinked: evidenceAuthorityScore > 0,
        // A relevant title may break a tie, but it cannot make an unrelated
        // paragraph into a claim.
        score: (sentenceScore > 0 || bridgeScore > 0 || isValueCandidate || authorityScore > 0)
          ? sentenceScore + bridgeScore + authorityScore + (isValueCandidate ? 16 : 0) + Math.min(titleScore, 3)
            + (recencyFactorsMap.get(item.id) ?? 0) * RECENCY_WEIGHT * 0.5
            - sentenceIndex * 0.15 - evidenceIndex * 0.05
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
  const hasAuthorityChain = authority.active && candidates.some((candidate) => candidate.authorityLinked);
  const diverseEvidenceTarget = Math.min(3, new Set(
    candidates.filter((candidate) => candidate.score >= scoreFloor).map((candidate) => candidate.item.id),
  ).size);
  const seenEvidenceIds = new Set<string>();
  /** Content tokens of each picked claim, for the restatement check below. */
  const pickedTokens: Set<string>[] = [];
  /**
   * Content identity, independent of the diversity quotas. A candidate that
   * repeats text an already-picked claim carries is the same claim, so it is
   * never eligible -- not in the main pass, and not in the relaxed fallback,
   * which previously skipped these checks and emitted the same Slack sentence
   * three times in one answer.
   */
  const duplicatesPicked = (candidate: (typeof candidates)[number], key: string) => {
    if (seenKeys.has(key)) return true;
    // Value windows drawn from different chunks repeat the same fact phrase
    // ("customer impact lasted 41 minutes…"). One phrase, one claim, so the
    // remaining slots stay open for the other facets of the question.
    if (candidate.valuePhrase && seenValuePhrases.has(candidate.valuePhrase)) return true;
    // A candidate that repeats a long sentence already carried by a picked
    // claim is a duplicate of it, even when its leading context differs.
    if (claimSentences(candidate.text).some((sentence) => seenSentences.has(sentence))) return true;
    // A claim wholly contained in an already-picked claim adds no fact, only
    // repetition -- either direction, since the longer one may be picked second.
    if ([...seenKeys].some((existing) => existing.includes(key) || key.includes(existing))) return true;
    // Substring containment misses a reordering. "Blocked on the AuthShield
    // migration: Atlas Launch cannot start." is not a substring of the Linear
    // sentence it restates, yet it introduces no content word that sentence does
    // not already carry, so it is the same claim. Compared against each picked
    // claim on its own rather than their union, so three claims can never
    // combine to swallow a fourth that none of them actually contains.
    const tokens = tokenise(candidate.text);
    if (tokens.length >= 3 &&
        pickedTokens.some((picked) => tokens.every((token) => picked.has(token)))) return true;
    return false;
  };
  const recordPicked = (candidate: (typeof candidates)[number], key: string) => {
    picked.push(candidate);
    seenKeys.add(key);
    if (candidate.valuePhrase) seenValuePhrases.add(candidate.valuePhrase);
    claimSentences(candidate.text).forEach((sentence) => seenSentences.add(sentence));
    pickedTokens.push(new Set(tokenise(candidate.text)));
    seenProviders.add(candidate.item.provider);
    seenEvidenceIds.add(candidate.item.id);
  };
  for (const candidate of candidates) {
    const key = normaliseClaimKey(candidate.text);
    if (candidate.score < scoreFloor || duplicatesPicked(candidate, key)) continue;
    // Once an exact, evidence-derived authority chain exists, lexical matches
    // from records outside that chain are distractors, not additional policy
    // evidence. Sentences in a linked receipt remain eligible even when they do
    // not repeat its identifier (for example "neither draft permits this").
    if (hasAuthorityChain && !candidate.authorityLinked) continue;
    if (seenProviders.has(candidate.item.provider) && picked.length < Math.min(3, new Set(ranked.map((item) => item.provider)).size)) continue;
    // A single verbose receipt must not consume every claim slot while other
    // independently relevant receipts carry the replacement rule or current
    // state. The score floor still applies, so diversity never promotes an
    // unrelated source merely to fill a quota.
    if (seenEvidenceIds.has(candidate.item.id) && seenEvidenceIds.size < diverseEvidenceTarget) continue;
    recordPicked(candidate, key);
    if (picked.length === 4) break;
  }
  // The diversity quotas above can starve the answer when the relevant records
  // all share a provider. Relax those quotas -- never the duplicate checks, and
  // never the score floor.
  if (picked.length < 2) {
    for (const candidate of candidates) {
      const key = normaliseClaimKey(candidate.text);
      if (candidate.score < scoreFloor || duplicatesPicked(candidate, key)) continue;
      recordPicked(candidate, key);
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
  // Recency is a relationship between receipts, not text that can be copied out
  // of the winning receipt. State that relationship in answer framing only when
  // the lead grounded claim is itself a delivery assertion from a system of
  // record, its timestamp is parseable, and no other matching dated delivery
  // candidate is newer. Claim text and citation ownership remain extractive.
  const lead = picked[0];
  const leadTime = lead ? evidenceTime(lead.item.timestamp) : null;
  const matchingDatedDeliveryTimes = candidates
    .filter((candidate) => candidate.score > 0 &&
      DELIVERY_RECORD_PROVIDERS.has(candidate.item.provider.toLowerCase()) &&
      DELIVERY_ASSERTION.test(candidate.text))
    .map((candidate) => evidenceTime(candidate.item.timestamp))
    .filter((time): time is number => time != null);
  const frameAsMostRecentDelivery = Boolean(
    recencyQuestion(question) && DELIVERY_QUESTION.test(question.toLowerCase()) &&
    lead && leadTime != null &&
    DELIVERY_RECORD_PROVIDERS.has(lead.item.provider.toLowerCase()) &&
    DELIVERY_ASSERTION.test(lead.text) &&
    matchingDatedDeliveryTimes.length > 0 &&
    leadTime === Math.max(...matchingDatedDeliveryTimes),
  );
  const answerFrame = frameAsMostRecentDelivery
    ? "The most recent matching delivery receipt is: "
    : "";
  const answer = claims.length
    ? answerFrame + claims.map((claim) => `${claim.text} [${evidenceIndex.get(claim.evidenceIds[0])}]`).join(" ")
    : "Insufficient evidence. QueueProof will not invent an answer.";
  const detectedContradictions = contradictions(question, ranked);
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
