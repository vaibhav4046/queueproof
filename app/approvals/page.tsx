import type { Metadata } from "next";
import QueueProofRoute from "../QueueProofRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review changes",
  description: "Review evidence-linked actions before any external write.",
};

export default function ApprovalsPage() {
  return <QueueProofRoute initialTab="approvals" />;
}
