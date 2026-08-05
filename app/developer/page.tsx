import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Connect AI",
  description: "Connect QueueProof through MCP and inspect its integration contract.",
};

export default function DeveloperPage() {
  return <QueueProofRoute initialTab="agent" />;
}
