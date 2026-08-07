#!/usr/bin/env node
import process from "node:process";
import { resolveStorage } from "../lib/server/d1-compat.ts";
import {
  PublicWorkspaceProvisioningError,
  provisionReviewedPublicWorkspaceMembership,
  resolveRequestedWorkspaceId,
} from "./lib/public-workspace-provisioning.ts";

async function main() {
  if (process.env.VERCEL_ENV !== "production" || process.env.QUEUEPROOF_PUBLIC_ACCESS !== "true") {
    return;
  }

  const workspaceId = resolveRequestedWorkspaceId([], process.env);
  const storage = resolveStorage(process.env);
  if (!storage.database) {
    throw new PublicWorkspaceProvisioningError(
      "A durable production database is required for the public reviewer migration.",
    );
  }

  const result = await provisionReviewedPublicWorkspaceMembership(storage.database, workspaceId);
  console.log(
    result.changed
      ? "Provisioned the attested public reviewer membership."
      : "Verified the existing attested public reviewer membership.",
  );
}

main().catch((error) => {
  if (error instanceof PublicWorkspaceProvisioningError) {
    console.error(`Public reviewer migration failed: ${error.message}`);
  } else {
    console.error("Public reviewer migration failed during the atomic database operation.");
  }
  process.exitCode = 1;
});
