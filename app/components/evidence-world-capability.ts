/**
 * Capability gate for EvidenceWorld (the optional Three.js layer behind
 * Evidence Orbit). Deliberately has zero dependency on "three" or
 * "@react-three/fiber" — it exists as its own tiny module so QueueProofApp
 * can decide whether to even mount `<EvidenceWorld>` (and therefore whether
 * to trigger its dynamic `import()`) without pulling the ~230KB gzip
 * Three.js chunk into the graph for every visitor. Only devices that pass
 * every check below ever pay that download cost.
 */
import { useSyncExternalStore } from "react";

// Matches globals.css: `@media (max-width: 1023px) { .evidence-orbit { display: none; } }`.
// No point loading a WebGL layer for a scene that CSS hides outright.
export const EVIDENCE_WORLD_MIN_WIDTH = 1024;
const LOW_END_CORE_THRESHOLD = 2;
const LOW_END_MEMORY_GB_THRESHOLD = 2;

type NavigatorWithDeviceSignals = Navigator & { deviceMemory?: number };

function canCreateWebglContext(): boolean {
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
    return context !== null;
  } catch {
    return false;
  }
}

// "Very low" thresholds only — absence of either API means "assume capable",
// never "assume incapable". A missing navigator.deviceMemory (Firefox,
// Safari) must not itself disqualify a device.
function isLowEndDevice(): boolean {
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores < LOW_END_CORE_THRESHOLD + 1) return true;
  const memory = (navigator as NavigatorWithDeviceSignals).deviceMemory;
  if (typeof memory === "number" && memory > 0 && memory < LOW_END_MEMORY_GB_THRESHOLD + 1) return true;
  return false;
}

export function detectEvidenceWorldCapability(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.innerWidth < EVIDENCE_WORLD_MIN_WIDTH) return false;
  if (isLowEndDevice()) return false;
  return canCreateWebglContext();
}

const getServerSnapshot = () => false;

/**
 * Real subscribe for useSyncExternalStore: re-evaluates capability whenever
 * either input that can change post-mount changes.
 *   - window resize: the viewport-width check (EVIDENCE_WORLD_MIN_WIDTH) is
 *     the one most likely to flip live — a user dragging a browser window
 *     narrower than 1024px must cause EvidenceWorld to unmount (its parent
 *     stops rendering it once this hook flips false), not just get hidden
 *     behind `.evidence-orbit-stack`'s `display: none` while its WebGL
 *     canvas keeps running requestAnimationFrame work underneath.
 *   - prefers-reduced-motion change: some OSes let this be toggled without a
 *     reload (e.g. a keyboard shortcut or quick-settings toggle on macOS/
 *     Windows), and the capability gate must honour that immediately.
 * hardwareConcurrency/deviceMemory (the low-end-device checks) cannot change
 * during a session, so no listener is needed for those — they get re-read
 * for free on every callback invocation triggered by the two listeners
 * above, since the callback just re-runs the same detect function.
 *
 * Resize events can fire dozens of times per second during a drag-resize;
 * they are coalesced onto requestAnimationFrame so the snapshot is re-read
 * at most once per frame rather than on every native event.
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  let rafId: number | null = null;
  const scheduleCallback = () => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      callback();
    });
  };
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("resize", scheduleCallback);
  reducedMotionQuery.addEventListener("change", scheduleCallback);
  return () => {
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", scheduleCallback);
    reducedMotionQuery.removeEventListener("change", scheduleCallback);
  };
}

/**
 * Hydration-safe, reactive read of detectEvidenceWorldCapability().
 * useSyncExternalStore is the supported way to surface a value that can
 * differ between the server render and the client (see React docs / ECC
 * react/hooks.md) without the "setState synchronously in an effect" pattern
 * the lint rule flags: React uses getServerSnapshot for both the SSR pass
 * and the client's first paint during hydration (so they always agree),
 * then re-reads the real client value immediately after — and, with the
 * real `subscribe` above (rather than a no-op), again whenever viewport
 * width or prefers-reduced-motion actually changes.
 */
export function useEvidenceWorldCapability(): boolean {
  return useSyncExternalStore(subscribe, detectEvidenceWorldCapability, getServerSnapshot);
}
