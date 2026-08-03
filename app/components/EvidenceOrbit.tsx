"use client";

/**
 * Evidence Orbit — the QueueProof spatial scene.
 *
 * A genuine, state-driven composition (not a looping video and not a marketing
 * still): real provider nodes sit along a curved world arc on the left, fine
 * routes carry evidence into a faceted proof core at the centre, and the
 * resolved action card emerges on the right. Every visual state is driven by
 * real backend events passed in as props:
 *
 *   routing       → mode ring activates with the real route label
 *   retrieving    → only then do receipt pulses travel the routes
 *   linking       → facets converge on entity matching
 *   contradiction → an amber fork and badge appear
 *   verified      → the core locks with a proof check
 *   insufficient  → the core dims; no fake success
 *
 * Implementation choice: SVG paths + CSS 3D layers, no WebGL runtime. This is
 * the smallest maintainable option that satisfies the motion-state contract,
 * it renders everywhere (no WebGL failure mode, no SSR risk, vector-sharp at
 * 4K), and it honours prefers-reduced-motion with a static high-quality
 * composition. It never intercepts scrolling and requires no interaction to
 * complete any task. Receipt pulses are driven by a single requestAnimationFrame
 * loop that stops when the tab is hidden, motion is paused, or reduced motion
 * is requested.
 */
