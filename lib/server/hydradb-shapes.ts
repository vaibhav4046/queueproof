const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export function unwrapHydra(value: unknown): Record<string, unknown> {
  const root = record(value);
  return root.data && typeof root.data === "object" ? record(root.data) : root;
}

export function extractProviderContracts(value: unknown): Array<Record<string, unknown>> {
  const root = unwrapHydra(value);
  for (const key of ["providers", "connectors", "items", "catalog"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).map(record);
  }
  if (Array.isArray(value)) return (value as unknown[]).map(record);
  return Object.entries(root)
    .filter(([, candidate]) => typeof candidate === "object" && candidate !== null)
    .map(([id, candidate]) => ({ id, ...record(candidate) }));
}

export function extractResources(value: unknown): Array<Record<string, unknown>> {
  const root = unwrapHydra(value);
  return Array.isArray(root.resources) ? root.resources.map(record) : [];
}

/**
 * Extract connector records returned by HydraDB's account-scoped list endpoint.
 *
 * The endpoint is typed as a generic object by the current SDK, while the connector
 * record itself has a published snake_case contract. Accept the small set of envelope
 * shapes used by HydraDB without treating arbitrary nested objects as connectors.
 */
export function extractConnectors(value: unknown): Array<Record<string, unknown>> {
  const outer = record(value);
  const data = outer.data;
  const containers = [value, data, unwrapHydra(value)];
  for (const container of containers) {
    if (Array.isArray(container)) return container.map(record);
    const candidate = record(container);
    for (const key of ["connectors", "items", "results"]) {
      if (Array.isArray(candidate[key])) return (candidate[key] as unknown[]).map(record);
    }
    if (typeof candidate.connector_id === "string") return [candidate];
  }
  return [];
}

export function extractQuerySources(value: unknown) {
  const root = unwrapHydra(value);
  const sources = Array.isArray(root.sources) ? root.sources.map(record) : [];
  const chunks = Array.isArray(root.chunks) ? root.chunks.map(record) : [];
  return { root, sources, chunks };
}

/** Join source metadata to the excerpt with the same HydraDB identity. */
export function matchingChunk(
  source: Record<string, unknown>,
  chunks: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const candidateIds = [source.id, source.source_id, source.context_id]
    .filter(Boolean)
    .map(String);
  if (candidateIds.length === 0) return {};
  return chunks.find((chunk) => {
    const chunkIds = [chunk.id, chunk.source_id, chunk.context_id]
      .filter(Boolean)
      .map(String);
    return chunkIds.some((id) => candidateIds.includes(id));
  }) ?? {};
}

/**
 * HydraDB can return several relevance-ranked chunks for one document source.
 * Keep the full one-to-many relationship: selecting only the first matching
 * chunk discards the actual answer whenever a handbook section ranks behind
 * its table of contents or front matter.
 */
export function matchingChunks(
  source: Record<string, unknown>,
  chunks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const candidateIds = [source.id, source.source_id, source.context_id]
    .filter(Boolean)
    .map(String);
  if (candidateIds.length === 0) return [];
  return chunks.filter((chunk) => {
    const chunkIds = [chunk.id, chunk.source_id, chunk.context_id]
      .filter(Boolean)
      .map(String);
    return chunkIds.some((id) => candidateIds.includes(id));
  });
}

/**
 * Providers HydraDB labels differently on the source than on the connector.
 *
 * A Gmail connector is created as `gmail`, but every source it indexes comes back tagged
 * `app_provider: "google"`. Comparing the two directly means a working connector matches
 * none of its own sources, which is exactly what happened during live verification.
 */
const PROVIDER_ALIASES: Record<string, string> = {
  google: "gmail",
  google_mail: "gmail",
  googlemail: "gmail",
  google_drive: "google_drive",
  msteams: "microsoft_teams",
  ms_teams: "microsoft_teams",
};

// Values stored in HydraDB tenant metadata can differ from QueueProof's connector
// catalogue label. Gmail is the known live case: connector=`gmail`, source metadata=`google`.
const PROVIDER_FILTER_LABELS: Record<string, string> = {
  gmail: "google",
};

/** Normalise a provider label to the name the connector is registered under. */
export function canonicalProvider(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return PROVIDER_ALIASES[lower] ?? lower;
}

export function providerFromSource(source: Record<string, unknown>): string | null {
  const provider = source.app_provider ?? source.provider;
  if (provider) return canonicalProvider(String(provider));
  // HydraDB's connector contract injects `provider` into the tenant metadata
  // layer (`source.metadata`). `additional_metadata` is the document metadata
  // layer and is retained as a compatibility fallback for older indexed data.
  const tenantMetadata = record(source.metadata);
  const documentMetadata = record(source.additional_metadata);
  const nested = tenantMetadata.app_provider ?? tenantMetadata.provider ??
    documentMetadata.app_provider ?? documentMetadata.provider;
  return nested ? canonicalProvider(String(nested)) : null;
}

