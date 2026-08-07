# Contributing

Create a `codex/` or feature branch, keep production zero-state truthful, and avoid committing secrets or customer content.

Before submitting:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm doctor
```

Changes to HydraDB calls require a dated official-contract reference. Changes to ranking require invariant tests and a policy-version decision. Changes to MCP tools require correct read/destructive/idempotent/open-world annotations. Provider writes must be introduced behind evidence, risk, idempotency, approval, and audit boundaries.

Fixtures belong only in `evals/fixtures` or tests and must be guarded by `QUEUEPROOF_TEST_MODE=true`.

