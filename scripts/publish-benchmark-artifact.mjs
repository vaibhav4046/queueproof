#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const args = process.argv.slice(2);
const after = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const targetInput = after("--url") ?? process.env.QUEUEPROOF_URL ?? "https://queueproof.vercel.app";
const kind = after("--kind");
const file = after("--file");
const token = process.env.QUEUEPROOF_BENCHMARK_TOKEN?.trim() ?? "";

if (!new Set(["auto", "fast", "thinking", "pdf"]).has(kind) || !file) {
  process.stderr.write("Usage: npm run benchmark:publish -- --kind <auto|fast|thinking|pdf> --file <artifact.json> [--url <base-url>]\n");
  process.exit(2);
}
if (token.length < 32) {
  process.stderr.write("QUEUEPROOF_BENCHMARK_TOKEN must be configured with at least 32 characters.\n");
  process.exit(2);
}

let target;
try {
  target = new URL(targetInput);
} catch {
  process.stderr.write("Benchmark publish URL must be a valid absolute URL.\n");
  process.exit(2);
}
const loopback = target.hostname === "localhost" || target.hostname === "127.0.0.1" || target.hostname === "[::1]";
if ((target.protocol !== "https:" && !(loopback && target.protocol === "http:")) || target.username || target.password) {
  process.stderr.write("Benchmark publish URL must use HTTPS (HTTP is allowed only for loopback) and contain no credentials.\n");
  process.exit(2);
}
target.pathname = `${target.pathname.replace(/\/$/, "")}/api/lab/artifacts`;
target.search = "";
target.hash = "";

const artifact = JSON.parse(await readFile(file, "utf8"));
const response = await fetch(target, {
  method: "POST",
  redirect: "error",
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "x-queueproof-benchmark-token": token,
  },
  body: JSON.stringify({ kind, artifact }),
  signal: AbortSignal.timeout(30_000),
});
const body = await response.json().catch(() => null);
if (!response.ok || body?.ok !== true) {
  process.stderr.write(`Benchmark publish failed (${response.status}): ${body?.error ?? "unknown error"}\n`);
  process.exit(1);
}
process.stdout.write(`Published ${kind} artifact for ${body.releaseSha} (${body.artifactHash.slice(0, 12)}).\n`);
