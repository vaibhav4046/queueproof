import { runtimeEnv } from "../../../../lib/server/runtime";

/**
 * Readiness reflects the dependencies QueueProof needs to serve a request: durable
 * storage and a credential-encryption key. Documents stream directly to HydraDB after
 * local validation, so optional R2 archival is observable but never a readiness gate.
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
        // Kept for API compatibility. This means optional archival, not upload support.
        uploadBinding: Boolean(runtime.FILES),
        documentIngestion: "direct-to-hydradb",
      },
    },
    { status: ready ? 200 : 503 },
  );
}
