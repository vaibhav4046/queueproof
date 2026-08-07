import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("public plugin policy pages", () => {
  it("ships the support, privacy, and terms routes required by plugin review", () => {
    const support = read("app/support/page.tsx");
    const privacy = read("app/privacy/page.tsx");
    const terms = read("app/terms/page.tsx");
    expect(support).toContain("Contact the QueueProof publisher");
    expect(privacy).toContain("HydraDB API key is encrypted at rest");
    expect(privacy).toContain("does not claim an automatic deletion window");
    expect(privacy).toContain("workspace-namespaced list of recent question text");
    expect(terms).toContain("Proof before action");
  });

  it("keeps support copy safe and links policies from sign in", () => {
    const support = read("app/support/page.tsx");
    const signIn = read("app/sign-in/page.tsx");
    expect(support).toContain("Never send an API key");
    expect(signIn).toContain('href="/privacy"');
    expect(signIn).toContain('href="/support"');
  });
});
