import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "History",
  description: "Return to recent questions and open recorded proof-test replays.",
};

export default function ReplayPage() {
  return <QueueProofRoute initialTab="replay" />;
}
