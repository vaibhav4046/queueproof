import { extractConnectors } from "./hydradb-shapes";
import { redactSecrets } from "../../packages/security/src";

export type AccessibleHydraConnector = {
  hydradbConnectorId: string;
  provider: string;
  name: string;
  database: string;
  collection: string | null;
  accountScope: string | null;
  authType: string | null;
  upstreamStatus: string | null;
  upstreamSyncStatus: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Keep only the non-secret fields required to attach an existing connector reference.
 * A record is importable only when HydraDB supplies its connector, provider, and database
 * identities; caller-provided substitutes are never accepted.
 */
export function accessibleHydraConnectors(value: unknown): AccessibleHydraConnector[] {
  const byId = new Map<string, AccessibleHydraConnector>();
  for (const raw of extractConnectors(value)) {
    const hydradbConnectorId = text(raw.connector_id);
    const provider = text(raw.provider, 120).toLowerCase();
    const database = text(raw.database, 500);
    if (!hydradbConnectorId || !provider || !database) continue;
    const name = text(raw.name, 240) || `${provider} connector`;
    byId.set(hydradbConnectorId, {
      hydradbConnectorId,
      provider,
      name,
      database,
      collection: text(raw.collection, 500) || null,
      accountScope: text(raw.provider_account_scope, 500) || null,
      authType: text(raw.auth_type, 120) || null,
      upstreamStatus: text(raw.status, 120) || null,
      upstreamSyncStatus: text(raw.sync_status, 120) || null,
      lastSuccessfulSyncAt: text(raw.last_successful_sync_at, 120) || null,
      lastError: text(raw.last_error, 1_000)
        ? redactSecrets(text(raw.last_error, 1_000))
        : null,
    });
  }
  return [...byId.values()];
}
