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

/** Normalise a provider label to the name the connector is registered under. */
export function canonicalProvider(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return PROVIDER_ALIASES[lower] ?? lower;
}

export function providerFromSource(source: Record<string, unknown>): string | null {
  const provider = source.app_provider ?? source.provider;
  if (provider) return canonicalProvider(String(provider));
  const metadata = record(source.additional_metadata);
  const nested = metadata.app_provider ?? metadata.provider;
  return nested ? canonicalProvider(String(nested)) : null;
}
