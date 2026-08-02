import { runtimeEnv } from "../../../../lib/server/runtime";

export async function GET() {
  const runtime = runtimeEnv() as Record<string, unknown>;
  const dependencies = {
    storage: {
      configured: Boolean(runtime.DB),
      // Backend and detail are diagnostic only and never contain credentials —
      // without them a misconfigured deployment fails silently, which is exactly
      // how the Vercel deployment shipped with no database for so long.
      backend: (runtime.QUEUEPROOF_STORAGE_BACKEND as string) ?? "unknown",
      detail: (runtime.QUEUEPROOF_STORAGE_DETAIL as string) ?? "No storage diagnostics available.",
    },
    // Documents stream directly to HydraDB after signature validation and hashing.
    // R2 is an optional archival layer, not a prerequisite for ingestion or retrieval.
    r2: {
      configured: Boolean(runtime.FILES),
      note: runtime.FILES
        ? "Optional R2 archival is available."
        : "Document ingestion is available through HydraDB; optional R2 archival is not enabled.",
    },
    hydradb: {
      // This previously read `configuredPerWorkspace: true`, a hardcoded literal that
      // asserted a configured state regardless of reality. HydraDB credentials are held
      // per workspace in the database, so no deployment-wide answer exists; state the
      // scope instead of claiming a status.
      credentialScope: "per-workspace",
      defaultBaseUrl: "https://api.hydradb.com",
      contractVersion: "2",
    },
  };
  return Response.json({ status: "observable", dependencies });
}
