# QueueProof 3–4 minute Supademo shot list

Capture the canonical production release only after the release, data, privacy, and client gates
below pass. Use synthetic Helios/AuthShield data. No step may show a secret, OAuth screen, personal
history, browser profile, or unsupported client claim.

| Time | Supademo step | Interaction | Hold / proof visible | Gate |
| ---: | --- | --- | --- | --- |
| 0:00–0:12 | Home hook | Slow pointer arrival; no decorative loop | Product promise and question composer | Page loads without console/network error |
| 0:12–0:22 | Problem montage | Two clean cuts: source chips → cited answer | Slack/Linear/GitHub/document relationship | Synthetic content only |
| 0:22–0:31 | Signed-out sign-in | Show themed sign-in page; click sign in, then cut | Branded QueueProof URL and privacy/terms links | Never record credentials, consent, callback, or address-bar query |
| 0:31–0:45 | Signed-in Sources | Resume after authentication | Four connector rows, proof states, indexed handbook | Count only `data_verified`; document must be `indexed` |
| 0:45–0:55 | Ask | Paste flagship prompt and submit once | Exact question and chosen Auto/Best mode | One real request; no replay chosen for a prettier answer |
| 0:55–1:24 | Answer | Let result settle; move through facets | Escalation, commitment, merged/open disagreement, mode/calls/latency | Result and metrics belong to current release |
| 1:24–1:39 | Citation | Open one Slack and one GitHub/Linear receipt | sourceId, provider, timestamp, excerpt, original link | Citation resolves; no private unrelated body |
| 1:39–1:55 | History graph | Hover only two meaningful nodes | source → claim → task/packet edges; conflict remains split | Graph uses real retained IDs; omit if unavailable |
| 1:55–2:10 | Today / queue | Open top ranked task | deterministic score, components, penalties, confidence | Positive-score persisted item |
| 2:10–2:25 | Execution packet / Review | Open packet, then proposal status without submitting | evidence, acceptance criteria, permissions, `proposed ≠ executed` | No provider write; no approve/execute control through MCP |
| 2:25–2:51 | Proof tests | Show release identity, router/PDF rows, mode comparison | SHA, failures/review states, calls, latency, units | `/api/health/live` and `/api/lab` same SHA; bracket values replaced |
| 2:51–3:20 | ChatGPT | Add the no-auth public demo in a clean client, enter sanitized prompt, reveal read result | QueueProof label, tool use, cited synthetic evidence | `/mcp/demo` + initialize + tools/list + harmless read on same release; label it public demo |
| 3:20–3:29 | Codex | Crop to a fresh task canvas or sanitized terminal result | server name, tools discovered, read-only result | Same-release `/mcp/demo` receipt; no token/env/config path |
| 3:29–3:38 | Claude | Crop to fresh conversation canvas | connector name, read-only tool result | Same-release `/mcp/demo` receipt; no sidebar/history/profile |
| 3:38–3:50 | Close | Return to QueueProof cited answer | citations and approval boundary | Stable hold through final word |

## Sanitized client prompt

> Use QueueProof to answer: Who escalated the AuthShield outage, what did engineering commit to,
> and is the fix already merged? Cite returned source IDs, preserve disagreement, and identify any
> missing proof. Do not sync, propose, approve, or execute anything.

## Privacy framing for ChatGPT, Codex, and Claude

- Start each client from a new synthetic conversation. Use `/mcp/demo` with no authentication for
  the public Helios proof; use `/mcp` only after personal OAuth is complete.
- Collapse sidebars before capture and keep them closed. Crop out chat history, workspace switcher,
  account avatar/profile, email, bookmarks, extensions, downloads, password manager, and OS tray.
- Keep the pointer away from navigation edges that reopen hidden history.
- Never show OAuth consent, callback URL, authorization code, client ID/secret, bearer token,
  environment variable, raw config file, developer payload inspector, internal workspace ID, or
  provider-internal connector ID.
- Disable notifications and autocomplete. Stop and recapture if private content appears; do not rely
  on a moving blur.
- Export, then inspect every cut frame by frame. Watch once muted for privacy and once with
  headphones for sync.

## Visual and audio spec

- 1920×1080, 16:9, 30 fps, 100% browser zoom; typography must remain legible on a laptop.
- Use hard cuts or 150–220 ms dissolves. Avoid zoom storms, fake cursor clicks, floating labels,
  generic neon gradients, and transitions that obscure evidence.
- One restrained pointer highlight per meaningful action; hold receipts and metrics at least two
  seconds.
- Voice master: 48 kHz/24-bit mono. Music optional, original/CC0, at least −18 dB relative to voice,
  and lower during factual metrics.
- Also verify 1280×800 and 390×844 product paths, keyboard focus, 200% zoom, and reduced motion.

If any named client gate fails, use the conditional replacement in `VIDEO_SCRIPT_4_MINUTES.md` and
omit that screen. A documented setup is not a connected-client demo, and a public-demo receipt is
not a personal-workspace OAuth receipt.
