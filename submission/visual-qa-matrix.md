# QueueProof — visual QA matrix (historical capture set)

> **Superseded by the final redesign.** The screenshots and commit below prove an earlier
> Evidence Orbit release only. They must not be submitted as current product captures. Run a
> fresh viewport, keyboard, reduced-motion, console, and network pass on the final deployment.

All screenshots are real headless-Chrome captures of the running application
(local, commit `d574e9b`), stored under `submission/screenshots/` and
`submission/assets/`. No retouching, no mocked UI.

## Viewport matrix
| Viewport | Screenshot | Checks |
| --- | --- | --- |
| 360×800 | screenshots/qp-360x800.png | no horizontal overflow (browser-verified), query+answer first, nav reachable |
| 390×844 | screenshots/qp-390x844.png | no horizontal scroll (browser-verified scrollWidth==clientWidth), RUN FLAGSHIP PROOF visible, zero console errors |
| 768×1024 | screenshots/qp-768x1024.png | tablet: orbit hidden, connector rail shown, proof core context via rail |
| 1440×900 | screenshots/qp-1440x900.png | hero + full Evidence Orbit above the fold; nodes/console visible (browser-verified) |
| 1920×1080 | screenshots/qp-1920x1080.png | increased whitespace, disciplined max widths |
| 2560×1440 | screenshots/qp-2560x1440.png | vector sharpness retained |
| 3840×2160 | screenshots/qp-3840x2160.png + assets/queueproof-4k-still-3840x2160.png | labels/line weights balanced at 4K |

## Open Graph
- assets/queueproof-og-1200x630.png — real product capture at 1200×630.
  The deployed layout.tsx currently references `og-v2.png` (1731×909); replace
  with this asset at publish time so the social card matches the shipped UI.

## State coverage (verified in code + browser)
- Idle/standby: browser-verified (STANDBY status, all five nodes, PROOF core).
- Routing/retrieving/linking/contradiction/verified/insufficient: state machine
  in AskScreen wired to real API events; component QA + unit-level logic; full
  visual verification of the busy states is scheduled against production after
  deploy (local dev has no HydraDB connectors).
- Reduced motion: all animation + parallax disabled via `.reduced-motion` class;
  "Pause motion" button disabled under reduced motion.
- WebGL unavailable: N/A — the scene is SVG/DOM, no WebGL requirement.
- Mobile: orbit hidden below 1024px; connector-proof rail is the receipt strip.

## Console/network
Browser-agent checks on desktop and mobile returned **zero console errors** and
no failed internal requests (local, commit `d574e9b`).
