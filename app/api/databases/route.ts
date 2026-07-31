import { apiError, noStoreJson, readJson } from "../../../lib/server/api";
import { hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import { unwrapHydra } from "../../../lib/server/hydradb-shapes";
import { requireRequestActor } from "../../../lib/server/identity";
import { audit, requireWorkspaceForUser } from "../../../lib/server/store";

function databaseList(value: unknown) {
  const root = unwrapHydra(value);
  const candidates = root.databases ?? root.tenant_ids ?? root.tenantIds;
  return Array.isArray(candidates) ? candidates.map(String).filter(Boolean) : [];
}

export async function GET() {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const response = await (await hydraClientForWorkspace(String(workspace.id))).listDatabases();
    if (!response.ok) {
      return noStoreJson({ ok: false, error: response.error }, { status: response.status || 502 });
    }
    return noStoreJson({ ok: true, databases: databaseList(response.data), requestId: response.requestId });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    const workspace = await requireWorkspaceForUser(actor.id);
    const { database: raw } = await readJson<{ database?: string }>(request);
    const database = raw?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") ?? "";
    if (database.length < 3 || database.length > 64) {
      return noStoreJson({ ok: false, error: "Database name must be 3–64 URL-safe characters." }, { status: 400 });
    }
    const response = await (await hydraClientForWorkspace(String(workspace.id))).createDatabase(database);
    await audit({
      workspaceId: String(workspace.id), actorId: actor.id, operation: "database.create",
      targetType: "database", targetId: database, outcome: response.ok ? "success" : "failure",
      riskClass: "write", metadata: { requestId: response.requestId },
    });
    if (!response.ok) return noStoreJson({ ok: false, error: response.error }, { status: response.status || 502 });
    return noStoreJson({ ok: true, database, status: "provisioning", requestId: response.requestId }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
