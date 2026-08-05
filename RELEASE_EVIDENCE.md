# QueueProof release evidence

> [!IMPORTANT]
> **Canonical judge-facing contract.** The deployed APIs are authoritative. Never copy a SHA,
> test total, latency, pass count, or cost value from an older document or artifact.

## Release identity

| Field | Authoritative source |
| --- | --- |
| Running commit, ref, target, and deployment | [`GET /api/health/live`](https://queueproof.vercel.app/api/health/live) |
| Current-release benchmark state | [`GET /api/lab`](https://queueproof.vercel.app/api/lab) |
| Human-readable results | [Proof tests](https://queueproof.vercel.app/benchmarks) |
| Canonical product | <https://queueproof.vercel.app> |
| Repository | <https://github.com/vaibhav4046/queueproof> — **PUBLICATION PENDING** |
| Video | **PENDING** |

The release is identifiable only when `health.release.commitSha` is present and the target is
`production`. A live or PDF result belongs to the submitted release only when its release SHA
matches `lab.results.currentRelease.commitSha`, which must equal the health SHA.

## Measurement acceptance contract

A judge-facing measurement is valid only when:

1. `/api/health/live` returns `status: "live"`, a full commit SHA, and `target: "production"`;
2. `/api/lab` reports the same SHA in `results.currentRelease.commitSha`;
3. the relevant artifact reports `status: "measured"`, has at least one case, and is
   release-verified;
4. Fast versus Thinking is compared only when `results.modeComparison.comparable` is `true`;
5. the value is read from the deployed **Proof tests** page or the matching API response; and
6. every `REVIEW`, timeout, missing provider, and unsupported claim remains visible.

When any condition fails, the honest release result is **awaiting current-release
measurement**. Historical JSON can explain provenance, but it cannot fill a current-release
submission field.

## Release gate

Run the following against the exact commit that will be submitted:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark:router
pnpm build
pnpm deploy:check
```

Then deploy, confirm the live identity, and run the authorized production measurements:

```bash
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode auto
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode fast
pnpm benchmark:live -- --url https://queueproof.vercel.app --mode thinking
pnpm benchmark:pdf -- --url https://queueproof.vercel.app
```

Exact test totals and benchmark totals belong to the CI and API receipts for that commit.
They are deliberately not frozen in this document.

## Connector, document, and MCP proof

- A connector counts only after HydraDB returns attributable records and QueueProof stores its
  proof receipt. A saved credential is not proof.
- The Sources page must show at least three ready providers for the recording. Any degraded
  connector remains visible and is not counted.
- The large-document fixture is a deterministic 346-page PDF with a recorded SHA-256 and
  HydraDB source ID. Retrieval outcomes are quoted only from a same-release measured PDF
  artifact.
- **Connect AI** exposes the MCP resource metadata and client setup. Claim a working external
  client only after an authenticated MCP smoke test against the submitted deployment.
- Reads return the same retained evidence contract as the web product. External writes remain
  owner-only and approval-gated.

## Claim rules

- `REVIEW` means a strict requirement failed; recovered facts do not convert it into a pass.
- A citation must resolve to a retained receipt that supports the nearby claim.
- Fixture results prove deterministic planning and ranking, not live connector quality.
- The six-question live suite is a release diagnostic, not an SLA.
- Weighted units are relative retrieval work, not dollars.
- A provider action is executed only when a provider response identifier is persisted.
- The repository is not submission-ready until signed-out access succeeds.
- The demo is not submission-ready until a public video URL replaces **PENDING**.

## Final sign-off

| Gate | Required state |
| --- | --- |
| Production identity | Health endpoint names a full SHA and production target |
| Current-release live result | `/api/lab` reports a measured same-SHA artifact |
| Mode comparison | Comparable same-release Fast and Thinking artifacts |
| Large-PDF result | `/api/lab` reports a measured same-SHA PDF artifact |
| Connector minimum | At least three ready providers with attributable receipts |
| CI and build | All required checks pass for the submitted commit |
| MCP | Authenticated client smoke test recorded if claimed in the demo |
| Repository access | **PENDING** until a signed-out browser can open it |
| Video URL | **PENDING** |

Do not mark this release signed off while either publication gate remains pending.
