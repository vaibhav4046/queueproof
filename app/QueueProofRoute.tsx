import QueueProofApp, { type ActiveTab } from "./QueueProofApp";
import { loadWorkspaceView, type WorkspaceView } from "../lib/server/workspace-state";
import { headers } from "next/headers";

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

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "queueproof.vercel.app";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost) ? forwardedHost : "queueproof.vercel.app";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : safeHost.startsWith("127.0.0.1") || safeHost.startsWith("localhost") ? "http" : "https";
  const publicOrigin = `${protocol}://${safeHost}`;

  return <QueueProofApp initialView={initialView} initialError={bootError} initialTab={initialTab} publicOrigin={publicOrigin} />;
}
