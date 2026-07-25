/**
 * UploadThing provider — per-instance `UTApi` configured with the caller's
 * token. We never share a UTApi instance across users since each user
 * provides their own UPLOADTHING_TOKEN.
 *
 * Notes on the v7 SDK:
 * - Single `UPLOADTHING_TOKEN` env / option (base64 JSON containing apiKey/appId/regions).
 * - `getFileUrls` is deprecated; use `generateSignedURL` instead.
 * - `uploadFiles` accepts an array; each result is { data, error } — never throws on a single failure.
 * - The response object exposes `url`/`appUrl` as Proxy getters that emit a
 *   "deprecated" `console.warn` the moment they're read; the SDK's own debug
 *   log subsystem touches them while serializing the result. We never read
 *   those fields (we use `ufsUrl`), but we still need to stop the SDK from
 *   reading them — done by setting `logLevel: "Error"` so the SDK's internal
 *   debug logs never fire.
 */
"use node";

import { UTApi } from "uploadthing/server";
import { mapUploadThingError, throwMediaError } from "./errors";

export interface UTUploadResult {
  url: string;
  externalId: string;
  bytes: number;
  filename: string;
  mime: string;
}

export interface UTListItem {
  externalId: string;
  filename: string;
  size: number;
  uploadedAt?: number;
  url?: string;
}

function client(token: string): UTApi {
  // `logLevel: "Error"` silences the SDK's internal debug/info logs. Side
  // effect: it prevents the SDK from invoking the deprecation getters on
  // its own response object when serializing log annotations.
  return new UTApi({ token, logLevel: "Error" });
}

/**
 * UploadThing's `listFiles` response only contains file keys + metadata —
 * it does not include URLs. We construct them from the appId baked into
 * the base64-encoded UPLOADTHING_TOKEN (`{ apiKey, appId, regions }`).
 *
 * Falls back to the legacy `utfs.io` host if the token can't be decoded;
 * UploadThing still serves files from that domain.
 */
function buildFileUrl(token: string, key: string): string {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (decoded && typeof decoded.appId === "string" && decoded.appId) {
      return `https://${decoded.appId}.ufs.sh/f/${key}`;
    }
  } catch {
    // Bad token shape — fall through to legacy.
  }
  return `https://utfs.io/f/${key}`;
}

export async function uploadOne(
  token: string,
  file: { buffer: Buffer; name: string; mime: string },
): Promise<UTUploadResult> {
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mime });
  // `File` is available in the Convex Node runtime via the standard web platform globals.
  const uploadable = new File([blob], file.name, { type: file.mime });

  const res = await client(token).uploadFiles([uploadable]);
  const first = Array.isArray(res) ? res[0] : res;
  if (!first || first.error) {
    throwMediaError(
      {
        code: mapUploadThingError(first?.error),
        message: first?.error?.message ?? "UploadThing upload failed",
        provider: "uploadthing",
        operation: "upload",
      },
      first?.error,
    );
  }
  const data = first.data;
  return {
    url: data.ufsUrl,
    externalId: data.key,
    bytes: data.size,
    filename: data.name,
    mime: file.mime,
  };
}

export async function listFiles(
  token: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: UTListItem[]; hasMore: boolean }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const res = await client(token).listFiles({ limit, offset });
  // The v7 response shape: { files: [...], hasMore: boolean }
  const files = (
    res as unknown as {
      files: Array<{
        key: string;
        name: string;
        size: number;
        uploadedAt?: number;
      }>;
      hasMore?: boolean;
    }
  ).files;
  return {
    items: files.map((f) => ({
      externalId: f.key,
      filename: f.name,
      size: f.size,
      url: buildFileUrl(token, f.key),
      ...(f.uploadedAt !== undefined ? { uploadedAt: f.uploadedAt } : {}),
    })),
    hasMore: Boolean((res as unknown as { hasMore?: boolean }).hasMore),
  };
}

export async function deleteFiles(
  token: string,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  await client(token).deleteFiles(keys);
}

/**
 * Lightweight credential check — list a single file. Cheaper than upload.
 */
export async function ping(token: string): Promise<void> {
  await client(token).listFiles({ limit: 1 });
}

/**
 * Encode the {apiKey, appId, regions} triple into the v7 UPLOADTHING_TOKEN
 * format. Provided so admins can hand-craft tokens from raw credentials;
 * end-users paste the token directly.
 */
export function buildToken(opts: {
  apiKey: string;
  appId: string;
  regions: string[];
}): string {
  return Buffer.from(JSON.stringify(opts)).toString("base64");
}
