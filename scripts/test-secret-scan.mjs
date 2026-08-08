import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scanner = join(repositoryRoot, "scripts", "secret-scan.mjs");
const workflow = readFileSync(join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
const fixtureRoot = mkdtempSync(join(tmpdir(), "queueproof-secret-scan-"));
const sourceRepository = join(fixtureRoot, "source");
const shallowRepository = join(fixtureRoot, "shallow");

function git(args, cwd = fixtureRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function runScanner(cwd) {
  return spawnSync(process.execPath, [scanner], {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
}

try {
  assert.match(
    workflow,
    /uses:\s*actions\/checkout@[^\s]+\s+with:\s+fetch-depth:\s*0/,
    "CI must use actions/checkout with full history before claiming to scan reachable history",
  );

  git(["init", "--initial-branch=main", sourceRepository]);
  git(["config", "user.email", "secret-scan@example.invalid"], sourceRepository);
  git(["config", "user.name", "Secret Scan Test"], sourceRepository);

  writeFileSync(join(sourceRepository, "first.txt"), "first clean revision\n");
  git(["add", "first.txt"], sourceRepository);
  git(["commit", "-m", "first clean revision"], sourceRepository);

  writeFileSync(join(sourceRepository, "second.txt"), "second clean revision\n");
  git(["add", "second.txt"], sourceRepository);
  git(["commit", "-m", "second clean revision"], sourceRepository);

  const complete = runScanner(sourceRepository);
  assert.equal(complete.status, 0, complete.stderr || complete.stdout);
  const report = JSON.parse(complete.stdout);
  assert.equal(report.history.reachableCommits, 2);

  git([
    "clone",
    "--quiet",
    "--depth=1",
    pathToFileURL(sourceRepository).href,
    shallowRepository,
  ]);
  const shallow = runScanner(shallowRepository);
  assert.notEqual(shallow.status, 0, "a shallow repository must fail closed");
  assert.match(shallow.stderr, /requires a full-history checkout/);

  process.stdout.write("secret-scan full-history guard: PASS\n");
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
