#!/usr/bin/env node
import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveStorage } from "../lib/server/d1-compat.ts";
import {
  PublicWorkspaceProvisioningError,
  provisionPublicWorkspaceMembership,
  resolveRequestedWorkspaceId,
} from "./lib/public-workspace-provisioning.ts";

const HELP = `Provision QueueProof's bounded public reviewer identity.

Usage:
  pnpm public:provision -- --workspace <exact-workspace-id>

Alternatively set QUEUEPROOF_PUBLIC_WORKSPACE_ID. If both are supplied, they must match.
The command requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, or an explicit local
QUEUEPROOF_SQLITE_PATH. It never creates a workspace and never prints credentials.`;

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  const workspaceId = resolveRequestedWorkspaceId(process.argv.slice(2), process.env);
  const storage = resolveStorage(process.env);
  if (!storage.database) {
    throw new PublicWorkspaceProvisioningError(
      "Configure one explicit database backend before provisioning the public workspace.",
    );
  }

  const result = await provisionPublicWorkspaceMembership(storage.database, workspaceId);
  console.log(
    `Provisioned public reviewer membership in ${result.workspaceId} as ${result.role}.`,
  );
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (entryUrl === import.meta.url) {
  main().catch((error) => {
    if (error instanceof PublicWorkspaceProvisioningError) {
      console.error(`Public workspace provisioning failed: ${error.message}`);
    } else {
      // Database/transport failures may contain server-controlled details. Keep output generic so
      // a provider error can never echo a URL credential, token, or query argument.
      console.error("Public workspace provisioning failed during the atomic database operation.");
    }
    process.exitCode = 1;
  });
}
