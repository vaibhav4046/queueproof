import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requirePrivateControlActor, type RequestActor } from "../lib/server/identity";

const actor = (id: string): RequestActor => ({
  id,
  email: `${id.replace(/[^a-z]/gi, "")}@example.test`,
  displayName: id,
  localDevelopment: false,
});

describe("public sandbox control boundary", () => {
  it("denies anonymous control-plane mutations with an abuse-safe response", () => {
    try {
      requirePrivateControlActor(actor("user:public-access"), "Token minting");
      throw new Error("guard did not throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }

    for (const route of [
      "app/api/query/route.ts",
      "app/api/databases/route.ts",
      "app/api/providers/route.ts",
      "app/api/workspace/route.ts",
      "app/api/documents/[id]/status/route.ts",
      "app/api/mcp-tokens/route.ts",
      "app/api/actions/route.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), route), "utf8"), `${route} must guard public control`).toMatch(
        /requirePrivateControlActor\s*\(/,
      );
    }
    expect(readFileSync(join(process.cwd(), "app/api/ask/route.ts"), "utf8")).toContain("source.context_id");
  });

  it("allows authenticated workspace actors", () => {
    expect(() => requirePrivateControlActor(actor("user:owner@example.com"))).not.toThrow();
  });
});
