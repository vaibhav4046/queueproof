"use client";

import { AlertTriangle, ArrowUpRight, Link2, MessageSquareQuote, Target } from "lucide-react";
import { useMemo } from "react";
import type { EvidenceGraph as EvidenceGraphData, GraphNodeType } from "../../packages/graph/src";

export type EvidenceGraphProps = { graph: EvidenceGraphData };

const GROUP_ORDER: GraphNodeType[] = [
  "source", "claim", "contradiction", "task", "action", "approval", "receipt", "connector",
];

const GROUP_LABEL: Record<GraphNodeType, string> = {
  source: "Receipts",
  claim: "Facts",
  contradiction: "Conflicts",
  task: "Work",
  action: "Next steps",
  connector: "Connected apps",
  approval: "Approvals",
  receipt: "Receipts",
};

function nodeIcon(type: GraphNodeType, size = 15) {
  switch (type) {
    case "source": return <Link2 size={size} aria-hidden="true" />;
    case "claim": return <MessageSquareQuote size={size} aria-hidden="true" />;
    case "contradiction": return <AlertTriangle size={size} aria-hidden="true" />;
    case "action": return <ArrowUpRight size={size} aria-hidden="true" />;
    default: return <Target size={size} aria-hidden="true" />;
  }
}

/**
 * A readable relationship ledger derived from the graph contract. It keeps the
 * source-to-claim links inspectable without turning evidence into a decorative,
 * animated network that becomes illegible at small widths.
 */
export default function EvidenceGraphView({ graph }: EvidenceGraphProps) {
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const groups = useMemo(() => GROUP_ORDER
    .map((type) => ({ type, nodes: graph.nodes.filter((node) => node.type === type) }))
    .filter((group) => group.nodes.length > 0), [graph.nodes]);

  if (!graph.nodes.length) {
    return <div className="evidence-graph relationship-ledger">
      <div className="honest-empty">
        <Link2 size={24} />
        <div><strong>No relationship map yet.</strong><p>Build a priority queue to connect receipts, facts, work, and next steps.</p></div>
      </div>
    </div>;
  }

  return (
    <div className="evidence-graph relationship-ledger">
      <div className="relationship-groups" aria-label="Evidence relationships">
        {groups.map(({ type, nodes }) => <section key={type}>
          <header><span>{nodeIcon(type, 14)} {GROUP_LABEL[type]}</span><small>{nodes.length}</small></header>
          <div>{nodes.map((node) => {
            const outgoing = graph.edges
              .filter((edge) => edge.source === node.id)
              .map((edge) => nodeById.get(edge.target)?.label)
              .filter((label): label is string => Boolean(label));
            return <article key={node.id} className={`relationship-item node-${node.type}`}>
              <strong>{node.label}</strong>
              {outgoing.length > 0 && <span>Links to {outgoing.slice(0, 2).join(" · ")}{outgoing.length > 2 ? ` +${outgoing.length - 2}` : ""}</span>}
            </article>;
          })}</div>
        </section>)}
      </div>

      <div className="evidence-graph-status">
        <span>{graph.nodes.length} item{graph.nodes.length === 1 ? "" : "s"}</span>
        <span>{graph.edges.length} link{graph.edges.length === 1 ? "" : "s"}</span>
        {graph.nodes.some((node) => node.type === "contradiction") && (
          <span className="evidence-graph-contradiction-flag"><AlertTriangle size={12} />
            {graph.nodes.filter((node) => node.type === "contradiction").length} conflict
            {graph.nodes.filter((node) => node.type === "contradiction").length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
