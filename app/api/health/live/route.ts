export async function GET() {
  // Git-triggered Vercel deployments provide the VERCEL_GIT_* values. Manual
  // reviewed promotions can provide the non-secret QUEUEPROOF_RELEASE_* values
  // per deployment so the running production artifact remains SHA-verifiable.
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.QUEUEPROOF_RELEASE_SHA || null;
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF || process.env.QUEUEPROOF_RELEASE_REF || null;
  const environment = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || null;
  return Response.json({
    status: "live",
    service: "queueproof-web",
    environment,
    time: new Date().toISOString(),
    release: {
      commitSha,
      commitRef,
      target: environment,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      deploymentUrl: process.env.VERCEL_URL || null,
      deploymentTimestamp:
        process.env.QUEUEPROOF_DEPLOYMENT_TIMESTAMP || process.env.QUEUEPROOF_BUILD_TIMESTAMP || null,
      benchmarkReceiptVersion: "grounded-grader-v3",
    },
  });
}