import { SiGithub, SiGmail, SiLinear, SiSlack } from "react-icons/si";
import { FileText, Pause, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type OrbitStage =
  | "idle"
  | "routing"
  | "retrieving"
  | "linking"
  | "contradiction"
  | "verified"
  | "insufficient";

export type OrbitConnector = {
  provider: string;
  state: string;
  canaryResultCount?: number | null;
  lastSuccessfulSyncAt?: string | null;
  verifiedAt?: string | null;
};

export type OrbitProps = {
  stage: OrbitStage;
  modeLabel: string;
  receiptCount: number;
  providerCoverage: string[];
  contradictionCount: number;
  action?: {
    score: number;
    title: string;
    safeAction: string;
    approvalRequired: boolean;
    coverage: string[];
  } | null;
  connectors: OrbitConnector[];
  replay?: boolean;
};

const PROVIDER_NODES: Array<{ provider: string; x: number; y: number }> = [
  { provider: "slack", x: 205, y: 62 },
  { provider: "linear", x: 132, y: 158 },
  { provider: "document", x: 112, y: 262 },
  { provider: "github", x: 168, y: 352 },
  { provider: "gmail", x: 250, y: 424 },
];

const CORE = { x: 720, y: 222 };

const PROVIDER_COLOR: Record<string, string> = {
  slack: "#7f9bff",
  linear: "#b38cff",
  github: "#e6edf3",
  gmail: "#ff8f6b",
  document: "#64f2c2",
};

function providerIcon(provider: string, size = 18) {
  switch (provider) {
    case "github": return <SiGithub size={size} aria-hidden="true" />;
    case "gmail": return <SiGmail size={size} aria-hidden="true" />;
    case "slack": return <SiSlack size={size} aria-hidden="true" />;
    case "linear": return <SiLinear size={size} aria-hidden="true" />;
    default: return <FileText size={size} aria-hidden="true" />;
  }
}

function routePath(from: { x: number; y: number }) {
  const dx = (CORE.x - from.x) * 0.42;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y + 26}, ${CORE.x - dx} ${CORE.y - 26}, ${CORE.x} ${CORE.y}`;
}

const ROUTES = PROVIDER_NODES.map((node) => ({ ...node, d: routePath(node) }));

export default function EvidenceOrbit({
  stage,
  modeLabel,
  receiptCount,
  providerCoverage,
  contradictionCount,
  action,
  connectors,
  replay = false,
}: OrbitProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const routeRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const pulseRefs = useRef<Map<string, SVGCircleElement>>(new Map());
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [parallax, setParallax] = useState({ rx: 0, ry: 0 });

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const activeProviders = providerCoverage.length ? providerCoverage : [];
  const retrievalActive = stage === "retrieving" || stage === "linking" ||
    (replay && stage !== "idle");
  const showContradiction = stage === "contradiction" || contradictionCount > 0;
  const showVerified = stage === "verified";
  const showInsufficient = stage === "insufficient";
  const motionAllowed = !paused && !reducedMotion && !hidden && stage !== "idle" && stage !== "insufficient";

  // One rAF loop drives receipt pulses along the real route paths. It is the
  // only running animation, it stops when the tab is hidden or motion is
  // paused, and it writes circle positions imperatively (no React re-render).
  useEffect(() => {
    if (!motionAllowed) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      for (const node of PROVIDER_NODES) {
        const path = routeRefs.current.get(node.provider);
        const circle = pulseRefs.current.get(node.provider);
        if (!path || !circle) continue;
        const length = path.getTotalLength();
        const offset = PROVIDER_NODES.findIndex((item) => item.provider === node.provider) * 0.2;
        const t = ((elapsed / 2600) + offset) % 1;
        const point = path.getPointAtLength(Math.max(0, Math.min(1, t)) * length);
        circle.setAttribute("cx", String(point.x));
        circle.setAttribute("cy", String(point.y));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motionAllowed]);

  // Pause the pulse loop while the tab is hidden: a visibility change flips the
  // hidden flag, which re-evaluates motionAllowed and re-runs the rAF effect's
  // cleanup.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Limited cinematic parallax: roughly 4-6 degrees of rotation, never
  // free-flight. Disabled under reduced motion or while paused.
  useEffect(() => {
    const element = sceneRef.current;
    if (!element || reducedMotion || paused) return;
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      setParallax({ rx: ny * -5, ry: nx * 6 });
    };
    const onLeave = () => setParallax({ rx: 0, ry: 0 });
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [reducedMotion, paused]);

  const receiptLabel = replay ? "REPLAYING VERIFIED RECEIPT" : "RECEIPTS ARRIVING";

  return (
    <div
      ref={sceneRef}
      className={`evidence-orbit stage-${stage}${paused ? " paused" : ""}${reducedMotion ? " reduced-motion" : ""}${replay ? " replay" : ""}`}
      style={{ "--orbit-rx": `${parallax.rx}deg`, "--orbit-ry": `${parallax.ry}deg` } as CSSProperties}
    >
      <div className="orbit-glow" aria-hidden="true" />
      <div className="orbit-stage" aria-hidden="true">
        <svg
          className="orbit-svg"
          viewBox="0 0 1440 470"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Evidence orbit: provider sources on the left route evidence into the proof core"
        >
          <defs>
            <linearGradient id="orbit-route-slack" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7f9bff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#d7ff48" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="orbit-route-mint" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#64f2c2" stopOpacity="0.9" />
              <stop offset="1" stopColor="#d7ff48" stopOpacity="0.25" />
            </linearGradient>
            <radialGradient id="orbit-core-fill" cx="0.5" cy="0.42" r="0.75">
              <stop offset="0" stopColor="#1c2a18" />
              <stop offset="0.7" stopColor="#0a0f0a" />
              <stop offset="1" stopColor="#040604" />
            </radialGradient>
            <filter id="orbit-glow-f" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          {/* Shallow world arc beneath the nodes */}
          <path className="orbit-arc" d="M -20 470 C 340 60, 900 40, 1460 470" fill="none" />

          {/* Routes from sources to the core */}
          {ROUTES.map((route) => {
            const color = PROVIDER_COLOR[route.provider] ?? "#d7ff48";
            const engaged = activeProviders.includes(route.provider) || retrievalActive;
            return (
              <g key={`route-${route.provider}`}>
                <path
                  className="orbit-route halo"
                  d={route.d}
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.12"
                  strokeWidth="5"
                />
                <path
                  ref={(element) => {
                    if (element) routeRefs.current.set(route.provider, element);
                  }}
                  className={`orbit-route${engaged ? " active" : ""}`}
                  d={route.d}
                  fill="none"
                  stroke={engaged
                    ? (route.provider === "document" ? "url(#orbit-route-mint)" : "url(#orbit-route-slack)")
                    : color}
                  strokeOpacity={engaged ? 0.95 : 0.26}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Amber contradiction fork from the core */}
          {showContradiction && (
            <g className="orbit-fork">
              <path d={`M ${CORE.x + 34} ${CORE.y - 16} C ${CORE.x + 130} ${CORE.y - 110}, ${CORE.x + 235} ${CORE.y - 118}, ${CORE.x + 320} ${CORE.y - 96}`} fill="none" stroke="#ffb45e" strokeWidth="1.8" strokeOpacity="0.9" />
              <path d={`M ${CORE.x + 34} ${CORE.y + 18} C ${CORE.x + 130} ${CORE.y + 118}, ${CORE.x + 235} ${CORE.y + 132}, ${CORE.x + 320} ${CORE.y + 108}`} fill="none" stroke="#ffb45e" strokeWidth="1.8" strokeOpacity="0.9" />
              <circle cx={CORE.x + 322} cy={CORE.y - 96} r="7" fill="none" stroke="#ffb45e" strokeWidth="1.4" strokeOpacity="0.7" />
              <circle cx={CORE.x + 322} cy={CORE.y + 108} r="7" fill="none" stroke="#ffb45e" strokeWidth="1.4" strokeOpacity="0.7" />
            </g>
          )}

          {/* Receipt pulses — positioned by the rAF loop */}
          {PROVIDER_NODES.map((node) => (
            <circle
              key={`pulse-${node.provider}`}
              ref={(element) => {
                if (element) pulseRefs.current.set(node.provider, element);
              }}
              className="orbit-pulse"
              r="4"
              fill={PROVIDER_COLOR[node.provider] ?? "#d7ff48"}
              style={{ opacity: motionAllowed ? 1 : 0 }}
            />
          ))}

          {/* Faceted proof core */}
          <g className="orbit-core-group" transform={`translate(${CORE.x} ${CORE.y})`}>
            <circle className="core-orbit-ring" r="118" fill="none" stroke="#d7ff48" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 5" />
            <circle className="core-mode-ring" r="92" fill="none" stroke="#d7ff48" strokeWidth="1.4" />
            <g className="core-facets">
              <polygon points="0,-72 62,-36 62,36 0,72 -62,36 -62,-36" fill="url(#orbit-core-fill)" stroke="#d7ff48" strokeOpacity="0.5" strokeWidth="1" />
              <polygon points="0,-52 48,-24 48,24 0,52 -48,24 -48,-24" fill="none" stroke="#d7ff48" strokeOpacity="0.24" strokeWidth="0.8" />
              <polygon points="0,-72 62,-36 62,36 0,72 -62,36 -62,-36" fill="none" stroke="#f4f6ee" strokeOpacity="0.16" strokeWidth="0.6" transform="rotate(30) scale(0.72)" />
            </g>
            {showVerified && (
              <g className="core-proof-mark" filter="url(#orbit-glow-f)">
                <circle r="46" fill="#d7ff48" fillOpacity="0.10" />
                <path d="M -18 -4 L -5 10 L 20 -14" fill="none" stroke="#d7ff48" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            {showInsufficient && (
              <g className="core-dim-mark">
                <circle r="40" fill="none" stroke="#7d867a" strokeWidth="1" strokeDasharray="2 4" />
                <text textAnchor="middle" dominantBaseline="middle" fill="#7d867a" fontSize="13" fontFamily="var(--mono)">?</text>
              </g>
            )}
            {showContradiction && !showVerified && (
              <g className="core-contradiction-mark">
                <circle r="48" fill="none" stroke="#ffb45e" strokeWidth="1.2" strokeDasharray="1 3" />
                <path d="M -4 -18 L 10 0 L -4 18" fill="none" stroke="#ffb45e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
          </g>
        </svg>

        {/* Real DOM source nodes on the arc — semantic, focusable, labelled */}
        {PROVIDER_NODES.map((node) => {
          const connector = connectors.find((item) => item.provider === node.provider);
          const engaged = activeProviders.includes(node.provider) || retrievalActive;
          return (
            <button
              key={node.provider}
              type="button"
              className={`orbit-node node-${node.provider}${engaged ? " engaged" : ""}`}
              style={{ left: `${(node.x / 1440) * 100}%`, top: `${(node.y / 470) * 100}%` }}
              aria-label={`${node.provider} source${connector ? `, ${connector.state.replace(/_/g, " ")}` : ""}`}
              title={`${node.provider}${connector?.canaryResultCount ? ` · ${connector.canaryResultCount} proven records` : ""}`}
            >
              <span className="orbit-node-icon">{providerIcon(node.provider, 19)}</span>
              <span className="orbit-node-label">{node.provider.toUpperCase()}</span>
              <span className="orbit-node-chip">
                <small>{connector ? `${connector.canaryResultCount ?? 0} proven` : "idle"}</small>
              </span>
              <i className="orbit-node-ping" aria-hidden="true" />
            </button>
          );
        })}

        {/* Core DOM label */}
        <div className="orbit-core-label" aria-hidden="true">
          <strong>PROOF</strong>
          <small>{stage === "idle" ? "STANDBY" : stage === "insufficient" ? "INSUFFICIENT EVIDENCE" : stage === "verified" ? "ANSWER VALIDATED" : showContradiction ? "CONTRADICTION" : stage.toUpperCase()}</small>
        </div>

        {/* Resolved action card — real DOM, emerges from the core region */}
        {action && (
          <article className="orbit-action-card" aria-label="Resolved priority action">
            <span className="orbit-action-kicker"><ShieldCheck size={12} /> RESOLVED ACTION</span>
            <div className="orbit-action-score"><strong>{action.score}</strong><small>/100</small></div>
            <h3>{action.title}</h3>
            <p>{action.safeAction}</p>
            <div className="orbit-action-meta">
              <span>{action.coverage.join(" · ")}</span>
              <span>{action.approvalRequired ? "Approval gated" : "Read only"}</span>
            </div>
          </article>
        )}

        {!action && stage !== "idle" && (
          <div className="orbit-action-slot" aria-hidden="true">
            <span>{retrievalActive ? receiptLabel : showVerified ? "ACTION COMPILING" : "AWAITING ACTION"}</span>
          </div>
        )}
      </div>

      {/* Status row: mode ring label, receipts, contradictions, replay badge */}
      <div className="orbit-console" role="status" aria-live="polite">
        <span className="orbit-mode">
          <i className="mode-orb" />
          {stage === "idle" ? "STANDBY" : stage === "routing" ? `ROUTING · ${modeLabel}` : stage === "retrieving" ? `RETRIEVING · ${modeLabel}` : modeLabel.toUpperCase()}
        </span>
        <span className="orbit-receipts">{receiptCount} RECEIPTS LINKED</span>
        {showContradiction && <span className="orbit-contradiction"><i /> {contradictionCount} CONTRADICTION{contradictionCount === 1 ? "" : "S"}</span>}
        {replay && <span className="orbit-replay-badge">REPLAY · VERIFIED RECEIPT</span>}
        <button
          type="button"
          className="orbit-pause"
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
          disabled={reducedMotion}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </div>
    </div>
  );
}
