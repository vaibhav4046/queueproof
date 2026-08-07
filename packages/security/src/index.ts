const WHOLE_SECRET_PATTERNS = [
  /\bvcp_[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\blin_api_[A-Za-z0-9_-]{12,}\b/g,
  /\bqp_(?:live|test)_[A-Za-z0-9_-]{12,}\b/g,
  /\battio_[A-Za-z0-9_-]{12,}\b/gi,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
];

// Preserve field names and surrounding structure so logs remain diagnosable while only
// credential values disappear. The exact key boundary avoids treating nearby prose such as
// `access_token_count` or `client_secret_rotation` as credentials.
const CREDENTIAL_VALUE_PATTERN = /(\b(?:(?:[a-z0-9]+[_-])*(?:api[_-]?(?:key|token)|auth[_-]?token|access[_-]?token|bot[_-]?token|refresh[_-]?token|oauth[_-]?client[_-]?secret|client[_-]?secret|encryption[_-]?key|token|secret|password)|(?:auth0|vercel|turso|queueproof|oauth|slack|github|gitlab|linear|attio|stripe|google|openai|hydradb|hydra|notion|intercom|jira|posthog|dropbox|gmail)(?:apiKey|apiToken|authToken|accessToken|botToken|refreshToken|oauthClientSecret|clientSecret|encryptionKey|token|secret|password))(?![a-z0-9_-])["']?\s*[:=]\s*["']?)[^"',;\s&#{}\[\]]+/gi;

const VALUE_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(\bBearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]"],
  [CREDENTIAL_VALUE_PATTERN, "$1[REDACTED]"],
  [/(\b(?:https?|libsql):\/\/[^\s/@:]+:)[^\s/@]+(@[^\s]+)/gi, "$1[REDACTED]$2"],
];

const SENSITIVE_FIELD_NAMES = new Set([
  "apikey",
  "apitoken",
  "authtoken",
  "accesstoken",
  "bottoken",
  "refreshtoken",
  "oauthclientsecret",
  "clientsecret",
  "token",
  "secret",
  "password",
]);

const NAMESPACED_SENSITIVE_FIELD = /^(?:auth0|vercel|turso|queueproof|oauth|slack|github|gitlab|linear|attio|stripe|google|openai|hydradb|hydra|notion|intercom|jira|posthog|dropbox|gmail)(?:apikey|apitoken|authtoken|accesstoken|bottoken|refreshtoken|oauthclientsecret|clientsecret|encryptionkey|token|secret|password)$/;

const isSensitiveFieldName = (name: string) => {
  const compactName = name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SENSITIVE_FIELD_NAMES.has(compactName) ||
    NAMESPACED_SENSITIVE_FIELD.test(compactName) ||
    /(?:^|[_-])(?:api[_-]?(?:key|token)|auth[_-]?token|access[_-]?token|bot[_-]?token|refresh[_-]?token|oauth[_-]?client[_-]?secret|client[_-]?secret|encryption[_-]?key|token|secret|password)$/i.test(name);
};

export function redactSecrets(value: string): string {
  const labelledValuesRedacted = VALUE_SECRET_PATTERNS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
  return WHOLE_SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED]"),
    labelledValuesRedacted,
  );
}

/**
 * Recursively sanitises provider metadata before it crosses a storage or response boundary.
 * Exact credential-bearing field names are replaced even when their raw value has no token
 * prefix; all other strings still receive the same inline/provider-token redaction as logs.
 */
export function redactSecretsDeep(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactSecretsDeep);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    isSensitiveFieldName(key) && nested !== null && nested !== undefined
      ? "[REDACTED]"
      : redactSecretsDeep(nested),
  ]));
}

export function sanitiseSpreadsheetCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function isPotentialPromptInjection(text: string): boolean {
  return /(?:ignore|override|forget)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions|reveal\s+(?:secrets?|credentials?|system prompts?|environment variables?)|execute\s+(?:shell|command)/i.test(
    text,
  );
}

/**
 * Rejects requests that try to turn retrieval into credential disclosure or data exfiltration.
 * Narrow compound patterns keep normal operational questions (including mentions of tokens)
 * usable while enforcing a boundary before any provider request is issued.
 */
export function hostileQueryReason(text: string): string | null {
  const credential = /\b(?:secrets?|credentials?|passwords?|api[ _-]?keys?|access[ _-]?tokens?|auth(?:entication)?[ _-]?(?:codes?|tokens?)|bearer tokens?|system prompts?|environment variables?)\b/i;
  const disclosure = /\b(?:reveal|show|print|dump|export|send|upload|transmit|exfiltrat(?:e|ion))\b/i;
  const instructionOverride = /\b(?:ignore|override|forget)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions\b/i;
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
