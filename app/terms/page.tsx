import type { Metadata } from "next";
import { LegalPage } from "../legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms for using the QueueProof evidence workspace and MCP plugin.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="TERMS"
      title="Proof before action."
      summary="These terms cover the QueueProof website, public demo, personal workspaces, APIs, and MCP tools."
      sections={[
        {
          title: "Use of QueueProof",
          body: <p>You may use QueueProof to retrieve and organize information you are authorized to access. You are responsible for the sources, credentials, content, and client connections you add to your workspace.</p>,
        },
        {
          title: "Evidence is assistance, not authority",
          body: <p>QueueProof is designed to cite support and abstain when proof is insufficient, but retrieval and source data can still be incomplete or wrong. Review source receipts before relying on an answer or proposed change.</p>,
        },
        {
          title: "Changes require approval",
          body: <p>MCP proposal tools do not directly execute provider writes. Any enabled external change remains subject to QueueProof&apos;s owner review, evidence validation, provider configuration, and at-most-once execution controls.</p>,
        },
        {
          title: "Acceptable use",
          body: <p>Do not use QueueProof to access another person&apos;s workspace, bypass provider permissions, exfiltrate credentials, send harmful instructions, or violate applicable law or third-party terms. Automated probing that harms availability is not permitted.</p>,
        },
        {
          title: "Availability and changes",
          body: <p>The service is provided on an as-available basis and may change while the product evolves. Material changes to these terms will be reflected on this page with a new effective date.</p>,
        },
      ]}
    />
  );
}
