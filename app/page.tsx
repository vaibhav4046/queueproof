import type { Metadata } from "next";
import { testModeEnabled } from "../lib/server/runtime";
import { QueueProofApp } from "./QueueProofApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command — Know What Moves Next",
  description:
    "Turn explicit commitments into one defensible next action, ranked by visible policy and backed by source-level evidence.",
};

export default function Home() {
  return <QueueProofApp testMode={testModeEnabled()} />;
}
