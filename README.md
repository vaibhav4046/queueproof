# QueueProof

**Know what needs attention, with the evidence attached.**

[![CI](https://github.com/vaibhav4046/queueproof/actions/workflows/ci.yml/badge.svg)](https://github.com/vaibhav4046/queueproof/actions/workflows/ci.yml)

QueueProof retrieves work evidence through HydraDB, answers cross-source questions with
claim-level citations, compiles a deterministic priority queue, and keeps external writes
behind an approval boundary. Missing evidence and source contradictions stay visible instead
of being smoothed over by the model.

- Product: <https://queueproof.vercel.app>
- Source: <https://github.com/vaibhav4046/queueproof>
- Method: <https://queueproof.vercel.app/method>
- Measured results: <https://queueproof.vercel.app/benchmarks>
- Candidate and release receipt: [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md)
- 60-second walkthrough: [docs/DEMO_SCRIPT_60S.md](docs/DEMO_SCRIPT_60S.md)
- Submission copy: [docs/SUBMISSION_COPY.md](docs/SUBMISSION_COPY.md)

## Judge path

The product has real, shareable routes rather than hash-only panels:

| Route | Purpose |
| --- | --- |
| [`/`](https://queueproof.vercel.app/) | Ask a cited cross-source question |
| [`/queue`](https://queueproof.vercel.app/queue) | **Today** — review the ranked next-action queue |
| [`/evidence`](https://queueproof.vercel.app/evidence) | **Sources** — inspect connector and document receipts |
| [`/benchmarks`](https://queueproof.vercel.app/benchmarks) | **Proof tests** — compare measured retrieval outcomes |
| [`/replay`](https://queueproof.vercel.app/replay) | **History** — revisit questions and replay stored benchmark artifacts |
| [`/approvals`](https://queueproof.vercel.app/approvals) | **Review actions** — inspect proposed writes before execution |
| [`/developer`](https://queueproof.vercel.app/developer) | **Connect AI** — configure MCP clients and inspect the integration contract |
| [`/method`](https://queueproof.vercel.app/method) | Read the evaluation and trust methodology |

Start with **Ask**, open a citation receipt, then inspect the same source under **Sources**.
The **Proof tests** page publishes failures as `REVIEW`; it does not relabel them as passes.

## What is implemented

1. A connector becomes retrieval-eligible only after HydraDB returns attributable records
   and QueueProof stores a proof receipt.
2. The query planner selects fast or thinking retrieval. Identifier-heavy questions can use
   parallel lexical and hybrid lanes before evidence is merged and deduplicated.
3. Answer claims point to stored receipts. Partial answers and abstentions expose what is
   missing, while conflicting source statements remain distinct.
4. Queue items are clustered without merging unrelated exact IDs, then scored by a pure,
   versioned ranking policy.
5. Execution packets carry evidence, constraints, score components, permissions, and a
   receipt hash.
6. Provider writes begin as proposals. Approval and a database-backed at-most-once claim are
   required before execution.

## Stored production measurements

The canonical artifacts embed a successful production health receipt for commit
`aed027879150e3e324b54c5ec2194d4d715c501e` on `main`, deployed as
`queueproof-7hvdge426-vaibhav4046s-projects.vercel.app`. Results below are bound to that exact
runtime. The offline router artifact separately records 39/39 labelled cases and 331
fixture-computable assertions; it is not a live-retrieval or deployment result.

The same six strict live questions were run in Auto, forced Fast, and forced Thinking modes:

| Requested mode | Strict cases | Facts | p50 / p95 | Calls | Weighted units | Observed execution |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Auto | 4/6 | 19/19 | 2,155 / 2,392 ms | 7 | 7 | All 6 returned Fast; four cited providers across the run |
| Forced Fast | 4/6 | 19/19 | 1,833 / 2,446 ms | 7 | 7 | All 6 returned Fast |
| Forced Thinking | 2/6 | 13/19 | 26,329 / 40,003 ms | 10 | 30 | Five returned Thinking; one timed out with mode unknown |

Auto and forced Fast measured 100% citation precision, 100% citation completeness, and 0%
unsupported claims. Their two `REVIEW` cases remain failures because each lacked the required
Linear-backed provider evidence, even though all answer facts were present. Forced Thinking is
not described as parity: it passed only 2/6 cases, and its timed-out case contributed no answer.

The SHA-bound 346-page PDF core suite passed 21/22 cases and recovered 55/56 required facts.
Beginning, middle, and end canaries passed. All 84 claims were supported, across 69 citations,
with 100% citation precision/completeness and 0% unsupported claims. All 22 cases returned Fast;
the run measured p50/p95 latency of 1,823/2,382 ms and used 31 HydraDB calls / 31 weighted units.

The separate document-plus-connectors extension remains `REVIEW`. It recovered both required
facts and cited the document plus GitHub, but the strict contract required one additional
non-document provider. It measured 29,676 ms, 6 calls, and 18 weighted units. This extension is
reported separately and is not counted as a 22nd core-suite pass.
See [connector proof](docs/CONNECTOR_PROOF.md), [large-PDF proof](docs/LARGE_PDF_PROOF.md),
and the machine-readable artifact at `evals/results/pdf-live-run.json`.

## Public and owner boundaries

The public deployment is a shared, read-oriented evidence workspace. Visitors can inspect
receipts, ask bounded questions, review queue packets, and inspect proposed actions. Credential
configuration, connector mutation, document uploads, MCP token management, and external writes
require a signed owner session.

The deployment owner signs in at [`/owner`](https://queueproof.vercel.app/owner) with the
server-configured `QUEUEPROOF_ACCESS_TOKEN`. The token is exchanged for a signed, `httpOnly`
session and is never stored in browser JavaScript or echoed by the API.

`QUEUEPROOF_PUBLIC_WORKSPACE_ID` selects the exact public workspace. A deployment with multiple
workspaces and no selector fails closed. Public query and proposal endpoints are rate-limited.
Secrets are encrypted at rest and are never returned by the API.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Next.js 16 / React 19 | Product shell, API routes, and public/private boundaries |
| HydraDB | Provider catalogue, connector lifecycle, retrieval, and document indexing |
| Turso / libSQL | Durable workspace, receipt, queue, approval, execution, and audit state |
| `packages/retrieval` | Query planning, exact-ID lanes, and evidence normalization |
| `packages/ranking` | Pure, versioned priority scoring and explanations |
| `packages/actions` | Typed provider payloads, risk classification, and execution claims |
| MCP | Scoped agent access to the same workspace-bound product records |

Read [the architecture](docs/ARCHITECTURE.md) and [security model](docs/SECURITY.md) for the
data flow and trust boundaries.

## Run locally

Requirements:

- Node.js 22.13 or newer
- pnpm 10.33.0 (declared in `package.json`)

```bash
corepack enable
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local`. For local-only development, the minimum configuration is:

```dotenv
QUEUEPROOF_ENCRYPTION_KEY=<at-least-32-random-characters>
QUEUEPROOF_ALLOW_LOCAL_IDENTITY=true
QUEUEPROOF_SQLITE_PATH=.data/queueproof.db
QUEUEPROOF_TEST_MODE=false
```

Then start the development server:

```bash
pnpm dev
```

For hosted storage, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` instead of
`QUEUEPROOF_SQLITE_PATH`. Add HydraDB credentials through the private Sources UI; do not commit
them to an environment file. `LINEAR_API_KEY` is optional and is needed only for an approved
external Linear write. Set a strong `QUEUEPROOF_ACCESS_TOKEN` to enable the hosted owner sign-in
flow.

## Verify

The pull-request CI workflow installs the committed lockfile and runs these deterministic
gates on Node.js 22.13:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark:router
pnpm build
pnpm deploy:check
```

For local shell acceptance, start the built app in one terminal and run the check in another:

```bash
pnpm start
pnpm test:e2e
```

Live benchmarks are deliberately separate from CI because they query connected provider data:

```bash
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode fast
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode thinking
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode auto
pnpm benchmark:pdf -- --url https://queueproof.vercel.app
```

The deterministic router benchmark is not presented as live-retrieval accuracy. Replay frames
are stored artifacts, not newly executed runs. Relative query units are not converted into
invented dollar costs.

## Evidence index

- [Canonical release evidence and sign-off](RELEASE_EVIDENCE.md)
- [Benchmark report](BENCHMARK_REPORT.md)
- [Evaluation methodology](docs/EVALUATION_METHODOLOGY.md)
- [Connector proof](docs/CONNECTOR_PROOF.md)
- [Large-PDF proof](docs/LARGE_PDF_PROOF.md)
- [Security model](docs/SECURITY.md)
- [Secret-scan evidence](audit/secret-scan-2026-08-05.md)
- [Dependency audit](audit/dependency-audit-2026-08-04.md)
- [Judging matrix](docs/JUDGING_MATRIX.md)
- [Hackathon form answers](docs/HACKATHON_FORM.md)

## Honest boundaries

- Timestamped live results are a small observed sample, not an SLA.
- A `REVIEW` benchmark result is a failed strict requirement, not a partial pass.
- The SHA-bound 346-page PDF core result is 21/22, not 22/22. Its separate cross-source
  extension also remains `REVIEW` because one required non-document provider was absent.
- Public users cannot mutate credentials, connectors, uploads, tokens, or external systems.
- A real provider write is proven only by a stored provider response identifier.
- Repository visibility must be verified in a signed-out browser before calling the source
  link public.
- Credentials previously exposed outside this repository must be rotated at their source even
  when repository secret scans are clean.

## License

[MIT](LICENSE)
