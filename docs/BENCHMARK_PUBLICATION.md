# One-time benchmark publication

QueueProof publishes judge-facing measurements only after the exact production release is live. The ordinary `/api/lab/artifacts` operator route remains available for a separately configured long-lived credential. The one-time batch route exists for the release where that credential is unavailable.

## Security contract

- The repository contains only the SHA-256 hash of a randomly generated 256-bit token. The raw token must never enter Git, logs, CI variables, command-line arguments, email, or a browser.
- `POST /api/lab/artifacts/batch` is hidden with HTTP 404 when the token is wrong, the hard expiry has passed, or the request reaches a Vercel preview.
- The request must contain exactly one Auto, Fast, Thinking, and PDF artifact. Every artifact must use `grounded-grader-v3`, be release-verified, pass every case, have perfect fact/citation/relevance quality, and identify the exact SHA and ref currently serving production.
- The PDF artifact must also pass the beginning, middle, and end canaries plus the cross-source case.
- The complete request is limited to 2 MB.
- Token consumption, missing artifact inserts, and the audit event commit in one database transaction. Only the token hash is stored.
- A retry is idempotent only when the consumed token, release SHA, artifact-set hash, and all four stored artifact hashes match exactly. A changed payload cannot reuse the token.
- The route expires at `2026-08-08T06:00:00.000Z`. The expired code can remain deployed because every request fails closed.

## Operator flow

1. Deploy the release containing the committed token hash.
2. Confirm `/api/health/live` reports the exact 40-character production SHA and `main` ref.
3. Run all four strict v3 benchmarks against the canonical production URL.
4. Build one JSON body with an `artifacts` object containing `auto`, `fast`, `thinking`, and `pdf`.
5. Send the raw token only through a process environment or standard input to a local HTTPS client. Use the `x-queueproof-benchmark-once` header. Do not put it in shell history or an argument.
6. Verify the response hashes, then verify `/api/lab` reports all four artifacts as durable and bound to the same production SHA.

The raw token is intentionally not recoverable from the repository. Losing it requires a new token hash and a new release; this is a security property, not a recovery bug.

