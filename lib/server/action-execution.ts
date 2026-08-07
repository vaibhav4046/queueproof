import { DEPLOYMENT_OWNER_ACTOR_ID } from "./identity";

/**
 * Resolve the legacy deployment-wide Linear credential only for its explicitly bound
 * operator workspace. Auth0 users own personal QueueProof workspaces, but that must never
 * let them spend or write through the deployment operator's provider account.
 */
export function deploymentLinearCredential(input: {
  actorId: string;
  workspaceId: string;
  env: Record<string, unknown>;
}): string | null {
  const apiKey = typeof input.env.LINEAR_API_KEY === "string"
    ? input.env.LINEAR_API_KEY.trim()
    : "";
  const credentialWorkspaceId =
    typeof input.env.QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID === "string"
      ? input.env.QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID.trim()
      : "";

  if (
    !apiKey ||
    input.actorId !== DEPLOYMENT_OWNER_ACTOR_ID ||
    !credentialWorkspaceId ||
    credentialWorkspaceId !== input.workspaceId
  ) {
    return null;
  }
  return apiKey;
}
