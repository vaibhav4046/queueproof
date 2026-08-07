import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const selfReport = process.argv[2]?.replaceAll("\\", "/") ?? "";
const includeDiagnosticPaths = process.argv.includes("--diagnostic-paths");

const families = [
  ["AWS access key", /\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/g],
  ["AWS labelled secret", /\b(?:aws[_-]?(?:secret|session)[_-]?(?:access[_-]?)?(?:key|token)|aws_secret_access_key)\b\s*[:=]\s*["']?[A-Za-z0-9/+=]{20,}/gi],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{80,255})\b/g],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["Linear token", /\b(?:lin_api_[A-Za-z0-9]{20,}|linear[_-]?(?:api[_-]?)?(?:key|token)\s*[:=]\s*["']?[A-Za-z0-9_-]{20,})\b/gi],
  ["Stripe live secret", /\b(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}\b/g],
  ["Google credential", /\b(?:AIza[0-9A-Za-z_-]{35}|GOCSPX-[0-9A-Za-z_-]{20,})\b/g],
  ["Private-key header", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ["Turso token", /\b(?:turso|libsql)[_-]?(?:auth[_-]?)?(?:token|key)\b\s*[:=]\s*["']?(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{64,})/gi],
  ["Vercel token", /\b(?:vcp_[A-Za-z0-9_-]{20,}|vercel[_-]?(?:auth[_-]?)?token\b\s*[:=]\s*["']?[A-Za-z0-9_-]{20,})/gi],
  ["Auth0 secret", /\bauth0(?:[_-]?client[_-]?secret|[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9_.~+\/-]{20,}/gi],
  ["QueueProof encryption key", /\bqueueproof[_-]?encryption[_-]?key\b\s*[:=]\s*["']?[A-Za-z0-9_.~+\/-]{20,}/gi],
  ["Attio-labelled 64-hex", /\battio\b[^\r\n]{0,80}\b[0-9a-f]{64}\b/gi],
];

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: options.binary ? null : "utf8",
    input: options.input,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function isKnownSyntheticFixture(family, match, path) {
  if (family !== "Turso token") return false;
  const normalizedPath = path?.replaceAll("\\", "/") ?? "";
  const isFixturePath = normalizedPath === ".env.example" || normalizedPath.startsWith("tests/");
  if (!isFixturePath) return false;
  const value = match.replace(/^.*?[:=]\s*["']?/, "");
  return /(?:example|test|fixture|dummy|fake|replace|placeholder|not[-_]?a[-_]?real|your[-_]|local[-_])/i.test(value)
    || /^(?:x|0){20,}$/i.test(value);
}

function countCandidates(buffer, totals, suppressedTotals, path, diagnostics) {
  if (buffer.includes(0)) return false;
  const text = buffer.toString("utf8");
  let hit = false;
  for (const [name, pattern] of families) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const suppressed = isKnownSyntheticFixture(name, match[0], path);
      if (diagnostics) {
        const value = match[0].replace(/^.*?[:=]\s*["']?/, "");
        diagnostics.push({
          path: path?.replaceAll("\\", "/") ?? "",
          family: name,
          suppressed,
          valueLength: value.length,
          hasDots: value.includes("."),
          hasHyphens: value.includes("-"),
          hasUnderscores: value.includes("_"),
        });
      }
      if (suppressed) {
        suppressedTotals[name] += 1;
      } else {
        totals[name] += 1;
        hit = true;
      }
    }
  }
  return hit;
}

function emptyTotals() {
  return Object.fromEntries(families.map(([name]) => [name, 0]));
}

const branch = git(["branch", "--show-current"]).trim();
const head = git(["rev-parse", "HEAD"]).trim();
const paths = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
  .split("\0")
  .filter(Boolean)
  .filter((path) => path.replaceAll("\\", "/") !== selfReport)
  .sort();

const worktreeTotals = emptyTotals();
const worktreeSuppressedTotals = emptyTotals();
const worktreeDiagnostics = [];
let worktreeFilesWithCandidates = 0;
const worktreeCandidatePaths = [];
const fingerprint = createHash("sha256");
for (const path of paths) {
  const content = readFileSync(path);
  const contentHash = createHash("sha256").update(content).digest("hex");
  fingerprint.update(path.replaceAll("\\", "/"));
  fingerprint.update("\0");
  fingerprint.update(contentHash);
  fingerprint.update("\n");
  if (countCandidates(
    content,
    worktreeTotals,
    worktreeSuppressedTotals,
    path,
    includeDiagnosticPaths ? worktreeDiagnostics : undefined,
  )) {
    worktreeFilesWithCandidates += 1;
    worktreeCandidatePaths.push(path.replaceAll("\\", "/"));
  }
}

const objectLines = git(["rev-list", "--objects", "--all"])
  .split(/\r?\n/)
  .filter(Boolean);
const objectIds = [...new Set(objectLines.map((line) => line.split(" ", 1)[0]))];
const objectPaths = new Map(
  objectLines.map((line) => {
    const separator = line.indexOf(" ");
    return separator < 0 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
  }),
);
const batchInput = `${objectIds.join("\n")}\n`;
const typeLines = git(["cat-file", "--batch-check=%(objectname) %(objecttype)"], { input: batchInput })
  .split(/\r?\n/)
  .filter(Boolean);
const blobIds = typeLines
  .filter((line) => line.endsWith(" blob"))
  .map((line) => line.split(" ", 1)[0]);

const historyTotals = emptyTotals();
const historySuppressedTotals = emptyTotals();
let historyBlobsWithCandidates = 0;
const batch = git(["cat-file", "--batch"], {
  binary: true,
  input: `${blobIds.join("\n")}\n`,
});
let offset = 0;
for (const expectedOid of blobIds) {
  const headerEnd = batch.indexOf(10, offset);
  if (headerEnd < 0) throw new Error("Unexpected end of git cat-file batch header");
  const [oid, type, sizeText] = batch.subarray(offset, headerEnd).toString("utf8").split(" ");
  const size = Number(sizeText);
  if (oid !== expectedOid || type !== "blob" || !Number.isFinite(size)) {
    throw new Error("Unexpected git cat-file batch response");
  }
  const contentStart = headerEnd + 1;
  const contentEnd = contentStart + size;
  const content = batch.subarray(contentStart, contentEnd);
  if (countCandidates(content, historyTotals, historySuppressedTotals, objectPaths.get(oid))) {
    historyBlobsWithCandidates += 1;
  }
  offset = contentEnd + 1;
}

const stableBranch = git(["branch", "--show-current"]).trim();
const stableHead = git(["rev-parse", "HEAD"]).trim();
if (branch !== stableBranch || head !== stableHead) {
  throw new Error("Git ref changed while the scan was running");
}

const sum = (totals) => Object.values(totals).reduce((total, count) => total + count, 0);
const result = {
  branch,
  head,
  worktree: {
    files: paths.length,
    fingerprint: fingerprint.digest("hex"),
    totals: worktreeTotals,
    suppressedSyntheticFixtures: worktreeSuppressedTotals,
    totalCandidates: sum(worktreeTotals),
    filesWithCandidates: worktreeFilesWithCandidates,
    ...(includeDiagnosticPaths ? { candidatePaths: worktreeCandidatePaths } : {}),
    ...(includeDiagnosticPaths ? { candidateMetadata: worktreeDiagnostics } : {}),
  },
  history: {
    reachableCommits: Number(git(["rev-list", "--count", "--all"]).trim()),
    uniqueReachableBlobs: blobIds.length,
    totals: historyTotals,
    suppressedSyntheticFixtures: historySuppressedTotals,
    totalCandidates: sum(historyTotals),
    blobsWithCandidates: historyBlobsWithCandidates,
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.worktree.totalCandidates > 0 || result.history.totalCandidates > 0) {
  process.exitCode = 1;
}
