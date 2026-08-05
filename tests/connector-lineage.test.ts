import { describe, expect, it } from "vitest";
import {
  connectorLineageMetadataFilter,
  sourceAttestedByScopedConnectorQuery,
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

describe("connector-scoped repair attestation", () => {
  const valid = {
    source: { app_provider: "linear" },
    connectorId: "hydra-linear-1",
    connectorProvider: "linear",
    scopeConnectorCount: 1,
    phase: "follow_up" as const,
    lineageMetadataFilters: { connector_id: "hydra-linear-1" },
    callerMetadataFilters: { team: "platform" },
    responseOk: true,
    responseStatus: 200,
    requestId: "hydra-request-7",
  };

  it("retains the intended provider when the single-connector repair receipt attests it", () => {
    expect(sourceAttestedByScopedConnectorQuery(valid)).toBe(true);
  });

  it("rejects a source from the wrong provider", () => {
    expect(sourceAttestedByScopedConnectorQuery({
      ...valid,
      source: { app_provider: "slack" },
    })).toBe(false);
  });

  it("rejects a repair whose exact connector filter does not match the scoped connector", () => {
    expect(sourceAttestedByScopedConnectorQuery({
      ...valid,
      lineageMetadataFilters: { connector_id: "hydra-linear-2" },
    })).toBe(false);
  });

  it.each([
    { connector_id: "hydra-linear-2" },
    { provider: "slack" },
    { connector_id: ["hydra-linear-1"] },
  ])("rejects a conflicting caller filter: %j", (callerMetadataFilters) => {
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, callerMetadataFilters })).toBe(false);
  });

  it("never attests an unscoped primary result or a response without a request receipt", () => {
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, phase: "primary" })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, scopeConnectorCount: 2 })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, requestId: null })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, responseOk: false, responseStatus: 500 })).toBe(false);
  });
});
