import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, FileCheck2, Network, Route } from "lucide-react";
import { ShaderBackground } from "../components/ui/red-plasma";
import { QueueProofLogo } from "../components/QueueProofLogo";

export const metadata: Metadata = {
  title: "How QueueProof works",
  description: "A plain-language guide to how QueueProof searches, compares, cites, and recommends the next safe action.",
};

const steps = [
  ["01", "Verify the sources", "A source counts only after HydraDB returns attributable records and QueueProof stores the proof receipt."],
  ["02", "Choose the route", "Direct facts use Quick. Cross-source, timeline, conflict, and changed-information questions use Investigate."],
  ["03", "Search and follow the evidence", "Investigate preserves a Quick grounded baseline, then uses identifiers from those results for one bounded follow-up search."],
  ["04", "Compare the proof", "QueueProof matches people and projects, orders dated records, preserves conflicts, and ignores instruction-shaped source text."],
  ["05", "Cite or abstain", "Every supported claim opens to a receipt. Missing proof produces a partial result or an explicit abstention."],
  ["06", "Recommend the next safe action", "The action is linked to evidence, ranked by a versioned policy, and any external write remains approval-gated."],
];

export default function MethodPage() {
  return <div className="method-page">
    <div className="ambient-field" aria-hidden="true"><ShaderBackground className="evidence-field-canvas" /></div>
    <header className="method-header"><Link href="/" className="method-brand"><QueueProofLogo /></Link><nav aria-label="Public pages"><Link href="/">Ask</Link><Link href="/benchmarks">Benchmarks</Link><Link href="/replay">Replay</Link></nav></header>
    <main id="main-content">
      <section className="method-hero"><span className="eyebrow"><Route size={13} /> How QueueProof reached the answer</span><h1>Search every source.<br /><em>Show every receipt.</em></h1><p>QueueProof does not ask you to trust an unexplained answer. It records the route, the HydraDB calls, the retained evidence, the conflicts, and the exact basis for the next action.</p><div><Link className="primary-button" href="/demo">Run the proof <ArrowRight size={13} /></Link><Link className="secondary-button" href="/benchmarks">Inspect measured results</Link></div></section>
      <section className="method-steps" aria-label="Verification method">{steps.map(([number, title, body]) => <article key={number}><small>{number}</small><div><h2>{title}</h2><p>{body}</p></div></article>)}</section>
      <section className="method-boundaries"><article><CircleCheck size={20} /><div><h2>QueueProof can say</h2><ul><li>Verified, with supporting receipts.</li><li>Contradicted, with the disagreement preserved.</li><li>Partially verified, with the missing facts named.</li></ul></div></article><article><CircleAlert size={20} /><div><h2>QueueProof refuses to say</h2><ul><li>A source is healthy without a real record check.</li><li>A claim is supported when its citation cannot resolve.</li><li>An external action happened without a provider response receipt.</li></ul></div></article></section>
      <section className="method-receipt"><Network size={22} /><div><span className="eyebrow">One reproducible receipt</span><h2>Mode · route reason · filters · calls · latency · evidence · relative cost</h2><p>Fixture, live connector, and large-PDF measurements stay separate so a deterministic router score cannot be mistaken for live retrieval accuracy.</p></div><FileCheck2 size={28} /></section>
    </main>
    <footer className="method-footer"><span>Ask what happened. See the evidence. Know what to do next.</span><Link href="/">QueueProof home <ArrowRight size={12} /></Link></footer>
  </div>;
}
