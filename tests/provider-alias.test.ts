import { describe, expect, it } from "vitest";
import { canonicalProvider, connectorLineageMetadataFilter, providerFromSource } from "../lib/server/hydradb-shapes";

/**
 * Regression test for a live failure. A Gmail connector is registered as `gmail`, but
 * every source HydraDB indexed for it came back tagged `app_provider: "google"`, so the
 * verification canary matched none of the connector's own sources.
 */
describe("provider aliasing", () => {
  it("maps the label HydraDB puts on Gmail sources onto the connector name", () => {
    expect(providerFromSource({ app_provider: "google" })).toBe("gmail");
    expect(canonicalProvider("gmail")).toBe("gmail");
    expect(providerFromSource({ app_provider: "google" })).toBe(canonicalProvider("gmail"));
    expect(connectorLineageMetadataFilter("hydra-gmail-1", "gmail")).toEqual({
      connector_id: "hydra-gmail-1",
      provider: "google",
    });
  });

  it("leaves providers that already agree untouched", () => {
    for (const p of ["slack", "linear", "github", "notion"]) {
      expect(providerFromSource({ app_provider: p })).toBe(canonicalProvider(p));
    }
  });

  it("reads the alias from nested metadata too", () => {
    expect(providerFromSource({ additional_metadata: { app_provider: "google_mail" } })).toBe("gmail");
  });

  it("reads the system provider from HydraDB tenant metadata", () => {
    expect(providerFromSource({ metadata: { provider: "linear" } })).toBe("linear");
    expect(providerFromSource({ metadata: { provider: "google" } })).toBe("gmail");
  });

  it("returns null when no provider is present", () => {
    expect(providerFromSource({})).toBeNull();
    expect(canonicalProvider(null)).toBeNull();
  });
});
