# QueueProof Supademo shot and voice plan

Use this plan with [VIDEO_SCRIPT_2_3_MINUTES.md](VIDEO_SCRIPT_2_3_MINUTES.md). Capture the canonical
production deployment only after the exact-release checks in [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md).
The finished video should be 16:9, 1080p, and between two and three minutes.

## Supademo sequence

| Step | Time | Capture | Interaction and hold | Proof gate |
| ---: | ---: | --- | --- | --- |
| 1 | 0:00–0:16 | QueueProof `/` | Hold the hero and composer for two seconds; move the pointer only when narration names the live release. | Production page loads without console or network errors. |
| 2 | 0:16–0:38 | `/evidence` | Frame three or more current ready connector rows, then the document provenance. | Count only `data_verified` rows with attributable records. |
| 3 | 0:38–1:05 | `/` | Choose **Best**, paste the AuthShield question, submit once, and let the real result complete. | No replay, fixture, or repeated take chosen for a prettier answer. |
| 4 | 1:05–1:23 | Answer and receipt | Hold provider coverage and disagreement, then open one citation. | Provider, timestamp, source ID, excerpt, and original link resolve. |
| 5 | 1:23–1:41 | `/benchmarks` PDF section | Hold on 346 pages, checksum fragment, position canaries, and measured result. | PDF artifact matches the production SHA. |
| 6 | 1:41–2:07 | `/benchmarks` mode comparison | Show current-result badge, SHA, Quick and Investigate cards, calls, units, expected-versus-observed rows, and replay command. | Comparison is narrated only when marked **Measured**. |
| 7 | 2:07–2:36 | ChatGPT custom app | In a prepared clean chat, ask the sanitized prompt and show the visible QueueProof tool use and cited answer. | OAuth completed; `initialize`, `tools/list`, and one read-only production call succeeded. |
| 8 | 2:36–2:47 | QueueProof answer | Return to the answer and hold the source chips through the final word. | No overlays, notifications, or private content. |

Sanitized ChatGPT prompt:

> Use QueueProof to answer: Who escalated the AuthShield outage, what did engineering commit to,
> and is the fix already merged? Cite the supporting providers, preserve any disagreement, and say
> what evidence is missing.

Do not record an OAuth consent flow, developer settings, tool payload inspector, or credential
setup. The judge needs the connected app label, a visible read-only tool invocation, and the
grounded result—not the secret-bearing setup path.

## ChatGPT privacy frame

Before capture:

- Start from a new sanitized chat after connection; do not reuse a personal conversation.
- Collapse the ChatGPT sidebar before recording and keep it closed for every captured frame.
- Crop out chat history, workspace switcher, account avatar/profile, bookmarks, extensions,
  download shelf, password-manager UI, and operating-system notifications.
- Keep the pointer away from hidden navigation edges so the sidebar cannot reopen on hover.
- Do not expose client IDs, client secrets, bearer tokens, OAuth URLs, callback configuration,
  environment variables, workspace IDs, account email, or raw connector records.
- Use only the synthetic AuthShield/Helios evidence selected for the public demo. If any private
  source body appears, stop and recapture rather than relying on a moving blur.
- Review the exported MP4 frame by frame around every cut. If sidebar or profile content appears
  for even one frame, replace that step.

## Recording and redaction checklist

- Verify `/api/health/live` and `/api/lab` identify the same exact production SHA.
- Verify the narrated Auto/Quick, Investigate, and PDF artifacts are current and measured.
- Verify at least three connector receipts are currently ready; omit degraded rows from the count.
- Verify the AuthShield result, one citation, its original link, and the 346-page receipt before
  starting Supademo.
- Complete ChatGPT OAuth off-camera. Do not say “connected” until a current production read-only
  call succeeds and the returned result is visible.
- Disable browser autofill, password-manager prompts, notifications, and recording overlays.
- Use a clean 1920×1080 capture at 100% browser zoom; avoid rapid zooms, decorative cursor loops,
  and transitions that obscure evidence.
- Leave failures, missing facets, degraded sources, and `REVIEW` states visible. Never relabel them.
- Do not call weighted units dollars, the frozen sample an SLA, or the product “perfect.”
- Verify the final MP4 at normal speed, muted once for visual privacy, then with headphones for
  audio sync and intelligibility.

## Send one voice file

Record the final wording from the numbered sections as one continuous file. Preferred delivery is
`queueproof-demo-voice-v1.wav` at 48 kHz, 24-bit, mono. A high-quality MP3 at 192 kbps or better is
also acceptable.

- Record dry voice only: no music, room effect, artificial reverb, or aggressive noise removal.
- Leave **0.5 seconds of silence at the start and end**.
- Leave **0.6–0.8 seconds of clean silence between numbered sections**; do not speak the numbers.
- Aim for 130–140 words per minute with a calm, decisive delivery. Pause naturally after the
  AuthShield question and before the ChatGPT result.
- Replace benchmark brackets only after the final same-SHA values are supplied. Read ratios and
  units slowly enough to understand on first listen.
- Send the untouched original file. It can be split on the silent gaps and aligned to the eight
  Supademo steps without degrading the source audio.

Keep background music out of the voice master. If music is added during editing, use an
instrumental bed at least 18 dB below narration and fade it fully under metric-heavy sections.
