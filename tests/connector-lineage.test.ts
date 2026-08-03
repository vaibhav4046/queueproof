import { describe, expect, it } from "vitest";
import { sourceBelongsToConnector } from "../lib/server/hydradb-shapes";

describe("connector proof lineage", () => {
  const selected = new Set(["channel-customer-escalations"]);

  it("accepts an exact connector identity", () => {
    expect(sourceBelongsToConnector({ connector_id: "hydra-slack-1" }, "hydra-slack-1", selected)).toBe(true);
  });

  it("accepts an exact selected resource when connector identity is absent", () => {
    expect(sourceBelongsToConnector({ additional_metadata: { resource_id: "channel-customer-escalations" } }, "hydra-slack-1", selected)).toBe(true);
  });

  it("rejects provider-only and foreign-connector records", () => {
    expect(sourceBelongsToConnector({ app_provider: "slack" }, "hydra-slack-1", selected)).toBe(false);
    expect(sourceBelongsToConnector({ connector_id: "hydra-slack-2" }, "hydra-slack-1", selected)).toBe(false);
  });
});
