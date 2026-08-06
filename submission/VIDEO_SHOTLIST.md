# QueueProof video shot list

Use the current canonical deployment only. Capture no owner token, MCP key, email address, private
source body, browser profile, or connector credential.

| Time | Route/shot | Must be visible | Pass condition |
| ---: | --- | --- | --- |
| 0–7s | `/` hero/composer | Hook, question box, public-workspace context | No loading error or horizontal overflow |
| 7–22s | `/` live question | AuthShield prompt and completed answer | One current request; no replay/fixture substitution |
| 22–34s | Citation dialog | Provider, timestamp, excerpt, receipt/source ID, original link | Focus stays in dialog; close restores focus |
| 34–43s | `/evidence` | At least three current ready connector receipts; document provenance; degraded state if present | Count only attributable current records |
| 43–54s | `/benchmarks` | Production SHA, current measured rows, a `REVIEW`, mode comparison state, PDF result | Health/lab SHA matches; no stale values |
| 54–60s | `/developer` | Canonical `/mcp`, read-only default, scopes, approval boundary | No plaintext key or unsupported OAuth/client claim |

## Four-minute inserts

- `/queue`: top ranked item and Execution Packet fields.
- `/approvals`: proposal/approval/execution status; no live external write.
- `/api/health/live`: SHA, ref, deployment ID/timestamp, grader receipt version.
- `/api/lab`: same SHA/ref and current artifact status.
- Optional terminal: `initialize`, `tools/list`, and one read-only MCP call only when the output is
  sanitized and token-free.

## Capture matrix

- Primary recording: 1920×1080 or 1440×900, 100% zoom.
- Rehearsal checks: 390×844 mobile and 1280×800 desktop.
- Keyboard: composer, citation dialog, navigation, Escape, focus restoration.
- Reduced motion: product remains usable with animation reduced.
- Browser console/network: no unexplained application errors in the judge path.
- Backup: screenshots of the final answer, receipt, Sources, and Proof tests on the same release.

Video URL remains **PENDING** until upload and signed-out playback are verified.
