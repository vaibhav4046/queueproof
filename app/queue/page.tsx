import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Priority queue",
  description: "Evidence-ranked work with receipts, constraints, and the next safe action.",
};

export default function QueuePage() {
  return <QueueProofRoute initialTab="command" />;
}
