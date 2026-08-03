# QueueProof — Nemotron master build handoff

> **Historical input only.** This file preserves the original 3 August 2026 handoff for
> provenance. It is not the current release plan, benchmark contract, or source of truth.
> In particular, its instruction to rerun production benchmarks and its 21/22 or 22/22
> language predate `grounded-grader-v2`. Use `README.md`, `docs/EVALUATION_METHODOLOGY.md`,
> and `docs/LARGE_PDF_PROOF.md` for the current verified state.

Copy everything inside the prompt block into the next coding agent. Give it access to the existing repository and production environment. Do not ask it to recreate QueueProof in a new project.

---

## MASTER PROMPT

You are taking over QueueProof as its principal engineer, retrieval engineer, product designer, security owner, QA lead, release manager, and hackathon submission editor. Work autonomously inside the existing repository. You may create and coordinate specialized subagents, but you own integration, verification, and the final production release.

This is an execution task, not a brainstorming task. Inspect, implement, test, deploy, measure, and document. Continue until every achievable acceptance gate below passes. Only stop for an external authorization or credential that cannot be obtained from the existing environment.

### Repository and production target

- Local repository: `D:\Codex d;\queueproof`
- Canonical production URL: `https://queueproof.vercel.app`
- Vercel project: the already linked QueueProof project; do not create a replacement or change ownership.
- Branch: inspect first; it was `main` at handoff.
- Latest local commit at handoff: `4bf8017 fix: resolve exact document requirements`
- Important: deployment of `4bf8017` was interrupted by a context switch. Verify whether it reached production. If not, deploy it, then rerun the unchanged PDF benchmark.
- Preserve all existing verified behavior and user changes. Begin with `git status --short`, `git log -8 --oneline`, and the applicable `AGENTS.md` files.
- One generated benchmark artifact was untracked at handoff: `evals/results/pdf-live-run.json`. Inspect and intentionally include or ignore it; never delete evidence blindly.

### Hackathon context

QueueProof is being submitted to the HydraDB x Connectors Hackathon. The published deadline is 7 August 2026 at 18:00 Pacific / 8 August 2026 at 02:00 Europe/London.

The challenge requires:

1. At least three real HydraDB connectors.
2. Document ingestion.
3. Difficult cross-source retrieval: temporal reasoning, metadata filtering, entity deduplication, updates, attribution, actor queries, thread understanding, multilingual retrieval, and especially multi-hop questions.
4. An accuracy-versus-latency strategy using fast mode for simple cases and thinking mode only when needed.
5. Measured accuracy, latency, HydraDB call count, fast/thinking distribution, and estimated retrieval cost.
6. Expected-versus-actual answers, reproducible instructions, and a polished 60-second demo.

Judges score correctness, cross-source reasoning, latency, cost, reproducibility, and developer experience. Visual polish supports the story but cannot substitute for real connector and retrieval proof.

### Product thesis

QueueProof is the evidence-backed control plane for autonomous work:

> Across email, conversations, tickets, code, and documents, what should happen next—and what evidence proves it?

The primary product loop is:

1. Connect real sources through HydraDB.
2. Ingest documents and preserve their indexing receipts.
3. Ask a difficult cross-source question.
4. Route it transparently to fast or thinking mode.
5. Retrieve attributable evidence.
6. Link entities and preserve disagreements.
7. Return only cited claims.
8. Compile the evidence into a deterministic priority queue.
9. Convert a priority item into a proposed provider write.
10. Require explicit human approval before external execution.

This must remain a real working product, never a cinematic landing-page mockup.

### Non-negotiable truth rules

- Never fake connector state, source records, sync status, query results, citations, benchmarks, latency, cost, PDF scale, provider count, or passing tests.
- Distinguish actual connector-synced data, manually ingested data, synthetic benchmark fixtures, and unavailable providers.
- A record manually labelled “Slack” is not proof of a Slack connector.
- Every factual sentence shown as an answer must map to one or more evidence IDs.
- Preserve contradictions. Never silently select a convenient source.
- If evidence is inadequate, abstain with “insufficient evidence.”
- Never hardcode benchmark outcomes into the UI. Render versioned result artifacts.
- Never reduce benchmark thresholds to make a test pass.
- Never expose credentials in client code, API responses, logs, fixtures, screenshots, generated artifacts, Vercel output, or Git history.
- Do not reuse any Attio token pasted in prior chat. It is considered compromised.
- Do not copy Sarvam, Apple, Perplexity, Linear, Stripe, Vercel, or Hermes. Extract craft principles only and produce an original QueueProof identity.
- Do not declare “perfect,” “10/10,” “production-ready,” or “winner” without independently reproducible evidence.

