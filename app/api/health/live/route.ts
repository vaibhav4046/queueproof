export async function GET() {
  return Response.json({
    status: "live",
    service: "queueproof-web",
    time: new Date().toISOString(),
    release: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      deploymentUrl: process.env.VERCEL_URL ?? null,
    },
  });
}
