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

export interface MediaErrorData {
  code: MediaErrorCode;
  message: string;
  provider?: string;
  operation?: string;
  [key: string]: string | undefined;
}

export function throwMediaError(data: MediaErrorData, cause?: unknown): never {
  const error = new ConvexError(data);
  if (cause !== undefined) (error as Error).cause = cause;
  throw error;
}

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

export function mapR2Error(err: unknown): MediaErrorCode {
  const e = err as { status?: number; message?: string };
  const status = e?.status;
  const message = (e?.message ?? "").toLowerCase();

  if (message.includes("quota") || message.includes("exceeded"))
    return "STORAGE_FULL";
  if (status === 400 && message.includes("credential")) return "AUTH_INVALID";
  if (status === 401) return "AUTH_INVALID";
  if (status === 403) return "AUTH_FORBIDDEN";
  if (status === 404) return "AUTH_FORBIDDEN";
  if (status === 429 || status === 503) return "RATE_LIMITED";
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

export function redactError(err: unknown): string {
  const chain: unknown[] = [];
  let current: unknown = err;
  for (
    let depth = 0;
    current !== undefined && current !== null && depth < 4;
    depth++
  ) {
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  try {
    const raw = chain
      .map((item) =>
        JSON.stringify(item, Object.getOwnPropertyNames(item ?? {})),
      )
      .join(" <- caused by: ");
    return raw
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
      .replace(/api_secret[^,}]+/gi, "api_secret:[REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .slice(0, 4000);
  } catch {
    return "[unredactable]";
  }
}
