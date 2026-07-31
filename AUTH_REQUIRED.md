# External authorisation required

Last updated: 2026-07-31

Everything in this file needs a human to act, because it requires creating an account,
entering a credential, or approving an OAuth grant. Work that does **not** depend on these
items continues regardless.

**Never paste a secret into the Claude Code chat.** Use the methods below.

---

## Already satisfied — no action needed

| Item | Status | Evidence |
| --- | --- | --- |
| GitHub CLI auth | **Authenticated** as `vaibhav4046`, scopes `gist, read:org, repo, workflow` | `gh auth status` |
| Vercel CLI auth | **Authenticated** as `vaibhav4046` | `vercel whoami` |
| Vercel project link | **Linked** — project `queueproof`, id `prj_l08OsSMRo7rTEYakg5s8q6K1lp3X` | `.vercel/project.json` |

Publishing to GitHub and deploying to Vercel are therefore **not blocked**.

---

## BLOCKER 1 — Production durable storage credential

**Blocks:** Gate 1 (canonical deployment). Without it `queueproof.vercel.app` has no
database, every API route returns a stub, and the UI can only render a splash screen.

**Why it is unavoidable:** Vercel serverless functions have no persistent disk. A hosted
database credential is required. The whole schema and every query is SQLite dialect
(`INSERT OR IGNORE`, `CURRENT_TIMESTAMP` defaults), so a SQLite-compatible host avoids a
risky full rewrite to Postgres.

**Recommended (lowest friction): Turso / libSQL — free tier, no card.**

1. Create an account at <https://turso.tech>.
2. Create a database, then create a database auth token.
3. Add both values to Vercel **without pasting them in chat**:

```bash
vercel env add TURSO_DATABASE_URL production
```

```bash
vercel env add TURSO_AUTH_TOKEN production
```

Each command prompts for the value in your own terminal and stores it encrypted in Vercel.

**Local development needs nothing** — `QUEUEPROOF_SQLITE_PATH` in `.env.local` already
uses Node's built-in `node:sqlite`, so the full stack runs locally today with zero accounts.

---

## BLOCKER 2 — HydraDB API key

**Blocks:** Gates 2–6 (all connector work, retrieval, evaluation, document ingestion).

**Action:** generate a **new** key at <https://hydradb.com> and enter it through the
QueueProof web UI (Sources → Connect HydraDB), which encrypts it server-side before storage.
Do not reuse any key previously pasted into a chat window — see the security note below.

For the scripted live-acceptance run only, it may instead be provided as an environment
variable in your own shell:

```bash
vercel env add HYDRADB_API_KEY production
```

---

## BLOCKER 3 — Provider authorisations (Slack, Gmail, Linear)

**Blocks:** Gate 2 (three verified connectors), Gate 3 (cross-source retrieval),
Gate 8 (real tracked action).

These are OAuth grants that must be approved in your own browser session, per provider,
from inside the QueueProof Sources screen once BLOCKER 2 is cleared.

Use **dedicated test accounts / workspaces**, not personal or production data — the demo
recording will show this content.

| Provider | Needed for |
| --- | --- |
| Slack | Incident thread evidence, commitment detection |
| Gmail | Customer promise + deadline evidence |
| Linear | Issue state, staleness detection, and the one approval-gated write |

---

## SECURITY NOTE — credential rotation

A provider access token was exposed in earlier conversation content and must be treated as
**compromised**.

- Do not reuse it anywhere.
- Rotate it at the provider now, even if it appears unused.
- Only newly generated credentials, entered by the methods above, should be used.

A repository and git-history secret scan is tracked separately in
`audit/SECURITY_FINDINGS.md`.
