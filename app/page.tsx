import type { Metadata } from "next";
import { testModeEnabled } from "../lib/server/runtime";
import { QueueProofApp } from "./QueueProofApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command",
  description:
    "A defensible next action, ranked deterministically and backed by source-level evidence.",
};

export default function Home() {
  return <QueueProofApp testMode={testModeEnabled()} />;
}

