# QueueProof — visual system ("Evidence Orbit")

Original design language for the Proof surface. Not a copy of any referenced
competitor; it extracts craft principles (cinematic negative space, restrained
semantic color, vector sharpness) and applies an original left-to-right
"evidence world" story.

## Tokens (existing `:root` in app/globals.css)
| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#040604` | near-black cinematic base |
| `--panel` | `#0b110c` | translucent graphite panels |
| `--paper` | `#f4f6ee` | warm off-white primary text |
| `--muted` | `#a1aaa0` | cool gray-green secondary text |
| `--faint` | `#7d867a` | restrained muted text |
| `--acid` | `#d7ff48` | proof / active accent (acid chartreuse) |
| `--acid-2` | `#ebffa6` | lighter proof accent |
| `--mint` | `#74f5ab` | document / evidence mint |
| `--amber` | `#ffc763` | contradiction / approval amber |
| `--red` | `#ff796d` | failure red |
| `--sans` / `--mono` | Geist / Geist Mono | interface sans + receipt monospace |

Provider identity colors (restrained, real marks from `react-icons/si`):
Slack `#7f9bff`, Linear `#b38cff`, GitHub `#e6edf3`, Gmail `#ff8f6b`,
document `#74f5ab`.

## Spatial story (desktop ≥ 1024px)
1. **Source world (left):** five real provider nodes (Slack, Linear, GitHub,
   Gmail, document) as glass-like tiles on a shallow curved world arc. Each is a
   semantic `<button>` with a real bundled SVG icon and an accessible label.
2. **Evidence routes (center-left → core):** fine cubic-bézier routes with
   provider-colored strokes. Receipt pulses travel the routes **only** while the
   system is actually retrieving (or replaying a verified receipt).
3. **Faceted proof core (center):** interlaced low-poly hexagon shells, wireframe
   outer ring, radial-gradient emissive fill, central PROOF mark. State changes
   the core: routing (mode ring), retrieving (route pulses), linking (facet
   convergence), contradiction (amber fork), verified (chartreuse lock check),
   insufficient (dim question mark — never a fake success).
4. **Action resolution (right):** a real DOM action card emerges from the core
   region showing score, title, safe next action, coverage, and approval gate.

## Motion contract
Every animation is state-driven from real backend events; none run detached from
system state. "Pause motion" control (aria-pressed), `prefers-reduced-motion`
disables all animation and parallax, and the rAF loop stops when the tab is
hidden. Pointer parallax is capped at roughly 4-6 degrees of rotation.

## Typography
Hero statements use the editorial serif face (`Iowan Old Style`/Palatino stack)
in fluid `clamp()` sizes; product surfaces use Geist sans; receipts, IDs, scores
and metrics use Geist Mono. No oversized marketing text pushes the console below
the fold at 1440×900.

## Anti-patterns avoided
No raster background pretending to be 3D; no fake connector calls; no fabricated
metrics in artwork; no template gradients/blobs; no letter-tile provider icons;
no uncontrolled full-screen WebGL; no cursor particle soup; no fake UI.
