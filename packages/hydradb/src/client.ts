import { assertSafeExternalUrl, redactSecrets } from "../../security/src";

export type HydraConfig = {
  apiKey: string;
  baseUrl?: string;
};

export type HydraResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  requestId: string | null;
  latencyMs: number;
  error: string | null;
};

const DEFAULT_BASE_URL = "https://api.hydradb.com";

export class HydraDbClient {
  private readonly apiKey: string;
  private readonly baseUrl: URL;

  constructor(config: HydraConfig) {
    if (!config.apiKey.trim()) throw new Error("HydraDB API key is required.");
    this.apiKey = config.apiKey;
    this.baseUrl = assertSafeExternalUrl(config.baseUrl ?? DEFAULT_BASE_URL);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<HydraResponse<T>> {
    const url = new URL(path, this.baseUrl);
    if (url.origin !== this.baseUrl.origin) throw new Error("HydraDB request origin changed unexpectedly.");
    const started = Date.now();
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "API-Version": "2",
          Accept: "application/json",
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...(init.headers ?? {}),
        },
      });
      const latencyMs = Date.now() - started;
      const requestId = response.headers.get("x-request-id");
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { message: text };
        }
      }
      if (!response.ok) {
        const message =
          typeof parsed === "object" && parsed && "error" in parsed
            ? JSON.stringify((parsed as { error: unknown }).error)
            : `HydraDB request failed with status ${response.status}.`;
        return {
          ok: false,
          status: response.status,
          data: null,
          requestId,
          latencyMs,
          error: redactSecrets(message),
        };
      }
      return {
        ok: true,
        status: response.status,
        data: parsed as T,
        requestId,
        latencyMs,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        requestId: null,
        latencyMs: Date.now() - started,
        error: redactSecrets(error instanceof Error ? error.message : "HydraDB request failed."),
      };
    }
  }

  listProviders(providerId?: string) {
    if (!providerId) return this.request<Record<string, unknown>>("/connector-catalog");
    return this.request<Record<string, unknown>>(
      `/connectors/providers?id=${encodeURIComponent(providerId)}`,
    );
  }

  listConnectors(provider?: string) {
    const suffix = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    return this.request<Record<string, unknown>>(`/connectors${suffix}`);
  }

  getConnector(connectorId: string) {
    return this.request<Record<string, unknown>>(`/connectors/${encodeURIComponent(connectorId)}`);
  }

  listDatabases() {
    return this.request<Record<string, unknown>>("/databases");
  }

  createDatabase(database: string) {
    return this.request<Record<string, unknown>>("/databases", {
      method: "POST",
      body: JSON.stringify({ database }),
    });
  }

  databaseStatus(database: string) {
    return this.request<Record<string, unknown>>(
      `/databases/status?database=${encodeURIComponent(database)}`,
    );
  }

  previewResources(provider: string, credentials: Record<string, unknown>, authType?: string) {
    return this.request<Record<string, unknown>>("/connector-discovery", {
      method: "POST",
      body: JSON.stringify({ provider, credentials, ...(authType ? { auth_type: authType } : {}) }),
    });
  }

  createConnector(payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/connectors", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  discoverResources(connectorId: string) {
    return this.request<Record<string, unknown>>(`/connectors/${encodeURIComponent(connectorId)}/discover`);
  }

  configureConnector(connectorId: string, resources: Array<Record<string, unknown>>, lookbackDays = 30) {
    return this.request<Record<string, unknown>>(`/connectors/${encodeURIComponent(connectorId)}/configure`, {
      method: "POST",
      body: JSON.stringify({ resources, lookback_days: lookbackDays }),
    });
  }

  syncConnector(connectorId: string) {
    return this.request<Record<string, unknown>>(`/connectors/${encodeURIComponent(connectorId)}/sync`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  connectorResources(connectorId: string) {
    return this.request<Record<string, unknown>>(`/connectors/${encodeURIComponent(connectorId)}/resources`);
  }

  /**
   * Upload a document for indexing.
   *
   * Verified against the live API: the multipart field is `documents` (not `file`), the
   * database must already exist and be provisioned, and a 202 means queued — NOT indexed.
   * The returned source id must be polled with `contextStatus` until its indexing_status
   * reaches a terminal state before the document can be queried. Treating the 202 as
   * success is precisely how an upload appears to work while returning nothing.
   */
  async ingestDocument(input: {
    database: string;
    filename: string;
    bytes: Uint8Array;
    mime: string;
  }) {
    const form = new FormData();
    form.set("database", input.database);
    // Copy into a standalone buffer so a view over a larger pooled buffer cannot leak
    // neighbouring bytes into the upload.
    const buffer = new ArrayBuffer(input.bytes.byteLength);
    new Uint8Array(buffer).set(input.bytes);
    form.append("documents", new Blob([buffer], { type: input.mime }), input.filename);
    return this.request<Record<string, unknown>>("/context/ingest", { method: "POST", body: form });
  }

  /** Poll one ingested source until its indexing_status is terminal. */
  async contextStatus(database: string, sourceId: string) {
    return this.request<Record<string, unknown>>(
      `/context/status?database=${encodeURIComponent(database)}&id=${encodeURIComponent(sourceId)}`,
    );
  }

  query(payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/query", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}
