import type { Metadata } from "next";
import QueueProofRoute from "./QueueProofRoute";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QueueProof — Ask your work. Get the proof.",
  description: "Ask across Slack, Gmail, Linear, GitHub, and files. Get one clear answer, open every source, see what disagrees, and know what to do next.",
};

/**
 * Resolve the shared workspace before any HTML is sent. Crawlers, slow clients,
 * and no-JS visitors receive the real public state instead of a boot placeholder.
 * Failures stay recoverable so the client can offer a retry.
 */
export default async function Home() {
  return <QueueProofRoute initialTab="ask" />;
}
