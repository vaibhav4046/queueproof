import type { Metadata } from "next";
import QueueProofApp from "./QueueProofApp";
import { loadWorkspaceView, type WorkspaceView } from "../lib/server/workspace-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QueueProof — One Answer. Every System. Proven.",
  description: "Cross-source answers with claim-level citations, contradiction tracking, latency, and cost evidence.",
};

/**
 * Resolve the shared workspace before any HTML is sent. Crawlers, slow clients,
 * and no-JS visitors receive the real public state instead of a boot placeholder.
 * Failures stay recoverable so the client can offer a retry.
 */
export default async function Home() {
  let initialView: WorkspaceView | null = null;
  let bootError: string | null = null;

  try {
    initialView = await loadWorkspaceView();
  } catch (error) {
    bootError =
      error instanceof Error
        ? error.message
        : "QueueProof could not determine the workspace state.";
  }

  return <QueueProofApp initialView={initialView} initialError={bootError} />;
}
