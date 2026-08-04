# Secret-scan evidence — 4 August 2026

## Scope

- Branch/ref at scan time: `codex/final-evidence`.
- Exact HEAD at scan time: `c7cf16b3c92f66d7b2f17a90e01372b77d62235b`.
- Tracked worktree: all 291 Git-tracked files, including 10 tracked files modified on
  top of that HEAD at scan time.
- Exact candidate-content fingerprint: `25d2869b8313c335558a8fec4a02f9b44bca32c04075bbd2889700a2546c6c66`.
  This is SHA-256 over sorted `path + NUL + content-SHA-256` records for every tracked
  file except this self-referential evidence report.
- Complete reachable Git history: `git rev-list --objects --all`, covering 126
  reachable commits and 836 unique reachable blobs across all local refs.
- Untracked files, ignored local environment files, dependencies, and generated output
  were outside the requested tracked-worktree/history scope.

## Safe-output method

The worktree pass read content from `git ls-files`. The history pass enumerated every
object reachable from every ref, selected every unique blob by object type, and scanned
the raw blob contents. The scanner retained only aggregate counters; it did not print,
store, or write candidate values or matching lines.

The scanner recomputed the branch, HEAD, and candidate-content fingerprint after both
passes. All three were unchanged, so the result covers one stable dirty-worktree
snapshot rather than a mixture of files modified during the scan.

High-confidence pattern families covered:

- AWS access-key ids and labelled secret/session values
- GitHub personal, OAuth, user, server, and fine-grained tokens
- OpenAI secret keys
- Slack tokens
- Linear API tokens
- Stripe live/restricted keys and webhook secrets
- Google API and OAuth client secrets
- PEM, RSA, EC, OpenSSH, DSA, and encrypted private-key headers
- Turso labelled authentication tokens
- Vercel tokens and labelled token values
- Attio-labelled values containing a 64-character hexadecimal token

## Aggregate results

| Pattern family | Tracked worktree | Reachable Git blobs |
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

No matching tracked file or reachable historical blob required quarantine or history
rewriting. This evidence applies only to the exact ref/HEAD and tracked worktree state
described above; repeat the scan after any later credential-bearing change.
