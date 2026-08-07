const CALLBACK_ERROR_MESSAGE =
  "We could not complete sign-in. No source was connected or changed. Try again, or use work email.";

/**
 * Translate only QueueProof-owned auth error codes into user-facing copy. Never reflect an
 * arbitrary provider or callback error from the query string into the page.
 */
export function queueProofAuthErrorMessage(
  raw: string | string[] | undefined,
): string {
  const code = Array.isArray(raw) ? raw[0] : raw;
  return code === "callback" ? CALLBACK_ERROR_MESSAGE : "";
}
