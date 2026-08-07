import { HydraDbClient } from "../../packages/hydradb/src/client";
import { assertSafeExternalUrl } from "../../packages/security/src";
import { decryptSecret } from "./crypto";
import { requireDb } from "./runtime";
import { ensureCoreSchema } from "./store";

export const DEFAULT_HYDRADB_BASE_URL = "https://api.hydradb.com";

function canonicalHydraOrigin(raw: string): string {
  const url = assertSafeExternalUrl(raw);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("HydraDB base URLs must contain only an HTTPS origin.");
  }
  return url.origin;
}

/**
 * Resolve the one server-approved HydraDB origin before sending it a user credential.
 *
 * A generic SSRF check is not sufficient here: an attacker-controlled public HTTPS
 * origin would still receive the bearer key during the verification probe. Hosted
 * QueueProof therefore pins the official origin unless the operator deliberately sets
 * one alternative origin in server configuration. The browser may repeat that exact
 * value for backwards compatibility, but it cannot select a new credential recipient.
 */
export function hydraDbBaseUrlForAttach(
  requested: string | null | undefined,
  configured: string | null | undefined = DEFAULT_HYDRADB_BASE_URL,
): string {
  let allowed: string;
  try {
    allowed = canonicalHydraOrigin(configured?.trim() || DEFAULT_HYDRADB_BASE_URL);
  } catch {
    throw new Error("The server-approved HydraDB base URL is invalid.");
  }

  if (!requested?.trim()) return allowed;
  let candidate: string;
  try {
    candidate = canonicalHydraOrigin(requested.trim());
  } catch {
    throw new Response("The HydraDB base URL is invalid.", { status: 400 });
  }
  if (candidate !== allowed) {
    throw new Response(
      "This deployment accepts HydraDB credentials only for its configured API origin.",
      { status: 400 },
    );
  }
  return allowed;
}

export async function hydraAccountForWorkspace(workspaceId: string) {
  await ensureCoreSchema();
  return requireDb()
    .prepare(
      `SELECT id, workspace_id, base_url, encrypted_api_key, key_fingerprint, verified_at, status
       FROM hydradb_accounts WHERE workspace_id = ? LIMIT 1`,
    )
    .bind(workspaceId)
    .first<Record<string, string>>();
}

export async function hydraClientForWorkspace(workspaceId: string) {
  const account = await hydraAccountForWorkspace(workspaceId);
  if (!account) throw new Response("Connect HydraDB before using connectors or retrieval.", { status: 409 });
  return new HydraDbClient({
    apiKey: await decryptSecret(account.encrypted_api_key),
    baseUrl: account.base_url,
  });
}

