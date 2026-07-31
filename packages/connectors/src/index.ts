export type ProviderDescriptor = {
  id: string;
  name: string;
  available: boolean;
  maturity: string | null;
  category: string | null;
  syncEngine: string | null;
  credentialSchema: Record<string, unknown>;
  indexedObjectTypes: unknown[];
  searchableFields: unknown[];
  filterableFields: unknown[];
  raw: Record<string, unknown>;
};

export interface ProviderAdapter {
  validateContract(input: unknown): ProviderDescriptor;
  credentialFields(provider: ProviderDescriptor): Array<Record<string, unknown>>;
  normaliseCredentials(input: Record<string, unknown>): Record<string, unknown>;
  formatResources(input: unknown): Array<{ id: string; name: string; resourceType: string }>;
  interpretSync(input: unknown): {
    hasCursor: boolean;
    status: string;
    lastSuccessfulSync: string | null;
    error: string | null;
  };
  canaryQuery(provider: ProviderDescriptor): string;
}

const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export const genericProviderAdapter: ProviderAdapter = {
  validateContract(input) {
    const raw = object(input);
    const id = String(raw.id ?? raw.provider ?? raw.slug ?? "");
    if (!id) throw new Error("Provider contract does not include an identifier.");
    return {
      id,
      name: String(raw.name ?? raw.display_name ?? id),
      available: raw.available !== false && raw.status !== "unavailable",
      maturity: raw.maturity ? String(raw.maturity) : null,
      category: raw.category ? String(raw.category) : null,
      syncEngine: raw.sync_engine ? String(raw.sync_engine) : null,
      credentialSchema: object(raw.credential_schema),
      indexedObjectTypes: Array.isArray(raw.indexed_object_types) ? raw.indexed_object_types : [],
      searchableFields: Array.isArray(raw.searchable_fields) ? raw.searchable_fields : [],
      filterableFields: Array.isArray(raw.filterable_fields) ? raw.filterable_fields : [],
      raw,
    };
  },
  credentialFields(provider) {
    const properties = object(provider.credentialSchema.properties);
    const required = Array.isArray(provider.credentialSchema.required)
      ? provider.credentialSchema.required.map(String)
      : [];
    return Object.entries(properties).map(([name, schema]) => ({
      name,
      required: required.includes(name),
      ...object(schema),
    }));
  },
  normaliseCredentials(input) {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([key, value]) => [key, (value as string).trim()]),
    );
  },
  formatResources(input) {
    const raw = object(input);
    const resources = Array.isArray(raw.resources) ? raw.resources : [];
    return resources
      .map(object)
      .filter((resource) => resource.id || resource.resource_id)
      .map((resource) => ({
        id: String(resource.id ?? resource.resource_id),
        name: String(resource.name ?? resource.display_name ?? resource.id ?? resource.resource_id),
        resourceType: String(resource.resource_type ?? resource.type ?? "resource"),
      }));
  },
  interpretSync(input) {
    const raw = object(input);
    const cursor = raw.provider_cursor;
    return {
      hasCursor: typeof cursor === "string" && cursor.length > 0,
      status: String(raw.status ?? raw.sync_status ?? "unknown"),
      lastSuccessfulSync: raw.last_successful_sync_at ? String(raw.last_successful_sync_at) : null,
      error: raw.last_error ? String(raw.last_error) : null,
    };
  },
  canaryQuery(provider) {
    return `Return one recent source from provider ${provider.id}.`;
  },
};

