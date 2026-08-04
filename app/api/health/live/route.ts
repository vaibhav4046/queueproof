export async function GET() {
  // Git-triggered Vercel deployments provide the VERCEL_GIT_* values. Manual
  // reviewed promotions can provide the non-secret QUEUEPROOF_RELEASE_* values
  // per deployment so the running production artifact remains SHA-verifiable.
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.QUEUEPROOF_RELEASE_SHA || null;
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF || process.env.QUEUEPROOF_RELEASE_REF || null;
  return Response.json({
    status: "live",
    service: "queueproof-web",
    time: new Date().toISOString(),
    release: {
      commitSha,
      commitRef,
      deploymentUrl: process.env.VERCEL_URL ?? null,
    },
  });
}
