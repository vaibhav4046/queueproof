import { HydraDbClient } from "../../packages/hydradb/src/client";
import { decryptSecret } from "./crypto";
import { requireDb } from "./runtime";
import { ensureCoreSchema } from "./store";

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

