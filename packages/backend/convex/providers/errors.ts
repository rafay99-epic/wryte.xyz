/**
 * Closed-enum taxonomy for media errors and provider-specific mapping.
 *
 * Every provider failure that surfaces to the user is normalized into a
 * `MediaErrorCode`, then mapped to a friendly toast string on the client
 * (see src/lib/media-errors.ts). Raw provider errors are written to the
 * `mediaErrorLog` table for forensic debugging, never shown to users.
 */
import { ConvexError } from "convex/values";

export type MediaErrorCode =
  | "STORAGE_FULL"
  | "AUTH_INVALID"
  | "AUTH_FORBIDDEN"
  | "RATE_LIMITED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MIME"
  | "PROJECT_QUOTA"
  | "VAULT_UNAVAILABLE"
  | "PROVIDER_DOWN"
  | "UNKNOWN";

/**
 * Structured error data shipped to the client over Convex. The index
 * signature satisfies Convex's `Value` type so we can pass the object
 * straight to `ConvexError` without an intermediate cast.
 */
export interface MediaErrorData {
  code: MediaErrorCode;
  message: string;
  provider?: string;
  operation?: string;
  [key: string]: string | undefined;
}

/** Convenience for throwing a typed Convex error from anywhere. */
export function throwMediaError(data: MediaErrorData): never {
  throw new ConvexError(data);
}

/**
 * Provider-specific normalization. Each provider's error shape differs; this
 * is the single place we keep the mapping rules.
 */
export function mapUploadThingError(err: unknown): MediaErrorCode {
  const e = err as {
    code?: string;
    status?: number;
    message?: string;
    response?: { status?: number };
  };
  const status = e?.status ?? e?.response?.status;
  const code = e?.code ?? "";
  const message = (e?.message ?? "").toLowerCase();

  if (code === "QUOTA_EXCEEDED" || status === 413) return "STORAGE_FULL";
  if (message.includes("storage") && message.includes("limit"))
    return "STORAGE_FULL";
  if (status === 401) return "AUTH_INVALID";
  if (status === 403) return "AUTH_FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  if (status !== undefined && status >= 500 && status < 600)
    return "PROVIDER_DOWN";
  return "UNKNOWN";
}

export function mapCloudinaryError(err: unknown): MediaErrorCode {
  const e = err as {
    http_code?: number;
    error?: { http_code?: number; message?: string };
    message?: string;
  };
  const status = e?.http_code ?? e?.error?.http_code;
  const message = (e?.message ?? e?.error?.message ?? "").toLowerCase();

  if (
    message.includes("storage limit") ||
    message.includes("quota") ||
    status === 420
  )
    return "STORAGE_FULL";
  if (status === 401) return "AUTH_INVALID";
  if (status === 403) return "AUTH_FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  if (status !== undefined && status >= 500 && status < 600)
    return "PROVIDER_DOWN";
  return "UNKNOWN";
}

export function mapGithubError(err: unknown): MediaErrorCode {
  const e = err as { status?: number; message?: string };
  const status = e?.status;
  const message = (e?.message ?? "").toLowerCase();

  if (status === 422 && message.includes("storage")) return "STORAGE_FULL";
  if (status === 401) return "AUTH_INVALID";
  if (status === 403 || status === 404) return "AUTH_FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  if (status !== undefined && status >= 500 && status < 600)
    return "PROVIDER_DOWN";
  return "UNKNOWN";
}

/**
 * Friendly fallback message paired with each code — used in `mediaErrorLog.errorMessage`
 * and as a last-resort message if the client's media-errors map ever lags behind.
 */
export const DEFAULT_MESSAGES: Record<MediaErrorCode, string> = {
  STORAGE_FULL:
    "Your storage provider is out of space. Upgrade your plan or delete unused images.",
  AUTH_INVALID:
    "Storage credentials are invalid. Reconnect or rotate your API key in project settings.",
  AUTH_FORBIDDEN:
    "Storage credentials don't have permission for this action. Check your provider settings.",
  RATE_LIMITED:
    "Your storage provider is rate-limiting requests. Try again in a moment.",
  FILE_TOO_LARGE:
    "This file is larger than the upload limit. Try a smaller file (max 16 MB).",
  UNSUPPORTED_MIME:
    "This file type isn't supported. Use PNG, JPEG, WebP, GIF, SVG, or AVIF.",
  PROJECT_QUOTA:
    "You've reached this project's media quota. Delete unused images or contact support.",
  VAULT_UNAVAILABLE:
    "Secret storage is temporarily unavailable. Try again in a moment.",
  PROVIDER_DOWN:
    "Your storage provider is experiencing an outage. Try again in a moment.",
  UNKNOWN: "Something went wrong. Please try again.",
};

/**
 * Best-effort redaction of a raw error before persisting it. Replaces
 * anything that looks like an API key with `[REDACTED]`.
 */
export function redactError(err: unknown): string {
  try {
    const raw = JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}));
    return raw
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
      .replace(/api_secret[^,}]+/gi, "api_secret:[REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .slice(0, 2000);
  } catch {
    return "[unredactable]";
  }
}
