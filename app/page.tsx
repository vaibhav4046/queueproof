import type { Metadata } from "next";
import QueueProofApp from "./QueueProofApp";
import { loadWorkspaceView, type WorkspaceView } from "../lib/server/workspace-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QueueProof — Evidence-Ranked Execution",
  description: "Connect workplace evidence, rank the real work, and hand agents cited execution packets.",
};

/**
 * Server component: resolve which screen the user needs before any HTML is sent.
 *
 * This page previously rendered the client component directly, so the served HTML always
 * contained the boot screen and the real state was only decided after hydration and a
 * round trip. Anything that could not run that round trip — a crawler, a no-JS client, a
 * stalled request — was left on "Establishing workspace trust boundary…" permanently.
 *
 * A failure here is passed down as a recoverable error rather than thrown, so the user
 * gets a retry instead of a framework error page.
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
