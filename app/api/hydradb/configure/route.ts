import { apiError, noStoreJson, readJson } from "../../../../lib/server/api";
import { encryptSecret, secretFingerprint } from "../../../../lib/server/crypto";
import { requireRequestActor } from "../../../../lib/server/identity";
import { requireDb } from "../../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../../lib/server/store";
import { HydraDbClient } from "../../../../packages/hydradb/src/client";

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const payload = await readJson<{ apiKey?: string; baseUrl?: string }>(request);
    const apiKey = payload.apiKey?.trim() ?? "";
    if (apiKey.length < 12) {
      return noStoreJson({ ok: false, error: "Enter a newly generated HydraDB API key." }, { status: 400 });
    }
    const baseUrl = payload.baseUrl?.trim() || "https://api.hydradb.com";
    const client = new HydraDbClient({ apiKey, baseUrl });
    const verification = await client.listDatabases();
    if (!verification.ok) {
      await audit({
        workspaceId: String(workspace.id),
        actorId: actor.id,
        operation: "hydradb.configure",
        outcome: "failure",
        riskClass: "write",
        metadata: { status: verification.status, requestId: verification.requestId },
      });
      return noStoreJson(
        {
          ok: false,
          error: verification.error ?? "HydraDB did not accept the credential.",
          diagnostics: { status: verification.status, requestId: verification.requestId },
        },
        { status: verification.status >= 400 ? verification.status : 502 },
      );
    }
    const encrypted = await encryptSecret(apiKey);
    const fingerprint = await secretFingerprint(apiKey);
    const accountId = createId("hydra");
    await requireDb()
      .prepare(
        `INSERT INTO hydradb_accounts
         (id, workspace_id, base_url, encrypted_api_key, key_fingerprint, verified_at, status)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'verified')
         ON CONFLICT(workspace_id) DO UPDATE SET
           base_url = excluded.base_url,
           encrypted_api_key = excluded.encrypted_api_key,
           key_fingerprint = excluded.key_fingerprint,
           verified_at = CURRENT_TIMESTAMP,
           status = 'verified',
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(accountId, String(workspace.id), baseUrl, encrypted, fingerprint)
      .run();
    await audit({
      workspaceId: String(workspace.id),
      actorId: actor.id,
      operation: "hydradb.configure",
      targetType: "hydradb_account",
      targetId: accountId,
      outcome: "success",
      riskClass: "write",
      metadata: { fingerprint, requestId: verification.requestId, latencyMs: verification.latencyMs },
    });
    return noStoreJson({
      ok: true,
      fingerprint,
      providerContractLoaded: true,
      authenticatedCapability: "databases.list",
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
