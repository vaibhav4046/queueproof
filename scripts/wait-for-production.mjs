#!/usr/bin/env node
import process from "node:process";

const args = process.argv.slice(2);
const after = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const target = (after("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app").replace(/\/$/, "");
const expectedSha = (after("--sha") ?? process.env.GITHUB_SHA ?? process.env.QUEUEPROOF_RELEASE_SHA ?? "").toLowerCase();
const timeoutMs = Number(after("--timeout-ms") ?? process.env.QUEUEPROOF_RELEASE_WAIT_MS ?? "720000");
const intervalMs = Number(after("--interval-ms") ?? "15000");
if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error("A 40-character expected release SHA is required.");

const deadline = Date.now() + timeoutMs;
let attempts = 0;
let last = null;
while (Date.now() < deadline) {
  attempts += 1;
  try {
    const response = await fetch(`${target}/api/health/live?release_wait=${Date.now()}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json().catch(() => null);
    last = {
      httpStatus: response.status,
      status: body?.status ?? null,
      environment: body?.environment ?? null,
      target: body?.release?.target ?? null,
      commitSha: body?.release?.commitSha ?? null,
      commitRef: body?.release?.commitRef ?? null,
      benchmarkReceiptVersion: body?.release?.benchmarkReceiptVersion ?? null,
    };
    if (
      response.ok && body?.status === "live" && body?.environment === "production" &&
      body?.release?.target === "production" &&
      String(body?.release?.commitSha ?? "").toLowerCase() === expectedSha &&
      body?.release?.benchmarkReceiptVersion === "grounded-grader-v3"
    ) {
      process.stdout.write(`Production is serving ${expectedSha} after ${attempts} checks.\n`);
      process.exit(0);
    }
  } catch (error) {
    last = { error: error instanceof Error ? error.message : String(error) };
  }
  if (attempts === 1 || attempts % 4 === 0) {
    process.stdout.write(`Release check ${attempts}: ${JSON.stringify(last)}\n`);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
throw new Error(`Production did not bind ${expectedSha} before the release gate timeout. Last observation: ${JSON.stringify(last)}`);
