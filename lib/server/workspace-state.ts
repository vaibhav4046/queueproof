import { getRequestActor, signInConfigured } from "./identity";
import { runtimeEnv } from "./runtime";
import { ensureCoreSchema, workspaceForUser } from "./store";
import { hydraAccountForWorkspace } from "./hydradb-account";

/**
 * Single source of truth for "what should the user see right now".
 *
 * Both the server-rendered page and GET /api/workspace derive from this, so the shell
 * that arrives in the HTML already matches what the client would compute. Previously the
 * page rendered a client component that unconditionally showed a boot screen and only
 * then fetched state, so a crawler, a no-JS client, or anyone whose request stalled saw
 * "Establishing workspace trust boundary…" indefinitely.
 *
 * The result is a discriminated union rather than a bag of nullable fields: every state
 * the product can legitimately be in is named, so no screen has to infer its situation
 * from a combination of nulls.
 */
export type WorkspaceView =
  | { kind: "storage_unconfigured"; detail: string }
  | { kind: "sign_in_required"; signInConfigured: boolean }
  | { kind: "no_workspace"; actor: ActorView }
  | {
      kind: "ready";
      actor: ActorView;
      workspace: WorkspaceSummary;
      hydradb: HydraSummary;
      /** Surfaced so an ephemeral deployment can never be mistaken for a durable one. */
      storageBackend: string;
    };

export type ActorView = { displayName: string; localDevelopment: boolean };

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  mode: string;
};

export type HydraSummary = {
  configured: boolean;
  verifiedAt: string | null;
  fingerprint: string | null;
};

export async function loadWorkspaceView(): Promise<WorkspaceView> {
  const runtime = runtimeEnv() as Record<string, unknown>;

  if (!runtime.DB) {
    return {
      kind: "storage_unconfigured",
      detail:
        typeof runtime.QUEUEPROOF_STORAGE_DETAIL === "string"
          ? runtime.QUEUEPROOF_STORAGE_DETAIL
          : "No durable storage is configured for this deployment.",
    };
  }

  const actor = await getRequestActor();
  if (!actor) {
    return { kind: "sign_in_required", signInConfigured: signInConfigured() };
  }

  await ensureCoreSchema();
  const workspace = await workspaceForUser(actor.id);
  const actorView: ActorView = {
    displayName: actor.displayName,
    localDevelopment: actor.localDevelopment,
  };

  if (!workspace) return { kind: "no_workspace", actor: actorView };

  const account = await hydraAccountForWorkspace(String(workspace.id));
  return {
    kind: "ready",
    storageBackend:
      typeof runtime.QUEUEPROOF_STORAGE_BACKEND === "string"
        ? runtime.QUEUEPROOF_STORAGE_BACKEND
        : "unknown",
    actor: actorView,
    workspace: {
      id: String(workspace.id),
      name: String(workspace.name),
      slug: String(workspace.slug),
      mode: String(workspace.mode ?? "bring_your_own_hydradb"),
    },
    hydradb: {
      configured: Boolean(account),
      verifiedAt: (account?.verified_at as string | undefined) ?? null,
      fingerprint: (account?.key_fingerprint as string | undefined) ?? null,
    },
  };
}