/**
 * Provider coverage for one connector verification receipt.
 *
 * The caller must pass only sources already proven to belong to the connector.
 * Coverage can therefore attest exactly the connector's canonical provider and
 * can never inherit unrelated providers returned in the wider query envelope.
 */
export function connectorVerificationProviderCoverage(
  matchingSources: Array<Record<string, unknown>>,
  connectorProvider: string,
): string[] {
  const expected = canonicalProvider(connectorProvider);
  if (!expected) return [];
  return matchingSources.some((source) => providerFromSource(source) === expected)
    ? [expected]
    : [];
}

/**
 * HydraDB system metadata applied to every object synced by one connector.
 *
 * Top-level `metadata_filters` keys query tenant metadata, so this filter makes
 * a repair/canary query connector-specific before ranking. Callers still must
 * validate the returned source lineage because retrieval filters are not a
 * substitute for receipt verification.
 */
export function connectorLineageMetadataFilter(connectorId: string, provider?: string): Record<string, string> {
  const canonical = provider ? canonicalProvider(provider) : null;
  return canonical
    ? { connector_id: connectorId, provider: PROVIDER_FILTER_LABELS[canonical] ?? canonical }
    : { connector_id: connectorId };
}

/**
 * Narrow attestation fallback for a connector-scoped repair query.
 *
 * Some HydraDB connector results omit connector/resource lineage on the returned
 * source even though the query was pre-filtered by the system `connector_id`
 * tenant metadata. Provider equality alone remains insufficient. The omission is
 * accepted only when the full request receipt proves this was one successful,
 * single-connector coverage repair or queue query with the exact connector
 * filter and the caller did not request a conflicting connector/provider boundary.
 */
export function sourceAttestedByScopedConnectorQuery(input: {
  source: Record<string, unknown>;
  connectorId: string;
  connectorProvider: string;
  scopeConnectorCount: number;
  providerConnectorCount: number;
  purpose: "coverage_repair" | "queue";
  phase?: "primary" | "follow_up";
  lineageMetadataFilters?: Record<string, unknown>;
  callerMetadataFilters?: Record<string, unknown>;
  responseOk: boolean;
  responseStatus: number;
  requestId: string | null;
}): boolean {
  if (input.purpose === "coverage_repair" && input.phase !== "follow_up") return false;
  if (input.scopeConnectorCount !== 1) return false;
  // A provider filter cannot distinguish two connectors for the same provider if
  // this tenant does not index connector_id. Missing returned lineage is therefore
  // attestable only when the workspace has one verified connector for that provider.
  if (input.providerConnectorCount !== 1) return false;
  if (!input.responseOk || input.responseStatus < 200 || input.responseStatus >= 300) return false;
  if (!input.requestId?.trim()) return false;
  if (input.lineageMetadataFilters?.connector_id !== input.connectorId) return false;

  const expectedProvider = canonicalProvider(input.connectorProvider);
  const filteredProvider = typeof input.lineageMetadataFilters?.provider === "string"
    ? canonicalProvider(input.lineageMetadataFilters.provider)
    : null;
  if (!filteredProvider || filteredProvider !== expectedProvider) return false;
  const reportedProvider = providerFromSource(input.source);
  // Connector recall occasionally omits the redundant provider label while still
  // honoring the exact connector_id filter. Absence is acceptable only inside this
  // fully attested scope; an explicit conflicting label is always rejected.
  if (!expectedProvider || (reportedProvider && reportedProvider !== expectedProvider)) return false;

  const callerFilters = input.callerMetadataFilters ?? {};
  if (Object.prototype.hasOwnProperty.call(callerFilters, "connector_id") &&
      callerFilters.connector_id !== input.connectorId) return false;
  if (Object.prototype.hasOwnProperty.call(callerFilters, "provider")) {
    const callerProvider = typeof callerFilters.provider === "string"
      ? canonicalProvider(callerFilters.provider)
      : null;
    if (callerProvider !== expectedProvider) return false;
  }
  return true;
}

/** Strong connector lineage: provider equality alone is never sufficient. */
export function sourceBelongsToConnector(
  source: Record<string, unknown>,
  connectorId: string,
  selectedResourceIds: ReadonlySet<string>,
): boolean {
  const tenantMetadata = record(source.metadata);
  const documentMetadata = record(source.additional_metadata);
  const sourceConnector = source.connector_id ?? tenantMetadata.connector_id ?? documentMetadata.connector_id;
  const sourceResource = source.resource_id ?? source.resourceId ??
    tenantMetadata.resource_id ?? tenantMetadata.resourceId ??
    documentMetadata.resource_id ?? documentMetadata.resourceId;
  if (sourceConnector) return String(sourceConnector) === connectorId;
  if (sourceResource) return selectedResourceIds.has(String(sourceResource));
  return false;
}
