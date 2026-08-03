# QueueProof — Evidence Orbit scene architecture

## Implementation choice
The scene is a **state-driven SVG + CSS 3D DOM composition** (`app/components/EvidenceOrbit.tsx`),
not a WebGL runtime and not a looping video.

Rationale (smallest maintainable option that satisfies the motion-state contract):
- Zero new runtime dependencies — no `three`/`@react-three/fiber`/`drei` to
  install, bundle, or keep patched in an offline/restricted build environment.
- No WebGL failure mode and no SSR hydration risk: the scene is real DOM/SVG and
  renders identically server-side and client-side (verified in the rendered HTML).
- Vector sharpness at 3840×2160 without device-pixel-ratio management.
- The scene never intercepts scrolling or unrelated controls, and requires no
  3D interaction to complete any task (all tasks work without it).
- A WebGL upgrade path exists if the team later wants volumetric fidelity; the
  component contract (stage/mode/receipts/coverage/action props) is renderer-agnostic.

## Structure
```
EvidenceOrbit (client component)
├── .orbit-glow        (radial background, decorative, aria-hidden)
├── .orbit-stage       (CSS perspective(1300px) + rotateX/rotateY parallax ≤ 6deg)
│   ├── <svg 1440×470> (decorative canvas: arc, routes, pulses, facets, forks)
│   │   ├── .orbit-arc        shallow world arc
│   │   ├── .orbit-route×5    cubic béziers source→core (provider-colored)
│   │   ├── .orbit-pulse×5    receipt pulses positioned by the rAF loop
│   │   ├── .orbit-fork       amber contradiction split (state-gated)
│   │   └── .core-*           faceted proof core + mode ring + proof/lock marks
│   ├── .orbit-node×5    semantic <button> tiles (real icons, aria-labels)
│   ├── .orbit-core-label (decorative duplicate of the status row, aria-hidden)
│   └── .orbit-action-card / .orbit-action-slot (real DOM result card)
└── .orbit-console      status row: route mode, receipts linked, contradictions,
                        replay badge, "Pause motion" control (aria-pressed)
```

## State mapping (props from AskScreen)
| Real event | Stage | Scene behavior |
| --- | --- | --- |
| query accepted | `routing` | mode ring activates with the real route label |
| HydraDB calls in flight | `retrieving` | only now do receipt pulses travel routes |
| entity linking | `linking` | facets converge |
| contradiction detected | `contradiction` | amber fork + badge appear |
| validation grounded | `verified` | chartreuse lock/check on the core |
| abstained | `insufficient` | core dims with a "?" — no fake success |
| replay of verified receipt | `replay` flag | "REPLAY · VERIFIED RECEIPT" badge, never live-looking |

## Performance & lifecycle
- One `requestAnimationFrame` loop drives pulse positions imperatively via
  `path.getPointAtLength`; it stops when paused, reduced-motion, or tab hidden.
- No WebGL contexts, no shaders, no particle systems, no unbounded objects;
  five pulses + five routes total.
- All refs/maps are released on unmount; timers are cleared by AskScreen on error
  and unmount.
- `prefers-reduced-motion`: a static high-quality composition (nodes, routes,
  core, labels) with all animation and parallax disabled.
- Under 1024px the scene is replaced by the existing connector-proof rail
  (mobile receipt strip) — query and answer come first; no horizontal overflow.
