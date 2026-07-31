import { runtimeEnv } from "../../../../lib/server/runtime";

export async function GET() {
  const runtime = runtimeEnv();
  const dependencies = {
    d1: { configured: Boolean(runtime.DB) },
    r2: { configured: Boolean(runtime.FILES) },
    hydradb: {
      configuredPerWorkspace: true,
      baseUrl: "https://api.hydradb.com",
      contractVersion: "2",
    },
  };
  return Response.json({ status: "observable", dependencies });
}

