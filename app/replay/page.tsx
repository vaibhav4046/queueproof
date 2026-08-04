import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Investigation replay",
  description: "Replay persisted retrieval events from a measured QueueProof run.",
};

export default function ReplayPage() {
  return <QueueProofRoute initialTab="replay" />;
}
