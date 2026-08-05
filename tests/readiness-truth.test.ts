import { describe, expect, it } from "vitest";
import { GET } from "../app/api/health/ready/route";

describe("readiness truth", () => {
  it("keeps workspace connector verification visible without claiming it is a process gate", async () => {
    const body = await (await GET()).json();
    expect(body.informational.connectorHealth).toEqual({
      readinessGate: false,
      endpoint: "/api/connectors",
      detail: "Workspace-scoped provider verification is reported separately from process readiness.",
    });
  });
});
