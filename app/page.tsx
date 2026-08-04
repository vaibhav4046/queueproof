import type { Metadata } from "next";
import QueueProofRoute from "./QueueProofRoute";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QueueProof — One Answer. Every System. Proven.",
  description: "Cross-source answers with claim-level citations, contradiction tracking, latency, and cost evidence.",
};

/**
 * Resolve the shared workspace before any HTML is sent. Crawlers, slow clients,
 * and no-JS visitors receive the real public state instead of a boot placeholder.
 * Failures stay recoverable so the client can offer a retry.
 */
export default async function Home() {
  return <QueueProofRoute initialTab="ask" />;
}
