# HydraDB hackathon form answers

Use these answers only after `/api/health/live` and `/api/lab` identify the same deployed
release. Copy benchmark values from **Proof tests** at submission time; this file intentionally
does not freeze them.

## Did you try ingesting huge PDFs?

**Yes.** QueueProof generated and ingested a deterministic 346-page Helios operations
handbook. The product retains its file checksum, QueueProof document ID, HydraDB source ID,
page count, size, ingestion state, and retrieval history.

The labelled suite spans 22 questions and 56 required-fact groups across the beginning,
middle, and end. It includes exact IDs, tables, superseded policy, close-name entities,
multilingual context, distractors, and a separate document-plus-connectors question. Paste the
current release's strict pass count, fact recall, citations, canaries, latency, calls, and units
from the deployed **Proof tests** page. Keep every `REVIEW` visible.

## Did you use at least three connectors?

**Yes, subject to the live proof shown at submission time.** The public workspace exposes
GitHub, Gmail, Linear, and Slack connector receipts. A provider counts only when its current
Sources card is ready and shows attributable records; a saved credential or degraded duplicate
does not count. The flagship question joins cited GitHub, Linear, and Slack evidence.

## One-line project description

QueueProof is a daily evidence workspace that turns scattered work into one cited answer,
preserves disagreement, and prepares the next safe action.

## What can a user do?

- Ask one work question across connected tools and documents.
- Open any supported claim to its provider, timestamp, excerpt, receipt ID, and original link.
- See conflicts and missing evidence instead of a confident guess.
- Review an evidence-backed priority queue and task brief.
- Reuse the same read contract from an MCP client through **Connect AI**.
- Keep credentials, proposals, approvals, and external writes behind the owner boundary.

## What is technically difficult?

The flagship investigation combines identity matching, timeline ordering, changed-state
detection, cross-provider disagreement, exact-ID retrieval, citation validation, and a bounded
evidence-derived follow-up. QueueProof records the selected route, HydraDB calls, retained
receipts, latency, and relative cost, and abstains when required evidence is absent.

## Latency, accuracy, calls, cost, and mode

Paste the current values shown on <https://queueproof.vercel.app/benchmarks> only when:

- `/api/health/live` names the production commit;
- `/api/lab` reports the same SHA in `results.currentRelease.commitSha`;
- the relevant result says `measured`; and
- Fast/Thinking `modeComparison.comparable` is `true` before quoting deltas.

Report strict cases and required-fact recall separately. The live suite is a release diagnostic,
not an SLA. Weighted query units are relative retrieval work, not dollars.

## Verification completed

For the exact submitted commit, report the current CI receipt for typecheck, lint, full tests,
router benchmark, production build, end-to-end acceptance, deployment bindings, and production
identity. Do not copy test totals from an earlier release.

## Video demo

**PENDING.** Record the canonical deployment with
[`docs/DEMO_SCRIPT_60S.md`](DEMO_SCRIPT_60S.md), upload it publicly, then paste the URL here.

## GitHub submission

<https://github.com/vaibhav4046/queueproof>

**PUBLICATION PENDING.** Make the repository public and verify the URL in a signed-out browser
before submitting it as a public repository.

## Judge testing instructions

1. Open <https://queueproof.vercel.app/>.
2. Ask: “Who escalated the AuthShield outage, what did engineering commit to, and is the fix
   already merged?”
3. Inspect provider coverage, preserved disagreement, selected mode, calls, and latency.
4. Open a numbered citation and follow its original-source link.
5. Open **Sources** to inspect connector readiness and document provenance.
6. Open **Proof tests** to inspect same-release Fast/Thinking results, strict denominators,
   the large-PDF run, and visible `REVIEW` rows.
7. Open **Connect AI** to inspect the bounded MCP setup.
8. Match the health SHA to the current-release SHA in `/api/lab`.

## LinkedIn and X/Twitter

Use [`SOCIAL_POSTS.md`](SOCIAL_POSTS.md) only after repository access and the public video are
complete. Copy exact benchmark values from the deployed release and retain every limitation.
