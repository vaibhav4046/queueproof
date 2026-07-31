import { apiError, noStoreJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { extractProviderContracts } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, requireWorkspaceForUser } from "../../../lib/server/store";
import { genericProviderAdapter } from "../../../packages/connectors/src";
import { sha256 } from "../../../packages/security/src";

export async function GET() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);
    const client = await hydraClientForWorkspace(workspaceId);
    const response = await client.listProviders();
    if (!response.ok) {
      return noStoreJson(
        {
          ok: false,
          error: response.error,
          diagnostics: { status: response.status, requestId: response.requestId },
        },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }
    const contracts = extractProviderContracts(response.data);
    const db = requireDb();
    const verified = await db
      .prepare(
        `SELECT provider FROM connectors WHERE workspace_id = ? AND state = 'data_verified'`,
      )
      .bind(workspaceId)
      .all<{ provider: string }>();
    const verifiedProviders = new Set(
      verified.results.map((row: { provider: string }) => row.provider.toLowerCase()),
    );
    const providers = [];
    for (const raw of contracts) {
      try {
        const descriptor = genericProviderAdapter.validateContract(raw);
        const contractJson = JSON.stringify(raw);
        const contractHash = await sha256(contractJson);
        const supportClass = verifiedProviders.has(descriptor.id.toLowerCase())
          ? "verified"
          : Object.keys(descriptor.credentialSchema).length > 0
            ? "contract-compatible"
            : "experimental";
        await db
          .prepare(
            `INSERT INTO connector_providers
             (id, workspace_id, provider_id, display_name, support_class, contract_json, contract_hash, available)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(workspace_id, provider_id) DO UPDATE SET
               display_name = excluded.display_name,
               support_class = excluded.support_class,
               contract_json = excluded.contract_json,
               contract_hash = excluded.contract_hash,
               available = excluded.available,
               updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(
            createId("provider"),
            workspaceId,
            descriptor.id,
            descriptor.name,
            supportClass,
            contractJson,
            contractHash,
            descriptor.available ? 1 : 0,
          )
          .run();
        providers.push({
          id: descriptor.id,
          name: descriptor.name,
          available: descriptor.available,
          maturity: descriptor.maturity,
          category: descriptor.category,
          supportClass,
          credentialFields: genericProviderAdapter.credentialFields(descriptor),
          indexedObjectTypes: descriptor.indexedObjectTypes,
          filterableFields: descriptor.filterableFields,
          contractHash,
        });
      } catch {
        // A malformed provider contract is excluded and remains visible in server diagnostics.
      }
    }
    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "providers.refresh",
      outcome: "success",
      metadata: {
        count: providers.length,
        requestId: response.requestId,
        latencyMs: response.latencyMs,
      },
    });
    return noStoreJson({
      ok: true,
      providers,
      fetchedAt: new Date().toISOString(),
      contractVersion: "2",
      requestId: response.requestId,
      latencyMs: response.latencyMs,
    });
  } catch (error) {
    return apiError(error);
  }
}