### Verified handoff state

Remeasure all of this; do not hardcode it.

#### Real HydraDB evidence

Four connectors have reached verified production evidence states:

- GitHub: at least 1 attributable canary result.
- Linear: at least 5 attributable records.
- Slack: at least 3 attributable records.
- Gmail: at least 4 attributable records.

The exact production receipts must be re-read from the application/database and exposed without secrets. Do not rely solely on this prose.

#### Large document proof

- Fixture: `work/helios-operations-handbook.pdf`
- Label: synthetic evaluation fixture; never imply it is a third-party private handbook.
- Pages: 346
- Bytes: 958,096
- SHA-256: `c047a3d09c45ecf97e3ed8e2115eda08ea0f6152206237955030f4304fa2ed93`
- QueueProof document ID: `doc_44fe0aac-ea45-481f-91bf-66b5ba7b4fe9`
- HydraDB source ID: `f64d374d1899f3057707528f77703f3f`
- HydraDB database: `queueproof-live`
- Indexing state observed: terminal `indexed`
- Index timestamp observed: `2026-08-03T08:31:03.028Z`
- Observed processing duration: 5,716,028 ms; display this readably and explain the outlier instead of hiding it.

#### PDF benchmark

The unchanged production PDF grader reached 21/22 exact required-fact cases, with beginning, middle, and end retrieval passing. The sole miss was the alias table fact `Rover SDK → HR-P4`; HydraDB returned the value, but synthesis selected neighboring prose. Commit `4bf8017` adds value-aware extraction and regression tests. A multilingual cross-source query also needed the English requirement “fifteen minutes”; the same commit adds a targeted intent rule and regression test.

Immediate first release gate:

1. Confirm `4bf8017` is deployed.
2. Run `npm run benchmark:pdf` against canonical production.
3. Require 22/22 exact facts and a PASS on the document-plus-connectors query.
4. If either fails, inspect evidence and fix retrieval/synthesis. Do not weaken the expected tokens or provider-count requirement.

Earlier regression milestones that must be preserved:

- `e84fe38`: preserve every returned document chunk instead of only the first matching chunk.
- `84dd0f6`: workspace-verified document source scoping with optional connector inclusion.
- `dd2cf81`: extract exact facts from long Markdown and tabular chunks.
- `e33e76b`: retain enough evidence context and improve exact-fact intent ranking.
- `4bf8017`: resolve the remaining alias/value and English-requirement selection errors.

#### Existing implementation

- Next.js-compatible Vinext application, React 19, TypeScript, Tailwind CSS, Framer Motion.
- HydraDB SDK 2.1.2.
- Durable Turso/libSQL production storage.
- Proof, Queue, Evidence, Benchmarks, Approvals, Developer/MCP product areas.
- Evidence-constrained synthesis, retrieval receipts, contradiction detection, deterministic ranking, proposal/approval boundary, signed expiring MCP tokens, and production deployment checks.
- Real vendor and interface icon packages are installed (`react-icons`, `lucide-react`). Use locally bundled SVG output; do not hotlink icons.

### Known defects and attack list

Treat these as hypotheses to verify, then fix verified failures.

#### Retrieval and evaluation

1. The six-question live benchmark historically passed permissive substring checks and could overstate semantic correctness. Replace it with required fact sets, required providers, citation checks, unsupported-claim detection, and contradiction requirements.
2. Relabel UI metrics as “required-signal checks” unless a stronger accuracy computation exists. Do not call six substring cases universal correctness.
3. The flagship answer must prove all requested semantics, not merely contain one matching token.
4. Keep failed cases visible with expected facts, actual facts, missing facts, cited sources, mode, call count, latency, and cost units.
5. Improve the router to at least 90% on the fixed labelled set without tuning the labels after the fact.

