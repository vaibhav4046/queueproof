"use client";

/**
 * Evidence Orbit renders a persisted backend receipt or one exact event from
 * that receipt. It never invents progress: while a synchronous request is in
 * flight the scene says that it is waiting, and provider nodes remain idle.
 */
import { SiGithub, SiGmail, SiLinear, SiSlack } from "react-icons/si";
import { FileText, ShieldCheck } from "lucide-react";
import type { LiveProofState, ProviderActivity, WorkflowStage } from "../../packages/contracts/src";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type OrbitConnector = {
  provider: string;
  state: string;
  canaryResultCount?: number | null;
  lastSuccessfulSyncAt?: string | null;
  verifiedAt?: string | null;
};

export type OrbitProps = {
  state: LiveProofState | null;
  connectors: OrbitConnector[];
  waitingForReceipt?: boolean;
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

const STAGE_LABEL: Record<WorkflowStage, string> = {
  idle: "Ready for a question",
  routing: "Route recorded",
  retrieving: "Provider response recorded",
  linking: "Evidence lineage linked",
  "checking-contradictions": "Contradictions checked",
  validating: "Claim support validated",
  "compiling-action": "Safe action compiled",
  "awaiting-approval": "Awaiting explicit approval",
  executing: "Approved execution recorded",
  complete: "Verified answer ready",
  partial: "Partial evidence returned",
  abstained: "Answer withheld",
  failed: "Workflow failed",
};

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
const queried = (activity?: ProviderActivity) => Boolean(activity && activity.status !== "idle" && activity.status !== "not-required");

export default function EvidenceOrbit({
  state,
  connectors,
  waitingForReceipt = false,
  replay = false,
}: OrbitProps) {
  const reducedMotion = usePrefersReducedMotion();
  const stage: WorkflowStage = state?.stage ?? "idle";
  const activityByProvider = new Map(state?.providers.map((activity) => [activity.provider, activity]) ?? []);
  const showContradiction = Boolean(state?.contradictions.length);
  const showVerified = stage === "complete";
  const showInsufficient = stage === "partial" || stage === "abstained" || stage === "failed";
  const action = state?.priorityItems[0] ?? null;
  const receiptCount = state?.providers.reduce((total, item) => total + item.receiptCount, 0) ?? 0;
  const modeLabel = state?.mode === "thinking" ? "Investigate" : state?.mode === "fast" ? "Quick" : "Best";

  return (
    <div className={`evidence-orbit stage-${stage}${reducedMotion ? " reduced-motion" : ""}${replay ? " replay" : ""}`}>
      <div className="orbit-glow" aria-hidden="true" />
      <div className="orbit-story-head" aria-hidden="true"><span>01 · Sources</span><i /><span>02 · Answer</span><i /><span>03 · Next step</span></div>
      <div className="orbit-stage">
        <svg className="orbit-svg" viewBox="0 0 1440 470" preserveAspectRatio="xMidYMid meet" role="img"
          aria-label="Verified receipt map: queried sources feed the evidence graph and approval-gated next step">
          <defs>
            <linearGradient id="orbit-route-slack" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7f9bff" stopOpacity="0.9" /><stop offset="1" stopColor="#d7ff48" stopOpacity="0.25" /></linearGradient>
            <linearGradient id="orbit-route-mint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#64f2c2" stopOpacity="0.9" /><stop offset="1" stopColor="#d7ff48" stopOpacity="0.25" /></linearGradient>
            <radialGradient id="orbit-core-fill" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stopColor="#1c2a18" /><stop offset="0.7" stopColor="#0a0f0a" /><stop offset="1" stopColor="#040604" /></radialGradient>
            <filter id="orbit-glow-f" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          <path className="orbit-arc" d="M -20 470 C 340 60, 900 40, 1460 470" fill="none" />
          {ROUTES.map((route) => {
            const color = PROVIDER_COLOR[route.provider] ?? "#d7ff48";
            const activity = activityByProvider.get(route.provider);
            const engaged = queried(activity);
            return <g key={`route-${route.provider}`}>
              <path className="orbit-route halo" d={route.d} fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="5" />
              <path className={`orbit-route${engaged ? " active" : ""}`} d={route.d} fill="none"
                stroke={engaged ? (route.provider === "document" ? "url(#orbit-route-mint)" : "url(#orbit-route-slack)") : color}
                strokeOpacity={engaged ? 0.95 : 0.2} strokeWidth="1.6" strokeLinecap="round" />
              {Boolean(activity?.receiptCount) && <circle className="orbit-pulse receipt-position" cx={CORE.x - 34} cy={CORE.y} r="4" fill={color} />}
            </g>;
          })}
          {showContradiction && <g className="orbit-fork">
            <path d={`M ${CORE.x + 34} ${CORE.y - 16} C ${CORE.x + 130} ${CORE.y - 110}, ${CORE.x + 235} ${CORE.y - 118}, ${CORE.x + 320} ${CORE.y - 96}`} fill="none" stroke="#ffb45e" strokeWidth="1.8" strokeOpacity="0.9" />
            <path d={`M ${CORE.x + 34} ${CORE.y + 18} C ${CORE.x + 130} ${CORE.y + 118}, ${CORE.x + 235} ${CORE.y + 132}, ${CORE.x + 320} ${CORE.y + 108}`} fill="none" stroke="#ffb45e" strokeWidth="1.8" strokeOpacity="0.9" />
          </g>}
          <g className="orbit-core-group" transform={`translate(${CORE.x} ${CORE.y})`}>
            <circle className="core-orbit-ring" r="118" fill="none" stroke="#d7ff48" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 5" />
            <circle className="core-mode-ring" r="92" fill="none" stroke="#d7ff48" strokeWidth="1.4" />
            <g className="core-facets">
              <polygon points="0,-72 62,-36 62,36 0,72 -62,36 -62,-36" fill="url(#orbit-core-fill)" stroke="#d7ff48" strokeOpacity="0.5" strokeWidth="1" />
              <polygon points="0,-52 48,-24 48,24 0,52 -48,24 -48,-24" fill="none" stroke="#d7ff48" strokeOpacity="0.24" strokeWidth="0.8" />
            </g>
            {showVerified && <g className="core-proof-mark" filter="url(#orbit-glow-f)"><circle r="46" fill="#d7ff48" fillOpacity="0.10" /><path d="M -18 -4 L -5 10 L 20 -14" fill="none" stroke="#d7ff48" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>}
            {showInsufficient && <g className="core-dim-mark"><circle r="40" fill="none" stroke="#7d867a" strokeWidth="1" strokeDasharray="2 4" /><text textAnchor="middle" dominantBaseline="middle" fill="#7d867a" fontSize="13" fontFamily="var(--mono)">?</text></g>}
          </g>
        </svg>

        {PROVIDER_NODES.map((node) => {
          const connector = connectors.find((item) => item.provider === node.provider);
          const activity = activityByProvider.get(node.provider);
          const engaged = queried(activity);
          const status = activity?.status ?? (connector ? "not queried" : "not connected");
          return <button key={node.provider} type="button" className={`orbit-node node-${node.provider}${engaged ? " engaged" : ""}`}
            style={{ left: `${(node.x / 1440) * 100}%`, top: `${(node.y / 470) * 100}%` }}
            aria-label={`${node.provider} source, ${status}, ${activity?.receiptCount ?? 0} returned receipts`}
            title={`${node.provider} · ${status}`}>
            <span className="orbit-node-icon">{providerIcon(node.provider, 19)}</span>
            <span className="orbit-node-label">{node.provider[0].toUpperCase() + node.provider.slice(1)}</span>
            <span className="orbit-node-chip"><small>{engaged ? `${activity?.receiptCount ?? 0} returned · ${status}` : status}</small></span>
            {engaged && <i className="orbit-node-ping" aria-hidden="true" />}
          </button>;
        })}

        <div className="orbit-core-label" aria-hidden="true"><strong>ANSWER</strong><small>{waitingForReceipt ? "Waiting for receipt" : STAGE_LABEL[stage]}</small></div>

        {action && <article className="orbit-action-card" aria-label="Evidence-linked priority action">
          <span className="orbit-action-kicker"><ShieldCheck size={12} /> NEXT SAFE ACTION</span>
          <div className="orbit-action-score"><strong>{action.score}</strong><small>/100</small></div>
          <h3>{action.title}</h3><p>{action.recommended_next_safe_action}</p>
          <div className="orbit-action-meta"><span>{action.provider_coverage.join(" · ")}</span><span>{action.approval_required ? "Needs approval" : "Read only"}</span></div>
        </article>}
        {!action && <div className="orbit-action-slot" aria-hidden="true"><span>{waitingForReceipt ? "No live stages are simulated" : state ? "No evidence-linked action" : "Ask a question to begin"}</span></div>}
      </div>

      <div className="orbit-console" role="status" aria-live="polite">
        <span className="orbit-mode"><i className="mode-orb" />{waitingForReceipt ? "Waiting for verified backend receipt" : STAGE_LABEL[stage]}{state ? ` · ${modeLabel}` : ""}</span>
        <span className="orbit-receipts">{receiptCount} returned receipt{receiptCount === 1 ? "" : "s"}</span>
        {showContradiction && <span className="orbit-contradiction"><i /> {state?.contradictions.length} source conflict{state?.contradictions.length === 1 ? "" : "s"}</span>}
        {state && <span>{state.graph.nodes.length} graph nodes · {state.graph.edges.length} links</span>}
        {replay && <span className="orbit-replay-badge">Verified receipt replay</span>}
        {state && !replay && <span className="orbit-replay-badge">Verified backend receipt</span>}
      </div>
    </div>
  );
}
