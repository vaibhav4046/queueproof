import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  DEPLOYMENT_OWNER_ACTOR_ID,
  createSessionValue,
  resolveFirstActor,
  verifySessionValue,
} from "../lib/server/identity";

const TEST_KEY = "session-test-key-material-32-bytes-minimum";
const originalKey = process.env.QUEUEPROOF_ENCRYPTION_KEY;

async function legacySessionValue(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TEST_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${hex}`;
}

describe("signed session values", () => {
  beforeEach(() => {
    process.env.QUEUEPROOF_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.QUEUEPROOF_ENCRYPTION_KEY;
    else process.env.QUEUEPROOF_ENCRYPTION_KEY = originalKey;
  });

  it("uses a versioned JSON payload and enforces its server expiry", async () => {
    const now = 1_800_000_000_000;
    const value = await createSessionValue("Owner@Example.com|4102444800000", now + 1_000);
    expect(value).not.toBeNull();

    const encodedPayload = value!.slice(0, value!.lastIndexOf("."));
    expect(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))).toEqual({
      v: 2,
      email: "Owner@Example.com|4102444800000",
      expiresAt: now + 1_000,
    });
    await expect(verifySessionValue(value!, now)).resolves.toMatchObject({
      id: DEPLOYMENT_OWNER_ACTOR_ID,
      email: "Owner@Example.com|4102444800000",
    });
    await expect(verifySessionValue(value!, now + 1_000)).resolves.toBeNull();
  });

  it("accepts an unexpired legacy cookie", async () => {
    const now = 1_800_000_000_000;
    const value = await legacySessionValue(`owner@example.com|${now + 1_000}`);
    await expect(verifySessionValue(value, now)).resolves.toMatchObject({
      email: "owner@example.com",
    });
  });

  it("uses the final legacy delimiter so an email cannot override the expiry", async () => {
    const now = 1_800_000_000_000;
    const value = await legacySessionValue(
      `owner@example.com|4102444800000|${now + 1_000}`,
    );

    // The old parser read the attacker-controlled middle value and accepted this cookie.
    await expect(verifySessionValue(value, now + 1_001)).resolves.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const value = await createSessionValue("owner@example.com", Date.now() + 60_000);
    const tampered = `${value!.slice(0, -1)}${value!.endsWith("0") ? "1" : "0"}`;
    await expect(verifySessionValue(tampered)).resolves.toBeNull();
  });

  it("treats the access-token session as one stable deployment owner", async () => {
    const first = await createSessionValue("first@example.com", Date.now() + 60_000);
    const second = await createSessionValue("second@example.com", Date.now() + 60_000);

    await expect(verifySessionValue(first!)).resolves.toMatchObject({
      id: DEPLOYMENT_OWNER_ACTOR_ID,
      email: "first@example.com",
    });
    await expect(verifySessionValue(second!)).resolves.toMatchObject({
      id: DEPLOYMENT_OWNER_ACTOR_ID,
      email: "second@example.com",
    });
  });

  it("selects a valid owner session before the public sandbox fallback", async () => {
    const owner = {
      id: DEPLOYMENT_OWNER_ACTOR_ID,
      email: "owner@example.com",
      displayName: "Owner",
      localDevelopment: false,
    };
    const publicActor = {
      id: "user:public-access",
      email: "public@queueproof.local",
      displayName: "Public workspace",
      localDevelopment: false,
    };
    let publicResolverCalled = false;

    await expect(resolveFirstActor([
      async () => owner,
      () => {
        publicResolverCalled = true;
        return publicActor;
      },
    ])).resolves.toEqual(owner);
    expect(publicResolverCalled).toBe(false);
  });
});
