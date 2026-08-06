/**
 * Production promotion that keeps the running artifact SHA-verifiable.
 *
 * This project is deployed from the CLI rather than from a Vercel Git
 * integration, so Vercel injects no VERCEL_GIT_COMMIT_SHA. Without it
 * /api/health/live publishes `commitSha: null`, /api/lab refuses to bind any
 * measurement to a release, and /benchmarks degrades to
 * `awaiting_current_release_measurement`. The release identity therefore has to
 * be supplied per deployment, which is exactly what the route's
 * QUEUEPROOF_RELEASE_* fallback exists for.
 *
 * The SHA is read from git rather than accepted as an argument so it cannot
 * drift from the source that is actually uploaded, and a dirty worktree is
 * refused for the same reason: a deployment labelled with a commit must contain
 * that commit's code and nothing else.
 */
import { spawnSync } from "node:child_process";

const hasFlag = (name) => process.argv.includes(name);

const git = (...args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
  }
  return result.stdout.trim();
};

const sha = git("rev-parse", "HEAD");
const ref = git("rev-parse", "--abbrev-ref", "HEAD");
const dirty = git("status", "--porcelain");

if (dirty && !hasFlag("--allow-dirty")) {
  console.error("BLOCKED  worktree is not clean, so the deployed artifact would not match the published SHA.");
  console.error(dirty);
  console.error("Commit or stash the changes, or pass --allow-dirty if you accept an unverifiable release identity.");
  process.exit(1);
}

console.log(`Deploying ${sha} (${ref}) to production.`);

const vercelArgs = [
  "deploy",
  "--prod",
  "--yes",
  "--env", `QUEUEPROOF_RELEASE_SHA=${sha}`,
  "--env", `QUEUEPROOF_RELEASE_REF=${ref}`,
];
const deploy = spawnSync("npx", ["--no-install", "vercel", ...vercelArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (deploy.status !== 0) process.exit(deploy.status ?? 1);

console.log(`\nDeployed. Verify with:\n  pnpm release:verify -- --url https://queueproof.vercel.app --sha ${sha}`);
