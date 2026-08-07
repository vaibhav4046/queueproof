import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("existing HydraDB connector import UI", () => {
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8");

  it("discovers account-scoped connectors only after an explicit owner action", () => {
    expect(app).toContain('onClick={() => setImportOpen(true)}');
    expect(app).toContain("Import existing");
    expect(app).toContain("{importOpen && <HydraConnectorImportDialog");
    expect(app).toContain('api<{ connectors: ExistingHydraConnector[] }>("/api/hydradb/connectors")');
    expect(app).toContain("This component is mounted only after the owner explicitly chooses Import existing.");
  });

  it("imports only revalidated connector identifiers and excludes existing rows", () => {
    expect(app).toContain("data.connectors.filter((connector) => !connector.imported)");
    expect(app).toContain("body: JSON.stringify({ connectorIds: selected })");
    expect(app).not.toContain("body: JSON.stringify({ connectorIds: selected, provider");
    expect(app).not.toContain("body: JSON.stringify({ connectorIds: selected, database");
    expect(app).toContain("await reloadConnectors();");
  });

  it("states the proof boundary before import and after success", () => {
    expect(app).toContain("Account access is not retrieval proof.");
    expect(app).toContain("choose an exact resource scope, sync it, and pass QueueProof’s canary check");
    expect(app).toContain("Imported connections will appear as <strong>Choose scope</strong>, never as verified.");
    expect(app).toContain("not your HydraDB key or provider credentials");
  });

  it("uses a labelled focus-trapped dialog and touch-safe controls", () => {
    expect(app).toContain('aria-labelledby="hydra-import-title"');
    expect(app).toContain('aria-describedby="hydra-import-description"');
    expect(app).toContain('role="dialog"');
    expect(app).toContain('aria-modal="true"');
    expect(app).toContain("useDialogBehavior<HTMLDivElement>(true, onClose)");
    expect(css).toMatch(/\.hydra-import-list > label \{[^}]*min-height:\s*72px/);
    expect(css).toMatch(/\.hydra-import-actions :is\(button\) \{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.hydra-import-toolbar button \{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/@media \(max-width:\s*760px\)[\s\S]*?\.hydra-import-modal \{[^}]*overflow-y:\s*auto/);
  });

  it("turns authentication, authorisation, and account conflicts into recovery copy", () => {
    expect(app).toContain("reason.status === 401");
    expect(app).toContain("reason.status === 403");
    expect(app).toContain("reason.status === 409");
    expect(app).toContain("Nothing was imported.");
    expect(app).toContain('role="alert"');
  });
});
