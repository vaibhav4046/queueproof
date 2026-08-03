import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const managementRoutes = [
  "app/api/connectors/route.ts",
  "app/api/connectors/[id]/configure/route.ts",
  "app/api/connectors/[id]/discover/route.ts",
  "app/api/connectors/[id]/proof/route.ts",
  "app/api/connectors/[id]/sync/route.ts",
  "app/api/connectors/[id]/verify/route.ts",
  "app/api/hydradb/configure/route.ts",
  "app/api/providers/route.ts",
  "app/api/documents/route.ts",
];

describe("management route authorization", () => {
  it.each(managementRoutes)("requires a server-resolved actor: %s", (route) => {
    const source = readFileSync(join(process.cwd(), route), "utf8");
    expect(source).toMatch(/requireRequestActor\s*\(/);
    expect(source).not.toMatch(/workspaceId\s*=\s*(?:payload|body|request)/);
  });
});
