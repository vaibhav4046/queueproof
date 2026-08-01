#!/usr/bin/env node
/**
 * QueueProof preflight.
 *
 * Answers one question: which link in the chain is broken right now?
 *
 * The previous version checked that a migration file existed on disk and then exited 0
 * even when the HydraDB and encryption keys were missing, so it reported a healthy system
 * that could not serve a request. Every check here probes the real thing, and any failed
 * check exits non-zero.
 *
 * Usage:
 *   node scripts/doctor.mjs                      # check local env + local server
 *   QUEUEPROOF_URL=https://queueproof.vercel.app node scripts/doctor.mjs
 */
import process from "node:process";

const target = (process.env.QUEUEPROOF_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

/** Never print a secret; only whether one is present and how long it is. */
function presence(value) {
  return value ? `present (${String(value).length} chars)` : "missing";
}

async function getJson(path, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${target}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: response.status, body, text };
  } catch (error) {
    return { status: 0, body: null, text: error instanceof Error ? error.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Environment -----------------------------------------------------------
record("Node >= 22.13", Number(process.versions.node.split(".")[0]) >= 22, process.versions.node);

const hasHosted = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
const hasLocal = Boolean(process.env.QUEUEPROOF_SQLITE_PATH);
record(
  "Storage configured (env)",
  hasHosted || hasLocal,
  hasHosted ? "hosted libSQL" : hasLocal ? "local node:sqlite" : "set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, or QUEUEPROOF_SQLITE_PATH",
);
record("Encryption key", Boolean(process.env.QUEUEPROOF_ENCRYPTION_KEY), presence(process.env.QUEUEPROOF_ENCRYPTION_KEY));
record("Access token (sign-in)", Boolean(process.env.QUEUEPROOF_ACCESS_TOKEN), presence(process.env.QUEUEPROOF_ACCESS_TOKEN));

// ---- Deployment ------------------------------------------------------------
const live = await getJson("/api/health/live");
record("Deployment reachable", live.status === 200, `${target} -> HTTP ${live.status || "no response"}`);

if (live.status === 200) {
  const deps = await getJson("/api/health/dependencies");
  const storage = deps.body?.dependencies?.storage;
  record(
    "Durable storage bound",
    Boolean(storage?.configured),
    storage ? `backend=${storage.backend}: ${storage.detail}` : "no storage diagnostics returned",
  );

  const ready = await getJson("/api/health/ready");
  const missing = Array.isArray(ready.body?.missing) ? ready.body.missing : [];
  record(
    "Deployment ready",
    ready.status === 200,
    missing.length ? `missing: ${missing.join(", ")}` : `HTTP ${ready.status}`,
  );

  const workspace = await getJson("/api/workspace");
  const kind = workspace.body?.view?.kind ?? "unknown";
  record(
    "Workspace reachable",
    kind === "ready" || kind === "no_workspace",
    `view=${kind}${kind === "sign_in_required" ? " (sign in to continue)" : ""}`,
  );

  // Connector proof is the gate that matters for the demo: a saved credential is not a
  // connection. Only data_verified counts.
  if (kind === "ready") {
    const connectors = await getJson("/api/connectors");
    const list = Array.isArray(connectors.body?.connectors) ? connectors.body.connectors : [];
    const verified = list.filter((connector) => connector.state === "data_verified");
    for (const provider of ["slack", "gmail", "linear"]) {
      const match = list.find((connector) => String(connector.provider).toLowerCase().includes(provider));
      record(
        `Connector verified: ${provider}`,
        Boolean(match && match.state === "data_verified"),
        match ? `state=${match.state}` : "not configured",
      );
    }
    record(
      "At least one verified source",
      verified.length > 0,
      `${verified.length} of ${list.length} connectors are data_verified`,
    );
  }
}

// ---- Report ----------------------------------------------------------------
const width = Math.max(...results.map((result) => result.name.length));
for (const { name, ok, detail } of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(width)}  ${detail}`);
}

const failed = results.filter((result) => !result.ok);
console.log("");
if (failed.length === 0) {
  console.log(`All ${results.length} checks passed against ${target}.`);
} else {
  console.log(`${failed.length} of ${results.length} checks failed. First blocker: ${failed[0].name} — ${failed[0].detail}`);
  process.exitCode = 1;
}
