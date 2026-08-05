import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Today",
  description: "A focused list of incidents, promises, deadlines, and work that needs a decision.",
};

export default function QueuePage() {
  return <QueueProofRoute initialTab="command" />;
}
