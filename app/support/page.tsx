import type { Metadata } from "next";
import { LegalPage } from "../legal/LegalPage";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with QueueProof accounts, sources, evidence receipts, and MCP connections.",
};

export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="SUPPORT"
      title="Bring the receipt. We’ll trace the boundary."
      summary="Start with the exact screen, query receipt, connector state, or MCP error. Never send an API key, access token, password, or raw private source record."
      sections={[
        {
          title: "Account and sign-in",
          body: <p>Use <a href="/sign-in">QueueProof sign in</a> for a personal workspace. If authentication fails, include the time, browser, and visible error—but never a session cookie, authorization code, client secret, or screenshot containing private history.</p>,
        },
        {
          title: "Sources and retrieval",
          body: <p>For connector help, include the provider name, QueueProof connector state, last proof time, and the non-secret connector ID. For an answer issue, include the QueueProof query receipt ID and expected fact, not the underlying private message or email.</p>,
        },
        {
          title: "ChatGPT, Codex, and Claude",
          body: <p>Follow the <a href="/developer">Connect AI guide</a>. Include the client name, exact MCP error, requested scope, and whether OAuth or a QueueProof-issued token was used. Revoke any credential that was accidentally exposed.</p>,
        },
        {
          title: "Contact the publisher",
          body: <p>Contact the QueueProof publisher through the public <a href="https://github.com/vaibhav4046" target="_blank" rel="noreferrer">GitHub profile</a>. Include a short reproduction and the non-secret receipt identifiers above. Security-sensitive reports should describe impact without publishing exploit details.</p>,
        },
      ]}
    />
  );
}
