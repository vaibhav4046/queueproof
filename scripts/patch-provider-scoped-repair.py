from pathlib import Path

# 1) Add a provider-aware second-hop query builder.
retrieval = Path("packages/retrieval/src/index.ts")
text = retrieval.read_text()
anchor = '''export function focusedEvidenceFollowUpQuery(question: string, passages: string[]): string | null {
'''
if anchor not in text:
    raise SystemExit("focused follow-up function anchor not found")
insert_after = '''  return selected.length ? selected.join(" ") : null;
}
'''
helper = r'''

/**
 * Provider-scoped Fast repair should lead with the join keys explicitly tied to
 * the connector being queried. A first-hop receipt can mention several IDs from
 * different systems (for example an incident, a PR and a Linear issue). Sending
 * all of them into a single Linear repair lets the incident ID outrank the actual
 * tracker ID. This helper keeps only IDs found in sentences that name the target
 * provider, then adds the bounded state language already derived from the user
 * question. If no provider-linked identifier is proven, it falls back to the
 * generic evidence-derived follow-up rather than inventing one.
 */
export function focusedProviderEvidenceFollowUpQuery(
  question: string,
  passages: string[],
  targetProvider: string,
): string | null {
  const providerKey = targetProvider.toLowerCase();
  const providerLabel = providerKey.replace(/[_-]+/g, " ");
  const aliases = [providerLabel, ...(PROVIDER_ALIASES[providerKey] ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const providerPattern = new RegExp(
    `(^|[^a-z0-9])(?:${aliases.map(escapeRegExp).join("|")})([^a-z0-9]|$)`,
    "i",
  );
  const linkedIds: string[] = [];
  const linkedPassages: string[] = [];

  for (const passage of passages.slice(0, 16)) {
    const units = passage.split(/(?<=[.!?])\s+|\n+/).map((unit) => unit.trim()).filter(Boolean);
    for (const unit of units) {
      if (!providerPattern.test(unit)) continue;
      linkedPassages.push(unit);
      linkedIds.push(...recordIdentifiers(unit));
    }
  }

  const exactIds = [...new Set(linkedIds)];
  if (!exactIds.length) return focusedEvidenceFollowUpQuery(question, passages);
  const intentTerms = retrievalIntentTerms(question);
  const terms = [
    ...exactIds,
    ...intentTerms,
    ...(intentTerms.length ? [] : evidenceFollowUpTerms(question, linkedPassages).slice(0, 4)),
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
'''
if "export function focusedProviderEvidenceFollowUpQuery(" not in text:
    pos = text.find(insert_after, text.find(anchor))
    if pos < 0:
        raise SystemExit("focused follow-up return anchor not found")
    pos += len(insert_after)
    text = text[:pos] + helper + text[pos:]
retrieval.write_text(text)

# 2) Use the provider-aware query inside the bounded connector repair loop.
route = Path("app/api/ask/route.ts")
r = route.read_text()
import_anchor = '''  focusedEvidenceFollowUpQuery,
'''
if "  focusedProviderEvidenceFollowUpQuery,\n" not in r:
    if import_anchor not in r:
        raise SystemExit("ask-route import anchor not found")
    r = r.replace(import_anchor, import_anchor + "  focusedProviderEvidenceFollowUpQuery,\n", 1)
call_anchor = '''          await runQueryBatch(repairQuery, ["hybrid"], "follow_up", "fast", providerScopes);
'''
call_replacement = '''          const providerRepairQuery = focusedProviderEvidenceFollowUpQuery(
            question,
            preliminary.evidence.map((item) => `${item.title}. ${item.excerpt}`),
            targetProvider,
          ) ?? repairQuery;
          await runQueryBatch(providerRepairQuery, ["hybrid"], "follow_up", "fast", providerScopes);
'''
if call_replacement not in r:
    if call_anchor not in r:
        raise SystemExit("coverage-repair call anchor not found")
    r = r.replace(call_anchor, call_replacement, 1)
route.write_text(r)

# 3) Lock the provider-specific join-key behavior in retrieval tests.
test = Path("tests/retrieval.test.ts")
t = test.read_text()
import_test_anchor = '''  focusedEvidenceFollowUpQuery,
'''
if "  focusedProviderEvidenceFollowUpQuery,\n" not in t:
    if import_test_anchor not in t:
        raise SystemExit("retrieval-test import anchor not found")
    t = t.replace(import_test_anchor, import_test_anchor + "  focusedProviderEvidenceFollowUpQuery,\n", 1)
marker = '''  it("retains an identifier from the question while adding cross-source entities", () => {
'''
new_tests = r'''  it("targets only the identifier explicitly tied to the missing provider", () => {
    const passages = [
      "AuthShield fix merged in GitHub PR-8871 for incident INC-2031. Linear issue ENG-456 is still showing as open even though the code shipped.",
    ];
    expect(focusedProviderEvidenceFollowUpQuery(
      "Which open issue appears to be already resolved elsewhere?",
      passages,
      "linear",
    )).toBe("ENG-456 merged shipped still open tracked state");
    expect(focusedProviderEvidenceFollowUpQuery(
      "Which open issue appears to be already resolved elsewhere?",
      passages,
      "linear",
    )).not.toMatch(/INC-2031|PR-8871/);
  });

  it("falls back safely when evidence proves no provider-linked identifier", () => {
    expect(focusedProviderEvidenceFollowUpQuery(
      "Which open issue appears to be already resolved elsewhere?",
      ["AuthShield shipped in GitHub. The tracked record is ENG-456."],
      "linear",
    )).toBe("ENG-456 AuthShield merged shipped still open tracked state");
  });

'''
if "targets only the identifier explicitly tied to the missing provider" not in t:
    if marker not in t:
        raise SystemExit("retrieval-test insertion marker not found")
    t = t.replace(marker, new_tests + marker, 1)
test.write_text(t)
