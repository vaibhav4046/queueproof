import type { Metadata } from "next";
import OwnerSignIn from "./OwnerSignIn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner access — QueueProof",
  description: "Authenticate to manage QueueProof connectors, documents, approvals, and agent credentials.",
  robots: { index: false, follow: false },
};

export default function OwnerPage() {
  return <OwnerSignIn />;
}

