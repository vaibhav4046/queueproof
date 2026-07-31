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
    const suffix = providerId ? `?id=${encodeURIComponent(providerId)}` : "";
    return this.request<Record<string, unknown>>(`/connectors/providers${suffix}`);
  }

  listConnectors(provider?: string) {
    const suffix = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    return this.request<Record<string, unknown>>(`/connectors${suffix}`);
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

  query(payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/query", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

