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
