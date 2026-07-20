/**
 * Syndication error taxonomy — every failure a provider client can produce
 * maps to one of these codes, stored on the `syndication_posts` row so the
 * UI can render a human explanation and decide whether Retry makes sense.
 * Import-safe from the browser (no runtime deps).
 */

export const SYNDICATION_ERROR_CODES = [
  /** Platform rejected the token (devto 401 / hashnode UNAUTHENTICATED). */
  "invalid_token",
  /** Hashnode's API is behind the publication Pro plan (301/HTML response). */
  "needs_pro",
  /** Platform throttled us (devto 429 + Retry-After). */
  "rate_limited",
  /** Platform rejected the payload (devto 422 / hashnode BAD_USER_INPUT). */
  "validation",
  /** Stored remote id no longer exists — post was deleted on the platform. */
  "remote_deleted",
  /** Project is missing config the cross-post needs (siteUrl, publicationId). */
  "config_missing",
  /** Timeout / 5xx / DNS — transient, worth retrying. */
  "network",
  /** Could not read the token from the vault. */
  "vault_error",
  /** Anything unmapped. */
  "internal",
] as const;

export type SyndicationErrorCode = (typeof SYNDICATION_ERROR_CODES)[number];

/** Codes where an automatic scheduled retry can plausibly succeed. */
export function isRetryable(code: SyndicationErrorCode): boolean {
  return (
    code === "rate_limited" || code === "network" || code === "vault_error"
  );
}

export type SyndicationFailure = {
  ok: false;
  code: SyndicationErrorCode;
  message: string;
  /** rate_limited only — honor the platform's Retry-After. */
  retryAfterMs?: number;
};

export type SyndicationResult<T> = { ok: true; data: T } | SyndicationFailure;
