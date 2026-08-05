import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Proof tests",
  description: "Expected-versus-observed QueueProof results with citations, latency, HydraDB calls, mode, and relative cost.",
};

export default function BenchmarksPage() {
  return <QueueProofRoute initialTab="lab" />;
}
