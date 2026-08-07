import type { Metadata } from "next";
import { LegalPage } from "../legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How QueueProof handles identity, source credentials, evidence, and MCP access.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="PRIVACY"
      title="Your evidence stays attached to your workspace."
      summary="QueueProof retrieves the minimum source context needed to answer a work question, keeps the supporting receipt, and makes missing proof visible."
      sections={[
        {
          title: "What QueueProof stores",
          body: <><p>QueueProof stores your account identity, workspace membership, connector state, source metadata, grounded answer receipts, priority packets, proposed changes, approval records, and product audit events. A shared public demo is kept separate from signed-in personal workspaces.</p><p>The browser also keeps a short, workspace-namespaced list of recent question text and provider labels on that device. It is cleared for that workspace when you sign out and can be removed one row at a time from History.</p></>,
        },
        {
          title: "Credentials and connected sources",
          body: <><p>Your HydraDB API key is encrypted at rest and is never returned to the browser after configuration. Provider credentials used to establish a HydraDB connector are sent to HydraDB for that connection flow and are not stored by QueueProof.</p><p>QueueProof only retrieves from connectors that have passed its resource-scope and data-verification checks.</p></>,
        },
        {
          title: "ChatGPT, Codex, Claude, and MCP",
          body: <p>When you connect an AI client, QueueProof verifies the bearer token, audience, scopes, expiry, and your workspace before a tool runs. Read access is the default. Proposed changes and source sync require separate scopes, and external provider execution still requires an owner approval in QueueProof.</p>,
        },
        {
          title: "Service providers",
          body: <p>QueueProof uses Auth0 for account authentication, HydraDB for connector indexing and retrieval, Turso/libSQL for durable application records, and Vercel for application hosting. Data sent to an AI client is also governed by that client provider&apos;s terms and privacy controls.</p>,
        },
        {
          title: "Your choices",
          body: <><p>You choose which sources to connect and which MCP scopes to grant. You can revoke QueueProof-issued MCP tokens from Connect AI.</p><p>QueueProof does not claim an automatic deletion window in this release. Workspace records remain until an implemented product flow deletes them or the verified publisher processes a supported request. Copies held by connected providers and AI clients follow those providers&apos; policies. For account-data access, correction, or deletion requests, use the <a href="/support">QueueProof support page</a>; ownership is verified before action.</p></>,
        },
      ]}
    />
  );
}
