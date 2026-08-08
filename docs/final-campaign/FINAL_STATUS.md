# QueueProof — FINAL STATUS (2026-08-08, release in flight)

Deadline (user-confirmed): **08:00 UK, 2026-08-08.** Release gate started ~03:09 UK.

## Gate evidence (this session, real output)

| Gate | Result | Evidence |
| --- | --- | --- |
| Vitest | **653/653 passed, 74 files** | run 03:09:48, duration 25.37s |
| Compile | **passed** | `✓ Compiled successfully` (Next.js 16.3.0 webpack) |
| TypeScript | **passed** | `Finished TypeScript in 8.0s` after fixing one TS7006 in the new auth-reconcile effect (`event` param typed) |
| Local prod page-data | expected-fail | `/.well-known/oauth-authorization-server` requires `QUEUEPROOF_ENCRYPTION_KEY` + Turso env, which exist only in Vercel. Not a code defect: compile+TS clean; Vercel build with real env is the authoritative prod build, verified by SHA poll below |
| Commit/push/deploy | this commit | verify: `/api/health/live` must serve this commit's SHA |

## Fixes shipped in this commit

- Auth view desync after magic-link sign-in in another tab: Supabase `onAuthStateChange` + `pageshow`/`visibilitychange` reconcile effect (`app/QueueProofApp.tsx`).
- Raw JSON error banners: HydraDB SDK now maps structured error envelopes to human sentences, exposes `errorCode` (`packages/hydradb/src/client.ts`).
- Composer double focus ring removed; focus-within card glow keeps keyboard a11y (`app/globals.css`).
- All 7 modal close buttons: 44×44 target, aria-labels, uniform icon.
- Claude plugin installable: `.claude-plugin/plugin.json` + `marketplace.json` with **inline** MCP server (`queueproof-demo` → https://queueproof.vercel.app/mcp/demo). Root defect was a dangling reference to gitignored `.mcp.json`.

## Video v2 (in progress at commit time)

- VO: user-selected Mark ElevenLabs read (69.49s raw). Long pauses compressed at measured
  silence boundaries (11 cuts, 0.20s gaps kept) + 1.055x tempo → **59.46s**, in the 59.0–59.8s spec.
- Captions re-timed to the processed VO via local faster-whisper transcription, then burned.
- Fallback: `video/queueproof-demo-final.mp4` (60.67s verified real footage, committed here).

## User-only actions (still required)

1. **Rotate the exposed Attio access token at the provider** (begins `fc41…`) — treat as compromised.
2. Submit the form before 08:00 UK; paste-ready answers in `submission/`.
