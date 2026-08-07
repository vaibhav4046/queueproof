import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deploymentLinearCredential } from "../lib/server/action-execution";
import { DEPLOYMENT_OWNER_ACTOR_ID } from "../lib/server/identity";

const credentialEnv = {
  LINEAR_API_KEY: ["lin", "api", "test-boundary-key"].join("_"),
  QUEUEPROOF_LINEAR_EXECUTION_WORKSPACE_ID: "ws_operator",
};

describe("deployment Linear execution credential boundary", () => {
  it("never lends the deployment credential to an Auth0 personal workspace", () => {
    expect(deploymentLinearCredential({
      actorId: "user:auth0:alice",
      workspaceId: "ws_operator",
      env: credentialEnv,
    })).toBeNull();
    expect(deploymentLinearCredential({
      actorId: "user:auth0:alice",
      workspaceId: "ws_alice",
      env: credentialEnv,
    })).toBeNull();
  });

  it("requires both the stable deployment owner and the exact bound workspace", () => {
    expect(deploymentLinearCredential({
      actorId: DEPLOYMENT_OWNER_ACTOR_ID,
      workspaceId: "ws_other",
      env: credentialEnv,
    })).toBeNull();
    expect(deploymentLinearCredential({
      actorId: DEPLOYMENT_OWNER_ACTOR_ID,
      workspaceId: "ws_operator",
      env: credentialEnv,
    })).toBe(credentialEnv.LINEAR_API_KEY);
  });

  it("keeps the provider call behind the workspace-bound resolver", () => {
    const route = readFileSync(
      new URL("../app/api/actions/[id]/approve/route.ts", import.meta.url),
      "utf8",
    );
    expect(route.indexOf("deploymentLinearCredential({")).toBeGreaterThan(-1);
    expect(route.indexOf("deploymentLinearCredential({")).toBeLessThan(route.indexOf("createIssue({ apiKey"));
    expect(route).not.toContain("runtimeEnv()).LINEAR_API_KEY");
  });
});
