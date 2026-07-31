export async function GET() {
  return Response.json({
    status: "live",
    service: "queueproof-web",
    time: new Date().toISOString(),
  });
}

