const SECRET_PATTERNS = [
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"',\s]{8,}/gi,
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED]"),
    value,
  );
}

export function sanitiseSpreadsheetCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function isPotentialPromptInjection(text: string): boolean {
  return /(?:ignore|override|forget)\s+(?:all\s+)?(?:previous|system|developer)\s+instructions|reveal\s+(?:secrets|credentials|system prompt)|execute\s+(?:shell|command)/i.test(
    text,
  );
}

export function assertSafeExternalUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS destinations are allowed.");
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^(10|127)\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error("Private-network destinations are not allowed.");
  }
  return url;
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