#### Queue correctness

1. Provider lineage can be assigned too loosely by provider name or first connector. Preserve exact `hydradb_connector_id` and verify that each source belongs to that connector.
2. Duplicate queue items need conflict-aware entity clustering:
   - union records that share overlapping exact IDs;
   - attach an ID-less entity record only when the mapping is unambiguous;
   - never merge disjoint exact-ID sets using entity name alone;
   - retain per-source lineage after merging.
3. The Queue may duplicate AuthShield or billing decisions. Remove only proven duplicates; preserve genuinely separate actions.
4. Every priority item needs deterministic score components, why-now, owner/date or explicit missing state, confidence, contradictions, related duplicates, provider coverage, recommended next safe action, and approval requirement.

#### Security and public access

The desired experience is public and requires no access-token sign-in. Implement this as a clearly disclosed public sandbox, not an unguarded production admin panel.

- Issue an anonymous, signed, httpOnly session automatically.
- Show `Public sandbox · shared writes` prominently.
- Add rate limits, upload size/type/signature checks, token minting caps, proposal caps, abuse-safe errors, and server-side ownership boundaries.
- Keep provider credentials encrypted and server-only.
- Keep external provider writes behind explicit approval.
- Do not let public users retrieve raw provider credentials or another workspace’s private content.
- Run a secret scanner across worktree and reachable Git history before changing repository visibility.
- The GitHub repository was reported private at handoff. Do not make it public until the secret scan is clean and submission docs contain no sensitive receipts.

#### Product and UI

1. At short desktop heights the working console can fall below the fold. Make the product action visible immediately or scroll/focus the result stage when a query runs.
2. Evidence can show stale/failed debris, temporary files, duplicate rows, and an ugly raw duration. Filter non-product artifacts, self-heal stale terminal document states, and format durations humanely.
3. Citations need interactive previews and keyboard support.
4. Example queries must all work and populate consistently.
5. Mobile navigation must keep Approvals and Developer accessible rather than hiding them.
6. Dialogs need focus trap, focus restoration, Escape behavior, accessible labelling, and inert background behavior.
7. Navigation needs visible active state (`aria-current`); toggles need `aria-pressed`.
8. Reset or intentionally restore scroll on product-area changes.
9. Reduce oversized/repetitive answer typography and improve scan hierarchy.
10. Remove dead controls and placeholder interactions.

#### Documentation and submission

README and submission files contain stale claims about Gmail, test counts, router accuracy, PDF status, and latency. Recompute and update all of them from current artifacts. Search for stale values such as `217`, `74.4`, `not indexed`, `unverified Gmail`, and old p50/p95 numbers.

