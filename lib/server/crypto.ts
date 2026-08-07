import { runtimeEnv } from "./runtime";
import { sha256 } from "../../packages/security/src";

type CipherEnvelope = {
  v: 1;
  iv: string;
  ciphertext: string;
};

const base64Encode = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64Decode = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function encryptionKey(): Promise<CryptoKey> {
  const secret = runtimeEnv().QUEUEPROOF_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("QUEUEPROOF_ENCRYPTION_KEY must be configured with at least 32 characters.");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(plaintext),
  );
  const envelope: CipherEnvelope = {
    v: 1,
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope);
}

export async function decryptSecret(serialized: string): Promise<string> {
  const envelope = JSON.parse(serialized) as CipherEnvelope;
  if (envelope.v !== 1) throw new Error("Unsupported credential envelope version.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(envelope.iv) },
    await encryptionKey(),
    base64Decode(envelope.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

export async function secretFingerprint(secret: string): Promise<string> {
  return (await sha256(secret)).slice(0, 16);
}


