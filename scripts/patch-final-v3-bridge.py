from pathlib import Path

syn = Path("lib/server/synthesis.ts")
text = syn.read_text()

bridge_anchor = '''const bridgeTokens = (value: string) => new Set(
'''
open_constant = r'''const TRACKER_OPEN_ASSERTION =
  /\b(?:still\s+(?:showing\s+as\s+)?open|remains?\s+open|issue\s+is\s+open|ticket\s+still\s+open|status(?:\s+is|:)?\s+open)\b/i;

'''
if "const TRACKER_OPEN_ASSERTION =" not in text:
    if bridge_anchor not in text:
        raise SystemExit("bridge token anchor not found")
    text = text.replace(bridge_anchor, open_constant + bridge_anchor, 1)

candidate_anchor = '''  const candidateCorpus = clean(candidateText);
  const relationRequired = staleState ||'''
if "staleState && !TRACKER_OPEN_ASSERTION.test(candidateCorpus)" not in text:
    if candidate_anchor not in text:
        raise SystemExit("cross-source candidate anchor not found")
    text = text.replace(
        candidate_anchor,
        '''  const candidateCorpus = clean(candidateText);
  // A stale-state bridge is independent proof only when the second receipt
  // itself reports the tracker as open. Shared incident/project context is not
  // enough to manufacture a cross-provider contradiction.
  if (staleState && !TRACKER_OPEN_ASSERTION.test(candidateCorpus)) return 0;
  const relationRequired = staleState ||''',
        1,
    )

inline_open = r'''                const independentlyReportsOpen =
                  /\b(?:still\s+(?:showing\s+as\s+)?open|remains?\s+open|issue\s+is\s+open|ticket\s+still\s+open|status(?:\s+is|:)?\s+open)\b/i.test(corpus);'''
if inline_open in text:
    text = text.replace(
        inline_open,
        '''                const independentlyReportsOpen = TRACKER_OPEN_ASSERTION.test(corpus);''',
        1,
    )
# The ranking sort uses the same state test; keep one source of truth.
inline_sort = r'''                    if (/\b(?:still\s+(?:showing\s+as\s+)?open|remains?\s+open|issue\s+is\s+open|ticket\s+still\s+open|status(?:\s+is|:)?\s+open)\b/i.test(corpus)) value += 6;'''
if inline_sort in text:
    text = text.replace(
        inline_sort,
        '''                    if (TRACKER_OPEN_ASSERTION.test(corpus)) value += 6;''',
        1,
    )
syn.write_text(text)

test = Path("tests/synthesis.test.ts")
t = test.read_text()
old_test = '''  it("joins a stale-state receipt to the independently tracked provider context", () => {
    const result = synthesiseGroundedAnswer(
      "Which open issue appears to be already resolved elsewhere?",
      [evidence[2], evidence[0]],
    );

    expect(result.validation.providerCoverage).toEqual(expect.arrayContaining(["github", "linear"]));
    expect(result.contradictions).toEqual([
      expect.objectContaining({
        providers: expect.arrayContaining(["github", "linear"]),
        evidenceIds: expect.arrayContaining(["github-1", "linear-1"]),
      }),
    ]);
  });'''
new_test = '''  it("does not treat related tracker-provider context as independent open-state proof", () => {
    const result = synthesiseGroundedAnswer(
      "Which open issue appears to be already resolved elsewhere?",
      [evidence[2], evidence[0]],
    );

    expect(result.validation.providerCoverage).toEqual(["github"]);
    expect(result.contradictions).toEqual([
      expect.objectContaining({
        providers: ["github"],
        evidenceIds: ["github-1"],
      }),
    ]);
  });'''
if old_test not in t and new_test not in t:
    raise SystemExit("legacy stale-provider test anchor not found")
t = t.replace(old_test, new_test, 1)

old_fixture = '''        {
          id: "linear-incident",
          provider: "linear",
          title: "Authentication outage for Northwind",
          excerpt:
            "INC-2031: Northwind reported an authentication outage. Priya Raman filed this against Atlas Launch.",
          timestamp: "2026-08-02T01:03:55Z",
        },'''
new_fixture = '''        {
          id: "linear-incident",
          provider: "linear",
          title: "ENG-456 AuthShield tracker remains open",
          excerpt:
            "Linear issue ENG-456 remains open for the AuthShield work linked to INC-2031 and Northwind.",
          timestamp: "2026-08-02T01:03:55Z",
        },'''
if old_fixture not in t and new_fixture not in t:
    raise SystemExit("positive stale-provider fixture anchor not found")
t = t.replace(old_fixture, new_fixture, 1)
test.write_text(t)
