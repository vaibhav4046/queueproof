import { describe, expect, it } from "vitest";
import { assertSafeExternalUrl } from "../packages/security/src/index";

describe("assertSafeExternalUrl", () => {
  it("allows an ordinary public HTTPS destination", () => {
    expect(assertSafeExternalUrl("https://api.hydradb.com/v2/query").hostname).toBe("api.hydradb.com");
  });

  it("rejects plaintext HTTP", () => {
    expect(() => assertSafeExternalUrl("http://api.hydradb.com")).toThrow(/HTTPS/);
  });

  it.each([
    ["cloud instance metadata", "https://169.254.169.254/latest/meta-data/"],
    ["link-local range", "https://169.254.1.1/"],
    ["IPv4-mapped IPv6 metadata", "https://[::ffff:169.254.169.254]/"],
    ["IPv6 unique-local", "https://[fd00::1]/"],
    ["IPv6 link-local", "https://[fe80::1]/"],
    ["carrier-grade NAT", "https://100.64.0.1/"],
    ["loopback name", "https://localhost/"],
    ["loopback v4", "https://127.0.0.1/"],
    ["loopback v6", "https://[::1]/"],
    ["unspecified address", "https://0.0.0.0/"],
    ["RFC1918 10/8", "https://10.0.0.5/"],
    ["RFC1918 192.168/16", "https://192.168.1.1/"],
    ["RFC1918 172.16/12", "https://172.20.0.1/"],
    ["mDNS suffix", "https://printer.local/"],
    ["internal suffix", "https://db.internal/"],
  ])("blocks %s", (_label, target) => {
    expect(() => assertSafeExternalUrl(target)).toThrow(/Private-network/);
  });
});
