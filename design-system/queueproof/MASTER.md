# QueueProof design system

**Direction:** forensic evidence instrument

**Job:** let a judge ask one hard cross-source question and see the answer, receipts, disagreement, route, latency, and safe next action without leaving the screen.

**Audience:** hackathon judges first; agent and infrastructure developers second.

## Signature

The global evidence field and the state-driven Evidence Orbit are the one expressive visual system. They represent records being joined into a defensible answer. All other surfaces stay quiet and operational.

## Tokens

| Role | Value | Use |
|---|---:|---|
| Carbon | `#020203` | page background |
| Raised carbon | `#0B0B0E` | controls and cards |
| Bone | `#F2ECF4` | primary text |
| Muted bone | `#B4ADBA` | readable secondary text |
| Proof lime | `#D7FF48` | verified state and primary action only |
| Evidence violet | `#A879ED` | cross-source depth, routing, focus accents |
| Mint | `#74F5AB` | successful receipts |
| Amber | `#E9BE66` | contradiction or caution |
| Red | `#FF877C` | blocked or destructive state |

Typography uses Iowan Old Style / Palatino for the editorial thesis and evidence answers, Geist Sans for product copy, and Geist Mono for receipts, metrics, and controls. Do not introduce Inter or another generic display face.

## Composition

- Keep a consistent maximum product width of 1440–1540px.
- Use an 8px spacing rhythm and 16/24/32/48px section tiers.
- The Proof page begins with the thesis, honest live metrics, a four-step proof manifest, the evidence orbit, and the working query console.
- Product screens may use bento grouping, but never marketing-only cards or fake screenshots.
- Body copy should stay between 60 and 75 characters per line on desktop and use at least 16px on mobile.

## Components

- Primary CTA: proof-lime pill, one per section, 48px target, short verb-led label.
- Secondary CTA: bone outline on carbon; violet on hover; never competes with primary.
- Cards: black-metal glass, 1px bone border at 10% opacity, 15–21px radius.
- Hover: opacity, border, and `translateY(-2px to -4px)` only; 150–240ms; no layout shift.
- Focus: visible 2px proof-lime ring with 3px offset.
- Icons: Lucide / existing Simple Icons only, consistent stroke weight, no emoji.
- Metrics: tabular figures; label the denominator and benchmark mode; never hide failed cases.

## Motion

- One page reveal: opacity plus 18px rise, 520ms maximum.
- One typing cue: runs once, communicates that the console accepts a real question.
- Evidence field: low-power 30fps maximum; 1.1M pixel cap; pauses when hidden.
- Evidence Orbit: state-driven only; it may animate while real retrieval is happening.
- Hover/press feedback: 150–240ms. Press returns to scale `.98`.
- `prefers-reduced-motion` renders a static field and disables reveals, sheen, cursor blink, and decorative drift.

## Copy

- Prefer “Ask one question. See every receipt.”
- Prefer “Run live proof,” “See measured results,” and “Approve the action.”
- Avoid “agentic,” “synergy,” “context orchestration,” and unexplained infrastructure jargon in judge-facing copy.
- Keep HydraDB’s name where it proves connector/retrieval use, not in every label.

## Responsive and accessibility gates

- Verify 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768,
  1280×800, 1440×900, and 1920×1080.
- Verify one mobile landscape viewport and 200% text zoom.
- Minimum interactive target: 44×44px.
- Primary text contrast: 4.5:1 minimum; secondary text: 3:1 minimum.
- Navigation must expose all seven working destinations without page overflow.
- No important meaning can depend on color, hover, animation, WebGL, or Three.js.
- The SVG/DOM evidence surface remains the source of truth when WebGL is unavailable.

## Institutional atelier release (6.0)

- Product frame: cap working content at `1720px`; preserve a readable 60-75 character copy measure inside that frame.
- Navigation: liquid glass is reserved for the desktop masthead, mobile dock, menus, and transient controls. Use `22px` blur, restrained saturation, a static top-edge highlight, and a solid-carbon fallback.
- Desktop navigation labels never drop below `11px`. At 980px and below, expose all seven destinations in a top-level fixed dock with short labels and targets at least `44px` high.
- Mobile hero order is thesis, plain-language explanation, honest metrics, primary actions, then the working console. A focused primary action may scroll the console into view.
- Metadata floor: `11px` desktop and `9px` only for short mobile dock labels. Body copy remains `16px` on mobile.
- Native selects stay native for keyboard and assistive-technology reliability, with explicit dark option colors, a 44px minimum height, and visible focus styling.
- Scroll reveals are progressive enhancement only: `16px` rise, opacity, view-driven, and fully visible when unsupported. No content starts hidden in the base style.
- Hover lift is capped at `-3px`; press feedback uses `.985`. Animate only opacity and transforms in ordinary interactions.
- Do not promise a numeric frame rate. Keep compositor-friendly UI transitions inside a 16ms frame budget where hardware permits; retain the low-power 30fps cap for the ambient WebGL field.
