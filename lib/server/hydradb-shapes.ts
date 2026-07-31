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

export function providerFromSource(source: Record<string, unknown>): string | null {
  const provider = source.app_provider ?? source.provider;
  if (provider) return String(provider).toLowerCase();
  const metadata = record(source.additional_metadata);
  const nested = metadata.app_provider ?? metadata.provider;
  return nested ? String(nested).toLowerCase() : null;
}

