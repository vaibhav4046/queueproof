"use client";

/**
 * Evidence Graph — a deterministic, non-physics rendering of an EvidenceGraph
 * (packages/graph/src): sources on the left, claims and contradictions in the
 * middle, tasks and their resolved actions on the right. Nodes are grouped by
 * type into columns and stacked top to bottom within a column — the same
 * "fixed coordinates, no layout library" approach as EvidenceOrbit's
 * PROVIDER_NODES, just laid out left-to-right instead of along a fixed arc.
 *
 * Reused from EvidenceOrbit: a hydration-safe reduced-motion subscription,
 * a visibilitychange-driven pause, an SVG with role="img"/aria-label carrying
 * the edges, real focusable DOM buttons for every node, and a
 * role="status" aria-live="polite" summary row. There is no continuous
 * per-frame animation here (no traveling receipts to position imperatively),
 * so edge motion is a single declarative CSS keyframe instead of an
 * EvidenceOrbit-style requestAnimationFrame loop — restrained further than
 * the orbit, and it still respects the same two pause signals.
 */
import { AlertTriangle, ArrowUpRight, Link2, MessageSquareQuote, Target } from "lucide-react";
import { useMemo, useState, useEffect, type CSSProperties } from "react";
import type { EvidenceGraph as EvidenceGraphData, GraphNode, GraphNodeType } from "../../packages/graph/src";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type EvidenceGraphProps = { graph: EvidenceGraphData };

// "approval"/"receipt" are exported node types (packages/graph/src) but are not
// yet wired into GET /api/graph — deriveGraphFromActionProposal needs a joined
// action_proposals/action_approvals/action_executions query the route doesn't
// run yet (see ARCHITECTURE.md "Evidence graph"). They are deliberately left out
// of COLUMN_ORDER: this component renders one label per column unconditionally,
// so including a type that can never have nodes today would show a permanently
// empty column — exactly the decorative-graph failure mode this project refuses
// to ship. Add them here once the route actually derives them.
const COLUMN_ORDER: GraphNodeType[] = ["connector", "source", "claim", "contradiction", "task", "action"];
const COLUMN_LABEL: Record<GraphNodeType, string> = {
  source: "Sources",
  claim: "Claims",
  contradiction: "Contradictions",
  task: "Tasks",
  action: "Actions",
  connector: "Connectors",
  approval: "Approvals",
  receipt: "Receipts",
};

const VIEW_WIDTH = 1160;
const COLUMN_GAP = VIEW_WIDTH / (COLUMN_ORDER.length - 1);
const ROW_HEIGHT = 76;
const TOP_PADDING = 46;
const BOTTOM_PADDING = 30;

type LaidOutNode = GraphNode & { x: number; y: number };

function nodeIcon(type: GraphNodeType, size = 15) {
  switch (type) {
    case "source": return <Link2 size={size} aria-hidden="true" />;
    case "claim": return <MessageSquareQuote size={size} aria-hidden="true" />;
    case "contradiction": return <AlertTriangle size={size} aria-hidden="true" />;
    case "action": return <ArrowUpRight size={size} aria-hidden="true" />;
    default: return <Target size={size} aria-hidden="true" />;
  }
}

function routeBetween(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = (to.x - from.x) * 0.45;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

export default function EvidenceGraphView({ graph }: EvidenceGraphProps) {
  const [hidden, setHidden] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const motionAllowed = !reducedMotion && !hidden;

  const { nodes, viewHeight } = useMemo(() => {
    const byColumn = new Map<GraphNodeType, GraphNode[]>(COLUMN_ORDER.map((type) => [type, []]));
    for (const node of graph.nodes) byColumn.get(node.type)?.push(node);
    const maxRows = Math.max(1, ...COLUMN_ORDER.map((type) => byColumn.get(type)?.length ?? 0));
    const height = TOP_PADDING + maxRows * ROW_HEIGHT + BOTTOM_PADDING;

    const laidOut: LaidOutNode[] = [];
    COLUMN_ORDER.forEach((type, columnIndex) => {
      const column = byColumn.get(type) ?? [];
      const columnHeight = column.length * ROW_HEIGHT;
      const columnTop = TOP_PADDING + (height - TOP_PADDING - BOTTOM_PADDING - columnHeight) / 2;
      column.forEach((node, rowIndex) => {
        laidOut.push({
          ...node,
          x: columnIndex * COLUMN_GAP,
          y: columnTop + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
        });
      });
    });
    return { nodes: laidOut, viewHeight: height };
  }, [graph.nodes]);

  const positionById = useMemo(() => new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }])), [nodes]);

  const isEmpty = graph.nodes.length === 0;

  return (
    <div className={`evidence-graph${motionAllowed ? "" : " reduced-motion"}`}>
      {isEmpty ? (
        <div className="honest-empty">
          <Link2 size={24} />
          <div>
            <strong>No evidence graph yet.</strong>
            <p>Generate a queue with at least one grounded task to see sources, claims, and contradictions linked together.</p>
          </div>
        </div>
      ) : (
        <div className="evidence-graph-canvas" style={{ aspectRatio: `${VIEW_WIDTH} / ${viewHeight}` }}>
          <svg
            className="evidence-graph-svg"
            viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Evidence graph: sources supporting claims and tasks, with contradictions flagged where evidence disagrees"
          >
            {graph.edges.map((edge) => {
              const from = positionById.get(edge.source);
              const to = positionById.get(edge.target);
              if (!from || !to) return null;
              return (
                <path
                  key={edge.id}
                  className={`evidence-graph-edge edge-${edge.type.toLowerCase()}`}
                  d={routeBetween(from, to)}
                  fill="none"
                />
              );
            })}
          </svg>

          {COLUMN_ORDER.map((type, columnIndex) => (
            <span
              key={`label-${type}`}
              className="evidence-graph-column-label"
              style={{ left: `${(columnIndex * COLUMN_GAP / VIEW_WIDTH) * 100}%` }}
            >
              {COLUMN_LABEL[type]}
            </span>
          ))}

          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`evidence-graph-node node-${node.type}`}
              style={{ left: `${(node.x / VIEW_WIDTH) * 100}%`, top: `${(node.y / viewHeight) * 100}%` } as CSSProperties}
              aria-label={`${node.type}: ${node.label}`}
              title={node.label}
            >
              <span className="evidence-graph-node-icon">{nodeIcon(node.type)}</span>
              <span className="evidence-graph-node-label">{node.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="evidence-graph-status" role="status" aria-live="polite">
        <span>{graph.nodes.length} NODE{graph.nodes.length === 1 ? "" : "S"}</span>
        <span>{graph.edges.length} EDGE{graph.edges.length === 1 ? "" : "S"}</span>
        {graph.nodes.some((node) => node.type === "contradiction") && (
          <span className="evidence-graph-contradiction-flag">
            <AlertTriangle size={12} />
            {graph.nodes.filter((node) => node.type === "contradiction").length} CONTRADICTION
            {graph.nodes.filter((node) => node.type === "contradiction").length === 1 ? "" : "S"}
          </span>
        )}
      </div>
    </div>
  );
}
