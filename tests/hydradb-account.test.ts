import { describe, expect, it } from "vitest";
import {
  DEFAULT_HYDRADB_BASE_URL,
  hydraDbBaseUrlForAttach,
} from "../lib/server/hydradb-account";

describe("HydraDB credential destination", () => {
  it("uses the official API origin when the browser does not supply one", () => {
    expect(hydraDbBaseUrlForAttach(undefined)).toBe(DEFAULT_HYDRADB_BASE_URL);
  });

  it("allows only the exact origin approved by server configuration", () => {
    expect(hydraDbBaseUrlForAttach(
      "https://hydra-api.example.test/",
      "https://hydra-api.example.test",
    )).toBe("https://hydra-api.example.test");
  });

  it("rejects a caller-selected public HTTPS origin before the key can be sent", () => {
    try {
      hydraDbBaseUrlForAttach("https://credential-capture.example.test");
      throw new Error("Expected the unapproved origin to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(400);
    }
  });

  it("rejects credentials, paths, queries, fragments, HTTP, and private hosts", () => {
    const unsafe = [
      "https://user:password@api.hydradb.com",
      "https://api.hydradb.com/v2",
      "https://api.hydradb.com?token=secret",
      "https://api.hydradb.com#fragment",
      "http://api.hydradb.com",
      "https://127.0.0.1",
    ];
    for (const candidate of unsafe) {
      expect(() => hydraDbBaseUrlForAttach(candidate)).toThrow();
    }
  });
});
