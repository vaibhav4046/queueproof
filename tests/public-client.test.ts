import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPublicClientValue,
  verifyPublicClientValue,
} from "../lib/server/public-client";

const TEST_KEY = "public-client-test-key-material-32-bytes";
const originalKey = process.env.QUEUEPROOF_ENCRYPTION_KEY;

describe("anonymous client rate-limit identity", () => {
  beforeEach(() => {
    process.env.QUEUEPROOF_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.QUEUEPROOF_ENCRYPTION_KEY;
    else process.env.QUEUEPROOF_ENCRYPTION_KEY = originalKey;
  });

  it("signs an opaque random nonce without browser fingerprint data", async () => {
    const now = 1_800_000_000_000;
    const nonce = "0123456789abcdef0123456789abcdef";
    const value = await createPublicClientValue(nonce, now + 60_000);
    expect(value).not.toBeNull();
    expect(value).not.toContain(nonce);
    await expect(verifyPublicClientValue(value!, now)).resolves.toEqual({
      v: 1,
      nonce,
      expiresAt: now + 60_000,
    });
  });

  it("rejects tampering and expired client cookies", async () => {
    const now = 1_800_000_000_000;
    const value = await createPublicClientValue(
      "fedcba9876543210fedcba9876543210",
      now + 1_000,
    );
    const tampered = `${value!.slice(0, -1)}${value!.endsWith("0") ? "1" : "0"}`;
    await expect(verifyPublicClientValue(tampered, now)).resolves.toBeNull();
    await expect(verifyPublicClientValue(value!, now + 1_000)).resolves.toBeNull();
  });
});
