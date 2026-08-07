import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../app/api/lab/artifacts/batch/route.ts", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/release-evidence.yml", import.meta.url), "utf8");
const waitScript = readFileSync(new URL("../scripts/wait-for-production.mjs", import.meta.url), "utf8");
const publishScript = readFileSync(new URL("../scripts/publish-release-benchmarks.mjs", import.meta.url), "utf8");

describe("autonomous exact-release benchmark publication", () => {
  it("pins GitHub OIDC to this private main-branch push and serving SHA", () => {
    expect(route).toContain('const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com"');
    expect(route).toContain('const GITHUB_OIDC_AUDIENCE = "https://queueproof.vercel.app/api/lab/artifacts/batch"');
    expect(route).toContain('const GITHUB_REPOSITORY = "vaibhav4046/queueproof"');
    expect(route).toContain('const GITHUB_REPOSITORY_OWNER_ID = "115102797"');
    expect(route).toContain('const GITHUB_REPOSITORY_ID = "1319245359"');
    expect(route).toContain(
      "`repo:vaibhav4046@${GITHUB_REPOSITORY_OWNER_ID}/queueproof@${GITHUB_REPOSITORY_ID}:ref:refs/heads/main`",
    );
    expect(route).toContain("subject !== GITHUB_OIDC_SUBJECT");
    expect(route).not.toContain("subject.startsWith");
    expect(route).toContain('visibility !== "private"');
    expect(route).toContain('ref !== "refs/heads/main"');
    expect(route).toContain('eventName !== "push"');
    expect(route).toContain('sha !== current.sha.toLowerCase()');
    expect(route).toContain('audience: GITHUB_OIDC_AUDIENCE');
    expect(route).toContain('algorithms: ["RS256"]');
  });

  it("keeps the forged-receipt hardening while adding OIDC", () => {
    expect(route).toContain("const CONNECTOR_PROVIDERS = new Set");
    expect(route).toContain("row.matchedFactCount === row.requiredFactCount");
    expect(route).toContain("row.supportedClaimCount === claimCount");
    expect(route).toContain("crossSource.documentProviderPass !== true");
    expect(route).toContain("declaredNonDocumentProviders === null");
    expect(route).toContain("!sameProviderSet(connectors, rowProviders)");
  });

  it("grants only short-lived OIDC capability and never wires a long-lived benchmark secret into Actions", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("branches:\n      - main");
    expect(workflow).toContain("contains(github.event.head_commit.message, '[release-evidence]')");
    expect(workflow).not.toContain("QUEUEPROOF_BENCHMARK_TOKEN");
    expect(workflow).not.toContain("QUEUEPROOF_BENCHMARK_ONCE");
    expect(publishScript).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(publishScript).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
    expect(publishScript).toContain('Authorization: `Bearer ${oidc.value}`');
    expect(publishScript).not.toMatch(/console\.log\([^\n]*oidc\.value/);
    expect(publishScript).not.toMatch(/stdout\.write\([^\n]*oidc\.value/);
  });

  it("binds measurement and publication to the canonical exact production release", () => {
    expect(waitScript).toContain('body?.release?.target === "production"');
    expect(waitScript).toContain('String(body?.release?.commitSha ?? "").toLowerCase() === expectedSha');
    expect(waitScript).toContain('body?.release?.benchmarkReceiptVersion === "grounded-grader-v3"');
    expect(workflow).toContain('node scripts/release-gate.mjs --url "$QUEUEPROOF_URL" --sha "$GITHUB_SHA"');
    expect(workflow).toContain("--mode auto");
    expect(workflow).toContain("--mode fast");
    expect(workflow).toContain("--mode thinking");
    expect(workflow).toContain("run-pdf-benchmark.mjs");
    expect(workflow).toContain("publish-release-benchmarks.mjs");
  });
});
