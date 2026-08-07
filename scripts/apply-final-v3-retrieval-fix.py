from pathlib import Path

path = Path("lib/server/synthesis.ts")
text = path.read_text()

promise_anchor = '  if (/\\bpromise\\b/.test(q) && !/\\b(promise|promised|commit|committed)\\b/.test(candidate)) return 0;'
if "const missingTrackerQuestion =" not in text:
    if promise_anchor not in text:
        raise SystemExit("missing-tracker anchor not found")
    promise_patch = promise_anchor + r'''
  // Missing-tracker questions ask for negative evidence, not merely a nearby
  // promise or issue. The retained evidence unit must itself assert absence.
  const missingTrackerQuestion =
    /\b(?:no|without|missing|lacks?)\b[^?]{0,70}\b(?:issue|ticket|track(?:ed|ing)?)\b/.test(q) ||
    /\b(?:issue|ticket)\b[^?]{0,50}\b(?:missing|absent|not tracked)\b/.test(q);
  const missingTrackerAssertion =
    /\b(?:no (?:linear )?(?:issue|ticket)|not tracked(?: in [a-z0-9_-]+)?|without (?:an? )?(?:issue|ticket)|lacks? (?:an? )?(?:issue|ticket))\b/.test(candidate);
  if (missingTrackerQuestion && !missingTrackerAssertion) return 0;'''
    text = text.replace(promise_anchor, promise_patch, 1)

start_marker = "    const trackedBridgeCandidates = completed.id === open.id && staleBridgeQuestion(question)\n"
end_marker = "    // A Thinking follow-up may add another related provider after the Fast\n"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("tracked-bridge bounds not found")
bridge_patch = r'''    const trackedBridgeCandidates = completed.id === open.id && staleBridgeQuestion(question)
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
'''
text = text[:start] + bridge_patch + text[end:]

old_summary = '          ? `${completed.provider} reports the code complete while ${trackedEntity} remains open; ${trackedBridge.provider} independently records the linked incident and tracked work.`'
new_summary = '          ? `${completed.provider} reports the code complete while ${trackedBridge.provider} reports ${trackedEntity} remains open.`'
if old_summary in text:
    text = text.replace(old_summary, new_summary, 1)
elif new_summary not in text:
    raise SystemExit("contradiction summary anchor not found")

path.write_text(text)
