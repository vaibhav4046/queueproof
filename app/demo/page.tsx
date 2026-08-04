import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Live proof demo",
  description: "Run QueueProof's judge-safe cross-source investigation without account friction.",
};

export default function DemoPage() {
  return <QueueProofRoute initialTab="ask" />;
}
