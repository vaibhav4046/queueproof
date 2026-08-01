import { runtimeEnv } from "../../../../lib/server/runtime";

/**
 * Readiness reflects what QueueProof actually needs to serve a request today:
 * durable storage and a credential-encryption key.
 *
 * It previously also required `FILES`, an R2 object-storage binding. That binding cannot
 * exist on the Vercel runtime, and nothing in the codebase writes to it because document
 * upload is not implemented — so readiness could never return 200 on the canonical
 * deployment no matter how it was configured. A health check that is permanently red
 * carries no signal.
 *
 * The upload binding is still reported, as informational context rather than a gate, so
 * the absence stays visible instead of being quietly dropped.
 */
export async function GET() {
  const runtime = runtimeEnv();
  const required = {
    databaseBinding: Boolean(runtime.DB),
    encryptionKey: Boolean(runtime.QUEUEPROOF_ENCRYPTION_KEY),
  };
  const ready = required.databaseBinding && required.encryptionKey;

  const missing = Object.entries(required)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      checks: required,
      missing,
      informational: {
        // Document upload is not implemented; this is expected to be false.
        uploadBinding: Boolean(runtime.FILES),
      },
    },
    { status: ready ? 200 : 503 },
  );
}