Required canonical documents:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/BASELINE_AUDIT.md`
- `docs/CONNECTOR_PROOF.md`
- `docs/LARGE_PDF_PROOF.md`
- `docs/EVALUATION_METHODOLOGY.md`
- `docs/JUDGING_MATRIX.md`
- `docs/DEMO_SCRIPT_60S.md`
- `docs/SUBMISSION_COPY.md`
- `docs/SECURITY.md`
- `docs/SOCIAL_POSTS.md`

Avoid maintaining contradictory duplicate scripts. Make one demo script canonical and link to it.

### Parallel team arrangement

If subagents are available, create these bounded workstreams after the baseline run. They may inspect and propose patches, but the lead agent must review every diff and run integrated gates.

1. **Retrieval + evaluation agent**
   - Finish 22/22 PDF proof.
   - Harden live benchmark grading.
   - Improve router accuracy and citation metrics.
   - Never alter expected answers merely to pass.

2. **Queue + backend reliability agent**
   - Fix exact connector lineage and deduplication.
   - Add rate limiting and safe public-session behavior.
   - Verify approvals, idempotency, and MCP token boundaries.

3. **Product design + motion agent**
   - Audit all viewports and interactions.
   - Build the original premium black/neon system.
   - Implement meaningful motion, accessible dialogs, citation previews, loading/error/empty states, and responsive navigation.

4. **Adversarial judge + release agent**
   - Run browser QA, accessibility, Lighthouse, link/control inventory, secret scan, deployment smoke tests, and evidence-pack review.
   - Challenge every metric and marketing claim.

Coordinate through small, reviewable commits. Do not let multiple agents edit the same file concurrently. Never merge an agent patch without examining its diff and running the relevant tests.

### Original visual and motion direction

Build a distinct “evidence in motion” language:

- Near-black graphite base, off-white text, acid chartreuse as the proof/active accent, restrained mint/amber/red semantic states.
- Sharp editorial typography plus a clean interface sans; use fluid `clamp()` sizing.
- Real Slack, Linear, GitHub, Gmail, document/PDF, and supported-provider SVG icons with accessible names.
- Use fine vector lines to show evidence moving from provider nodes into an entity graph, then resolving into claims and priority actions.
- On query submission, visibly stage: route decision → connector traversal → receipts arriving → entity linking → contradiction check → cited answer → prioritized action.
- Animate transform and opacity. Avoid gratuitous particles, cursor trails, permanent bouncing, template blobs, heavy WebGL, or motion that obscures evidence.
- Pause background work when hidden and honor `prefers-reduced-motion`.
- Provide polished skeleton, empty, offline, stale, syncing, indexed, failed, partial-evidence, and abstained states.
- Every animation must explain system state or interaction response.
- “4K quality” means vector sharpness, disciplined max widths, responsive density, and balanced composition at 3840×2160—not giant text or raster decoration.

Required visual QA sizes: 360×800, 390×844, 768×1024, 1440×900, 1920×1080, 2560×1440, and 3840×2160.

The Proof view is the hero. Within seconds a judge must understand the question, sources traversed, multi-hop relationship, disagreement, answer, priority action, and reproducibility receipt.

### Grounded answer contract

Validate and render at least:

```ts
{
  answer: string;
  claims: Array<{ text: string; evidenceIds: string[]; providers: string[] }>;
  citations: Citation[];
  priority_items: PriorityItem[];
  contradictions: Contradiction[];
  missing_information: string[];
  retrieval_receipt: {
    query_id: string;
    mode: "fast" | "thinking";
    routing_reason: string;
    hydradb_calls: number;
    total_latency_ms: number;
    provider_coverage: string[];
    receipt_count: number;
    metadata_filters: unknown;
    graph_usage: boolean;
    estimated_cost_units: number;
    timestamp: string;
  };
}
```

Remove unsupported answer prose before it reaches the browser. Every displayed claim must cite IDs present in the returned evidence. If a source-scoped document query includes connectors, call and count both retrieval operations honestly.

### Prioritization policy

Use structured, deterministic features—not LLM vibes:

- urgency/deadline: 25%
- customer or operational impact: 25%
- explicit commitment: 15%
- dependency/blocking effect: 15%
- source corroboration: 10%
- recency: 10%

Apply visible penalties for completion elsewhere, unresolved contradiction, weak evidence, missing owner, duplicate task, and stale source. Display the active formula and every component.

### Acceptance gates

Do not call the release complete until the results are captured in versioned artifacts.

#### Functional and retrieval

- At least 3 real, attributable HydraDB connectors; target all 4 already observed.
- 22/22 large-PDF required facts plus beginning/middle/end coverage.
- Cross-source PDF question includes the exact `ENG-456` requirement and evidence from the document plus at least two connectors.
- At least 30 deterministic benchmark cases with category coverage.
- Required-fact accuracy ≥90%.
- Citation precision ≥95%.
- Citation completeness ≥95%.
- Zero knowingly unsupported claims.
- Contradictions preserved when present.
- Router agreement ≥90% on a frozen labelled set.
- Median HydraDB calls ≤1.2.
- Fast-mode p95 target ≤1.5 s when external conditions permit.
- Thinking-mode p95 target ≤6 s; if HydraDB exceeds it, report the measured limitation and optimize only controllable overhead.
- Large-PDF canary recall ≥90%.

#### Product

- Every visible control performs a real action or is removed.
- No access-token sign-in wall for the public sandbox.
- Working example queries, queue filters/sorting, citation drawer, source preview, sync/retry, benchmark filters, approvals, MCP token flow, and copy controls.
- Correct loading, empty, error, stale, partial, and offline states.
- Keyboard usable, WCAG AA contrast, semantic landmarks, correct heading order, visible focus, and 44×44 touch targets where applicable.
- No console application errors, failed internal requests, broken links, horizontal overflow, or content hidden behind animation.

#### Performance and visual quality

- Lighthouse targets: Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO ≥90.
- CLS <0.1 and LCP target <2.5 s.
- Verify every required viewport with screenshots and an interaction smoke test.
- Real locally bundled icons; no letter-box substitutes where a supported provider icon exists.
- `prefers-reduced-motion` verified.

#### Security and developer experience

- Clean worktree and Git-history secret scan before public visibility.
- No client-side secrets or credential serialization.
- Public rate limits and upload/token/proposal caps.
- Workspace isolation tests.
- Signed expiring/revocable MCP tokens stored only as hashes.
- External writes remain proposed until explicitly approved; idempotency prevents double execution.
- Reproducible setup, benchmark, MCP, and deployment documentation.

### Required command sequence

Use the actual repository scripts and fix failures rather than skipping them:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:security
npm.cmd run test:mcp
npm.cmd run benchmark:router
npm.cmd run build
npm.cmd run deploy:check
```

