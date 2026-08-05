export const CONNECTOR_PROOF_MAX_AGE_HOURS = 7 * 24;

export type ConnectorProofFreshness = {
  status: "current" | "stale" | "unverified";
  ageHours: number | null;
  maxAgeHours: number;
  expiresAt: string | null;
};

/**
 * Describe the age of the latest connector verification without turning provider
 * freshness into an application-readiness claim. A provider outage must remain visible,
 * but it must not make the whole QueueProof process look unavailable.
 */
export function connectorProofFreshness(
  verifiedAt: unknown,
  nowMs = Date.now(),
): ConnectorProofFreshness {
  if (typeof verifiedAt !== "string" || verifiedAt.trim() === "") {
    return {
      status: "unverified",
      ageHours: null,
      maxAgeHours: CONNECTOR_PROOF_MAX_AGE_HOURS,
      expiresAt: null,
    };
  }

  const verifiedAtMs = Date.parse(verifiedAt);
  if (!Number.isFinite(verifiedAtMs)) {
    return {
      status: "unverified",
      ageHours: null,
      maxAgeHours: CONNECTOR_PROOF_MAX_AGE_HOURS,
      expiresAt: null,
    };
  }

  const maxAgeMs = CONNECTOR_PROOF_MAX_AGE_HOURS * 60 * 60 * 1_000;
  const ageMs = Math.max(0, nowMs - verifiedAtMs);
  return {
    status: ageMs <= maxAgeMs ? "current" : "stale",
    ageHours: Math.round((ageMs / (60 * 60 * 1_000)) * 10) / 10,
    maxAgeHours: CONNECTOR_PROOF_MAX_AGE_HOURS,
    expiresAt: new Date(verifiedAtMs + maxAgeMs).toISOString(),
  };
}
