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
  return new UTApi({ token, logLevel: "Error" });
}

function buildFileUrl(token: string, key: string): string {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (decoded && typeof decoded.appId === "string" && decoded.appId) {
      return `https://${decoded.appId}.ufs.sh/f/${key}`;
    }
  } catch {}
  return `https://utfs.io/f/${key}`;
}

export async function uploadOne(
  token: string,
  file: { buffer: Buffer; name: string; mime: string },
): Promise<UTUploadResult> {
  const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mime });
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
  return {
    items: res.files.map((f) => ({
      externalId: f.key,
      filename: f.name,
      size: f.size,
      url: buildFileUrl(token, f.key),
      uploadedAt: f.uploadedAt,
    })),
    hasMore: res.hasMore,
  };
}

export async function deleteFiles(
  token: string,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  await client(token).deleteFiles(keys);
}

export async function ping(token: string): Promise<void> {
  await client(token).listFiles({ limit: 1 });
}

export function buildToken(opts: {
  apiKey: string;
  appId: string;
  regions: string[];
}): string {
  return Buffer.from(JSON.stringify(opts)).toString("base64");
}
