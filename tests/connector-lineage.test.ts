import { describe, expect, it } from "vitest";
import {
  connectorLineageMetadataFilter,
  sourceBelongsToConnector,
} from "../lib/server/hydradb-shapes";

describe("connector proof lineage", () => {
  const selected = new Set(["channel-customer-escalations"]);

  it("accepts an exact connector identity", () => {
    expect(sourceBelongsToConnector({ connector_id: "hydra-slack-1" }, "hydra-slack-1", selected)).toBe(true);
  });

  it("accepts an exact selected resource when connector identity is absent", () => {
    expect(sourceBelongsToConnector({ additional_metadata: { resource_id: "channel-customer-escalations" } }, "hydra-slack-1", selected)).toBe(true);
  });

  it("accepts HydraDB system lineage from tenant metadata", () => {
    expect(sourceBelongsToConnector(
      { metadata: { connector_id: "hydra-slack-1", provider: "slack" } },
      "hydra-slack-1",
      selected,
    )).toBe(true);
  });

  it("rejects foreign tenant-metadata lineage even when a resource id looks selected", () => {
    expect(sourceBelongsToConnector(
      {
        metadata: { connector_id: "hydra-slack-2" },
        additional_metadata: { resource_id: "channel-customer-escalations" },
      },
      "hydra-slack-1",
      selected,
    )).toBe(false);
  });

  it("builds the top-level tenant metadata filter HydraDB expects", () => {
    expect(connectorLineageMetadataFilter("hydra-slack-1")).toEqual({
      connector_id: "hydra-slack-1",
    });
  });

  it("rejects provider-only and foreign-connector records", () => {
    expect(sourceBelongsToConnector({ app_provider: "slack" }, "hydra-slack-1", selected)).toBe(false);
    expect(sourceBelongsToConnector({ connector_id: "hydra-slack-2" }, "hydra-slack-1", selected)).toBe(false);
  });
});
