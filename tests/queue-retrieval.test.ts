import { describe, expect, it } from "vitest";
import {
  canOriginateQueueTask,
  QUEUE_RETRIEVAL_MAX_RESULTS,
  queueConnectorRetrievalPlans,
  queueRetrievalCostIntent,
} from "../lib/server/queue";
import { connectorLineageMetadataFilter, sourceAttestedByScopedConnectorQuery } from "../lib/server/hydradb-shapes";
import { retrievalModeCost } from "../packages/retrieval/src";

const connectors = [
  { id: "github-1", hydradb_connector_id: "hydra-github-1", provider: "github", database: "work", collection: null },
  { id: "gmail-1", hydradb_connector_id: "hydra-gmail-1", provider: "gmail", database: "work", collection: null },
  { id: "linear-1", hydradb_connector_id: "hydra-linear-1", provider: "linear", database: "work", collection: null },
  { id: "slack-1", hydradb_connector_id: "hydra-slack-1", provider: "slack", database: "work", collection: null },
];

describe("provider-scoped queue retrieval", () => {
  it("plans exactly one bounded Fast hybrid query per verified connector", () => {
    const plans = queueConnectorRetrievalPlans(connectors);
    expect(plans).toHaveLength(connectors.length);
    expect(plans.map((plan) => plan.connector.id)).toEqual(connectors.map((connector) => connector.id));
    for (const plan of plans) {
      expect(plan).toMatchObject({
        mode: "fast",
        queryBy: "hybrid",
        maxResults: QUEUE_RETRIEVAL_MAX_RESULTS,
        estimatedCostUnits: 1,
        metadataFilters: connectorLineageMetadataFilter(
          plan.connector.hydradb_connector_id,
          plan.connector.provider,
        ),
      });
      expect(plan.query).toMatch(/Exclude examples, homework, recruitment/i);
      expect(plan.query).toMatch(/uploaded documents, and attachment prose/i);
    }
  });

  it("costs four Fast units for four connectors, below two Thinking calls", () => {
    const cost = queueRetrievalCostIntent(queueConnectorRetrievalPlans(connectors));
    expect(cost).toEqual({ callCount: 4, estimatedCostUnits: 4 });
    expect(cost.estimatedCostUnits).toBeLessThan(2 * retrievalModeCost("thinking"));
  });

  it("attests only the intended provider-scoped queue response", () => {
    const plan = queueConnectorRetrievalPlans([connectors[2]!])[0]!;
    const valid = {
      source: { app_provider: "linear" },
      connectorId: plan.connector.hydradb_connector_id,
      connectorProvider: plan.connector.provider,
      scopeConnectorCount: 1,
      providerConnectorCount: 1,
      purpose: "queue" as const,
      lineageMetadataFilters: plan.metadataFilters,
      responseOk: true,
      responseStatus: 200,
      requestId: "hydra-queue-request-1",
    };
    expect(sourceAttestedByScopedConnectorQuery(valid)).toBe(true);
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, source: { app_provider: "slack" } })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({
      ...valid,
      lineageMetadataFilters: { connector_id: "hydra-linear-2" },
    })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, scopeConnectorCount: 2 })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({ ...valid, requestId: null })).toBe(false);
    expect(sourceAttestedByScopedConnectorQuery({
      ...valid,
      callerMetadataFilters: { provider: "slack" },
    })).toBe(false);
  });

  it("keeps uploaded documents ineligible to originate queue tasks", () => {
    expect(canOriginateQueueTask({ provider: "document" })).toBe(false);
    expect(canOriginateQueueTask({ provider: "linear" })).toBe(true);
  });
});
