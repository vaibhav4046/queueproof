# Secret-scan evidence — 5 August 2026

> [!WARNING]
> **SUPERSEDED HISTORICAL RECEIPT.** This scan is pinned to the SHA below and predates the
> current Vercel/Auth0 detection families. CI now runs `pnpm scan:secrets` on each candidate's
> worktree and reachable history; a new release must use that same-commit receipt.

## Result

**Pass: zero high-confidence credential candidates** in the release-candidate
worktree and zero in every blob reachable from every local Git ref.

## Exact scope

- Branch/ref at scan time: `codex/dialog-autofocus`.
- Exact HEAD at scan time: `aed027879150e3e324b54c5ec2194d4d715c501e`.
- Candidate worktree: 307 tracked or non-ignored untracked files, including the
  release artifacts and documentation intended for the next commit.
- Candidate-content fingerprint:
  `33d4b9c994db4edb30fe4efd1605989fe739ba117245b092414081c836e97bc9`.
  This is SHA-256 over sorted `path + NUL + content-SHA-256` records, excluding
  this self-referential report.
- Reachable history: 141 commits and 960 unique reachable blobs across all local
  refs.
- Ignored environment files, dependencies, and generated build output were not
  release candidates and were outside the scan scope.

## Safe-output method

[`scripts/secret-scan.mjs`](../scripts/secret-scan.mjs) enumerated the candidate
worktree with `git ls-files`, enumerated history with `git rev-list --objects
--all`, and read blobs through Git's binary-safe batch protocol. It retained and
printed aggregate counters only; it did not print or persist matching values or
matching lines. The ref and HEAD were re-read after the scan to reject a moving
snapshot.

High-confidence pattern families covered:

- AWS access-key ids and labelled secret/session values
- GitHub personal, OAuth, user, server, and fine-grained tokens
- OpenAI secret keys
- Slack tokens
- Linear API tokens
- Stripe live/restricted keys and webhook secrets
- Google API and OAuth client secrets
- PEM, RSA, EC, OpenSSH, DSA, and encrypted private-key headers
- Turso labelled JWT or long high-entropy authentication tokens
- Vercel labelled authentication tokens
- Attio-labelled values containing a 64-character hexadecimal token

Short example and test strings that cannot match a live Turso credential shape
are intentionally outside the Turso high-confidence pattern.

## Aggregate results

| Pattern family | Candidate worktree | Reachable Git blobs |
| --- | ---: | ---: |
| AWS access key | 0 | 0 |
| AWS labelled secret | 0 | 0 |
| GitHub token | 0 | 0 |
| OpenAI key | 0 | 0 |
| Slack token | 0 | 0 |
| Linear token | 0 | 0 |
| Stripe live secret | 0 | 0 |
| Google credential | 0 | 0 |
| Private-key header | 0 | 0 |
| Turso token | 0 | 0 |
| Vercel token | 0 | 0 |
| Attio-labelled 64-hex | 0 | 0 |
| **Total candidate occurrences** | **0** | **0** |
| **Files/blobs with any candidate** | **0** | **0** |

No tracked release file or reachable historical blob required quarantine or
history rewriting. Repeat this scan after any later credential-bearing change.
