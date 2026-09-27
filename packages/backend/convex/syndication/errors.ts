export const SYNDICATION_ERROR_CODES = [
  "invalid_token",
  "needs_pro",
  "rate_limited",
  "validation",
  "remote_deleted",
  "config_missing",
  "network",
  "vault_error",
  "internal",
] as const;

export type SyndicationErrorCode = (typeof SYNDICATION_ERROR_CODES)[number];

export function isRetryable(code: SyndicationErrorCode): boolean {
  return (
    code === "rate_limited" || code === "network" || code === "vault_error"
  );
}

export type SyndicationFailure = {
  ok: false;
  code: SyndicationErrorCode;
  message: string;
  retryAfterMs?: number;
};

export type SyndicationResult<T> = { ok: true; data: T } | SyndicationFailure;
