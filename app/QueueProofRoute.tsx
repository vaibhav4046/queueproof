import QueueProofApp, { type ActiveTab } from "./QueueProofApp";
import { loadWorkspaceView, type WorkspaceView } from "../lib/server/workspace-state";

export default async function QueueProofRoute({ initialTab = "ask" }: { initialTab?: ActiveTab }) {
  let initialView: WorkspaceView | null = null;
  let bootError: string | null = null;

  try {
    initialView = await loadWorkspaceView();
  } catch (error) {
    bootError = error instanceof Error
      ? error.message
      : "QueueProof could not determine the workspace state.";
  }

  return <QueueProofApp initialView={initialView} initialError={bootError} initialTab={initialTab} />;
}
