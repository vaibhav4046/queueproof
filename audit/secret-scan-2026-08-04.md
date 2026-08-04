# Secret-scan evidence — 4 August 2026

## Scope
- Current release worktree at commit `38f3b1f` (includes Evidence Orbit, synthesis
  fix, and submission pack).
- Complete reachable Git history: every commit across all refs (81 commits).
- Pattern families: AWS access keys, GitHub tokens (ghp_/github_pat_/gho_/ghu_),
  OpenAI keys (sk-), Slack tokens (xox[baprs]-), Linear tokens (lin_api_),
  Stripe live keys (sk_live_), Google API keys (AIza), PEM/private-key headers.
- Excluded: node_modules, .next, dist, coverage, *.db, *.pdf, .wrangler, .vinext,
  public assets, evals/results (all non-source or binary surfaces).

## Safe-output method
The scan searched file content but emitted matching file paths only (worktree via
ripgrep `-l`, history via `git grep -l` per commit). Candidate values were never
printed into the terminal transcript or this report.

## Result
| Surface | Matching files |
| --- | ---: |
| Worktree (commit 38f3b1f) | 0 |
| Full reachable history (81 commits) | 0 |

No matching file required quarantine or removal. This is evidence for the state
scanned on 4 August 2026; repeat after any credential-bearing change and before
any future visibility change.
