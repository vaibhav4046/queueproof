# QueueProof cloud execution state

Status: **ACTIVE**

This is a concise cloud-neutral ledger. Runtime identity and measurements are intentionally read
from the deployed receipts rather than frozen here.

## Authoritative state

| Item | Source | Required final state |
| --- | --- | --- |
| Git candidate | Current GitHub branch/PR | Reviewed, clean, and pushed |
| Production identity | [`/api/health/live`](https://queueproof.vercel.app/api/health/live) | Exact intended SHA/ref, production target, deployment ID and timestamp |
| Benchmark identity | [`/api/lab`](https://queueproof.vercel.app/api/lab) | Same SHA/ref as health |
| Human benchmark view | [Proof tests](https://queueproof.vercel.app/benchmarks) | Current-release measured rows; failures visible |
| Repository access | [GitHub](https://github.com/vaibhav4046/queueproof) | **Owner approval required before public access** |
| Video | Submission form | **PENDING recording/upload** |

## Completed in this execution

- Reconciled work from `codex/dialog-autofocus` rather than rebuilding from stale `main`.
- Preserved the public-read/owner-control boundary and release-bound benchmark contract.
- Added cloud-neutral agent, MCP, submission, video, and release-report documentation.
- Kept benchmark values out of durable copy until a current-release receipt exists.

## Release sequence

1. Run the complete deterministic gate from [AGENTS.md](../../AGENTS.md).
2. Commit and push the exact candidate.
3. Deploy the clean SHA to the existing production project.
4. Verify production identity and all primary routes.
5. Run Auto, Fast, Thinking, and PDF measurements against that SHA.
6. Publish artifacts only with the dedicated benchmark publishing credential.
7. Confirm `/api/lab` exposes the same-SHA receipts and keeps every `REVIEW` visible.
8. Update the pull request/release receipt, then advance `main` only to the verified SHA.

## Pending external or owner actions

- Supply or use the dedicated benchmark publishing secret if the current artifacts cannot yet be
  published. A Vercel token is not a benchmark token.
- Supply an authenticated QueueProof MCP bearer token for a production tool-call receipt.
- Complete any client OAuth consent only if an OAuth issuer is actually configured; OAuth is not
  assumed.
- Decide whether to make the private repository public, then verify it signed out.
- Record and upload the 60-second demo; add the public video URL to the submission form.
- Rotate any credential disclosed outside the deployment secret store.

## Next command

Use the next applicable command from the repository root; do not run a stale continuation path:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm benchmark:router && pnpm build && pnpm deploy:check
```

After the final deployment:

```bash
pnpm release:verify -- --url https://queueproof.vercel.app --sha <FINAL_SHA>
```

Set this ledger to **DONE** only after every autonomously controllable gate is complete. Use
**WAITING_FOR_USER** when only the explicit owner actions above remain, and **BLOCKED_EXTERNAL**
for a provider or platform outage with preserved evidence.
