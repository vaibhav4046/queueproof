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
    r2: { configured: Boolean(runtime.FILES) },
    hydradb: {
      configuredPerWorkspace: true,
      baseUrl: "https://api.hydradb.com",
      contractVersion: "2",
    },
  };
  return Response.json({ status: "observable", dependencies });
}