Then deploy the intentional commit to the existing linked project:

```powershell
npx.cmd vercel --prod --yes
```

After production is canonical:

```powershell
npm.cmd run test:live
npm.cmd run benchmark:live
npm.cmd run benchmark:pdf
```

Run responsive browser E2E, console/network inspection, accessibility audit, Lighthouse, and secret scanning separately. Record exact commands, timestamps, commit SHA, target URL, pass/fail counts, and artifact paths. Do not replace a failed external live check with a mocked check.

### Sixty-second judge story

The final demo must be executable exactly as written:

- 0–6 s: “Agents can act, but their priorities are fragmented across tools.”
- 6–14 s: show four real connector receipts and the measured 346-page indexed PDF.
- 14–31 s: run the flagship AuthShield query requiring GitHub, Linear, Slack, and document context.
- 31–42 s: expand inline citations and the GitHub-versus-Linear open/merged contradiction.
- 42–50 s: open the highest priority execution packet, deterministic score breakdown, and safe next action.
- 50–57 s: open the retrieval receipt and honest benchmark panel: mode, calls, latency, provider coverage, exact-fact result.
- 57–60 s: “QueueProof turns fragmented context into the next safe, provable action.” Show live URL and public repository link only after both are verified.

Keep one canonical 60-second script. Rehearse it against production and ensure every click and query works within the allotted time.

### Adversarial judge panel

Before the final release, independently review the deployed build from these perspectives:

1. HydraDB hackathon judge
2. Staff backend engineer
3. Retrieval/evaluation scientist
4. Product and motion design director
5. Security reviewer
6. First-time user on mobile

Score 0–10 with evidence for hackathon compliance, connector authenticity, retrieval correctness, prioritization usefulness, citations/provenance, latency/cost, reproducibility, developer experience, visual craft, accessibility, security, and demo clarity. For every score below 10, state the observable defect, fix what is technically controllable, rerun the relevant check, and keep any remaining risk explicit. Never manufacture a 10.

### Final deliverable format

Return all of the following, with links or paths to supporting artifacts:

1. Concise outcome and honest readiness verdict.
2. Canonical production URL, GitHub URL, production commit SHA, and deployment timestamp.
3. Material files changed and why.
4. Actual connector list with sanitized connector/resource/sync/canary receipts.
5. PDF filename, label, pages, bytes, hash, source ID, indexing duration/state, and 22-case result.
6. Before-versus-after benchmark table.
7. Test, build, E2E, accessibility, Lighthouse, benchmark, and secret-scan commands with exact results.
8. Remaining external blockers and risks.
9. Exact hackathon form answers.
10. Canonical 60-second script.
11. Adversarial panel scorecard with evidence.

Do not stop at a plan, mockup, partial redesign, or local build. Ship the strongest truthful version of the existing QueueProof product and prove each claim from production.

## END MASTER PROMPT
