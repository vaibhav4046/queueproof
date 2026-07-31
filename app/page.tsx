import type { Metadata } from "next";
import QueueProofApp from "./QueueProofApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QueueProof — Evidence-Ranked Execution",
  description: "Connect workplace evidence, rank the real work, and hand agents cited execution packets.",
};

export default function Home() {
  return <QueueProofApp />;
}
