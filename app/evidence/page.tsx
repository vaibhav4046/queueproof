import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Evidence sources",
  description: "Verified connector receipts, document ingestion, and source health.",
};

export default function EvidencePage() {
  return <QueueProofRoute initialTab="sources" />;
}
