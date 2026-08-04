# QueueProof design system

**Direction:** Evidence Intelligence Command Centre.

**Job:** let a judge ask one difficult cross-source question and inspect the answer, receipts, disagreement, route, latency, and safe next action without leaving the product.

**Audience:** hackathon judges first; agent and infrastructure developers second.

## Signature

The evidence-node Q identity and low-power evidence field are the expressive system. The interface around them stays restrained, dense, and operational. Motion must correspond to navigation state, persisted workflow events, replay position, or feedback from a real action.

## Tokens

| Role | Value |
| --- | --- |
| Background | `#070A0F` |
| Surface | `#0D131B` |
| Raised surface | `#121A24` |
| Hover surface | `#172230` |
| Border | `rgba(255,255,255,0.09)` |
| Active border | `rgba(94,230,168,0.45)` |
| Primary text | `#F4F7FB` |
| Secondary text | `#A3ADBA` |
| Muted text | `#727E8D` |
| Evidence | `#5EE6A8` |
| Reasoning | `#6D8CFF` |
| Review | `#F4BA66` |
| Danger | `#FF786C` |

Geist is the interface face. Geist Mono is reserved for IDs, commands, timestamps, receipt hashes, query modes, source identifiers, and metrics. Sentence case is the default; uppercase monospace is not a general label style.

## Composition

- Working content caps at approximately `1280px`.
- Use a 4/8px spacing system with 12–16px component gaps.
- Desktop page padding is 24–40px; mobile uses 16px.
- Minimum interactive target is 44px.
- Avoid large empty heroes; the working product appears in the first viewport.
- Use one dominant accent per state: evidence green, reasoning blue, review amber, danger red.

## Navigation

- Desktop primary: Ask, Priorities, Evidence, Lab.
- Lab contains Benchmarks and Replay.
- Utilities contain command search, Approvals, live status, Developer, Method, and Owner.
- Mobile bottom navigation: Ask, Priorities, Evidence, Lab, overflow.
- The active tubelight indicator uses layout motion and never changes element bounds.

## Motion

- Hover: 120–180ms.
- Navigation/layout: 180–260ms.
- Drawers/modals: 220–320ms.
- No entrance animation exceeds 500ms.
- Evidence and replay sequencing use real persisted events only.
- Reduced motion disables ambient fields and collapses motion to state changes.

## Truth and accessibility

- Never hardcode connector truth, answers, graphs, latency, costs, or benchmark passes.
- REVIEW remains a failed frozen requirement.
- Color is never the sole state indicator.
- Primary text must meet 4.5:1 contrast and secondary text at least 3:1.
- All navigation, dialogs, replay controls, receipts, and graph fallbacks remain keyboard accessible.
- Mobile and WebGL-unavailable states retain the full textual product.
