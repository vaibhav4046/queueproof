# Secret-scan evidence — 4 August 2026

## Scope

- Judge-grade release source at commit `4ea707a`.
- Current release worktree after that commit.
- Complete reachable Git history: every commit across all refs (104 commits).
- Pattern families: AWS access keys, GitHub tokens, OpenAI keys, Slack tokens,
  Linear tokens, Stripe live keys, Google API keys, PEM/private-key headers, and
  long hexadecimal values assigned to Attio-labelled secrets.
- Worktree exclusions: generated dependencies/build output and local runtime stores
  (`node_modules`, `dist`, `.next`, `coverage`, `.wrangler`, and `.vinext`). The
  history pass searched every tracked Git blob.

## Safe-output method

The scan searched file contents but emitted aggregate counts only. Candidate values
were never printed into the terminal transcript or this report. Synthetic short test
fixtures were below real-token length thresholds and were not classified as secrets.

## Result

| Surface | Matching files or entries |
| --- | ---: |
| Release worktree | 0 |
| Full reachable history (104 commits) | 0 |

No matching file required quarantine or removal. Repeat this scan after any
credential-bearing change and before any future visibility change.
