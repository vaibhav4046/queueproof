import { describe, expect, it } from "vitest";
import { accessibleHydraConnectors } from "../lib/server/hydradb-connectors";

describe("existing HydraDB connector discovery", () => {
  it("normalises only the published non-secret connector fields", () => {
    expect(accessibleHydraConnectors({
      data: {
        connectors: [{
          connector_id: "hydra-slack-1",
          provider: "Slack",
          name: "Product Slack",
          database: "work",
          collection: "product",
          provider_account_scope: "workspace:T123",
          auth_type: "oauth",
          status: "active",
          sync_status: "complete",
          last_successful_sync_at: "2026-08-07T10:00:00Z",
          credential_ref: "must-never-leave-hydradb",
          tenant_id: "private-upstream-tenant",
        }],
      },
    })).toEqual([{
      hydradbConnectorId: "hydra-slack-1",
      provider: "slack",
      name: "Product Slack",
      database: "work",
      collection: "product",
      accountScope: "workspace:T123",
      authType: "oauth",
      upstreamStatus: "active",
      upstreamSyncStatus: "complete",
      lastSuccessfulSyncAt: "2026-08-07T10:00:00Z",
      lastError: null,
    }]);
  });

  it("drops malformed records instead of filling identity fields from caller data", () => {
    expect(accessibleHydraConnectors({ connectors: [
      { connector_id: "missing-provider", database: "work" },
      { connector_id: "missing-database", provider: "slack" },
      { provider: "slack", database: "work" },
    ] })).toEqual([]);
  });

  it("deduplicates by HydraDB connector identity and redacts upstream errors", () => {
    const connectors = accessibleHydraConnectors({ items: [
      {
        connector_id: "hydra-gmail-1",
        provider: "gmail",
        database: "work",
        last_error: "Authorization: Bearer secret-token-value",
      },
      {
        connector_id: "hydra-gmail-1",
        provider: "gmail",
        name: "Current Gmail",
        database: "work",
        last_error: "Authorization: Bearer secret-token-value",
      },
    ] });
    expect(connectors).toHaveLength(1);
    expect(connectors[0]?.name).toBe("Current Gmail");
    expect(JSON.stringify(connectors)).not.toContain("secret-token-value");
  });
});
