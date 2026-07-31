import { runtimeEnv } from "../../../../lib/server/runtime";

export async function GET() {
  const runtime = runtimeEnv();
  const checks = {
    databaseBinding: Boolean(runtime.DB),
    uploadBinding: Boolean(runtime.FILES),
    encryptionKey: Boolean(runtime.QUEUEPROOF_ENCRYPTION_KEY),
  };
  const ready = checks.databaseBinding && checks.uploadBinding && checks.encryptionKey;
  return Response.json(
    { status: ready ? "ready" : "not_ready", checks },
    { status: ready ? 200 : 503 },
  );
}

