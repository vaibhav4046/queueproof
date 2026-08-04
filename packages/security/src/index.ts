const SECRET_PATTERNS = [
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\blin_api_[A-Za-z0-9_-]{12,}\b/g,
  /\bqp_(?:live|test)_[A-Za-z0-9_-]{12,}\b/g,
  /\battio_[A-Za-z0-9_-]{12,}\b/gi,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /\b(?:api[_-]?key|api[_-]?token|auth[_-]?token|access[_-]?token|token|secret|password)\s*[:=]\s*["']?[^"',\s&]{8,}/gi,
  /\b(?:https?|libsql):\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/gi,
  /([?&](?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret)=)[^&#\s]+/gi,
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

/**
 * Rejects requests that try to turn retrieval into credential disclosure or data exfiltration.
 * Narrow compound patterns keep normal operational questions (including mentions of tokens)
 * usable while enforcing a boundary before any provider request is issued.
 */
export function hostileQueryReason(text: string): string | null {
  const credential = /\b(?:secret|credential|password|api[ _-]?key|access[ _-]?token|bearer token)\b/i;
  const disclosure = /\b(?:reveal|show|print|dump|export|send|upload|transmit|exfiltrat(?:e|ion))\b/i;
  const instructionOverride = /\b(?:ignore|override|forget)\s+(?:all\s+)?(?:previous|system|developer)\s+instructions\b/i;
  if (credential.test(text) && disclosure.test(text)) return "credential disclosure or transmission";
  if (instructionOverride.test(text) && (credential.test(text) || disclosure.test(text))) return "instruction override combined with sensitive data access";
  return null;
}

export function assertSafeExternalUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only HTTPS destinations are allowed.");

  // IPv6 literals arrive bracketed from the URL parser; normalise before matching.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  const isBlocked =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "::" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    // RFC1918 and loopback
    /^(10|127)\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    // Link-local, which covers the cloud instance metadata endpoint 169.254.169.254.
    // Omitting this was the highest-impact gap: it is the standard SSRF target for
    // stealing cloud credentials.
    /^169\.254\./.test(hostname) ||
    // Carrier-grade NAT (RFC6598), also routable to internal infrastructure.
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname) ||
    // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
    /^f[cd][0-9a-f]{2}:/.test(hostname) ||
    /^fe[89ab][0-9a-f]:/.test(hostname) ||
    // IPv4-mapped IPv6 forms such as ::ffff:169.254.169.254.
    /^::ffff:/.test(hostname);

  if (isBlocked) {
    throw new Error("Private-network destinations are not allowed.");
  }
  return url;
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
