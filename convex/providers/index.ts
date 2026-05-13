/**
 * Provider dispatcher — routes upload/list/delete/ping operations to the
 * right backend module (UploadThing / Cloudinary / GitHub).
 *
 * Callers in `convex/media.ts` and `convex/mediaCredentials.ts` use these
 * helpers so the dispatch logic lives in one place.
 */
"use node";

import * as cloudinary from "./cloudinary";
import * as github from "./github";
import { parseCloudinarySecret } from "./shared";
import * as uploadthing from "./uploadthing";

export type ProviderName = "uploadthing" | "cloudinary" | "github";

export type NormalizedUploadResult = {
  url: string;
  externalId: string;
  bytes: number;
  filename: string;
  mime: string;
  width?: number;
  height?: number;
};

export type NormalizedListItem = {
  externalId: string;
  filename: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
};

// Re-exports for callers that already import from `./providers`.
export { type CloudinarySecret, parseCloudinarySecret } from "./shared";

/**
 * UploadThing upload — token is the raw UPLOADTHING_TOKEN.
 */
export async function utUpload(
  token: string,
  file: { buffer: Buffer; mime: string; filename: string },
): Promise<NormalizedUploadResult> {
  const res = await uploadthing.uploadOne(token, {
    buffer: file.buffer,
    name: file.filename,
    mime: file.mime,
  });
  return {
    url: res.url,
    externalId: res.externalId,
    bytes: res.bytes,
    filename: res.filename,
    mime: res.mime,
  };
}

/** Cloudinary upload — raw is the vault-stored JSON. */
export async function cldUpload(
  rawSecret: string,
  file: { buffer: Buffer; mime: string; filename: string },
  opts: { folder?: string } = {},
): Promise<NormalizedUploadResult> {
  const creds = parseCloudinarySecret(rawSecret);
  const uploadOpts: { folder?: string } = {};
  if (opts.folder) uploadOpts.folder = opts.folder;
  const res = await cloudinary.uploadOne(
    creds,
    {
      buffer: file.buffer,
      mime: file.mime,
      filename: file.filename,
    },
    uploadOpts,
  );
  const out: NormalizedUploadResult = {
    url: res.url,
    externalId: res.externalId,
    bytes: res.bytes,
    filename: res.filename,
    mime: res.mime,
  };
  if (res.width !== undefined) out.width = res.width;
  if (res.height !== undefined) out.height = res.height;
  return out;
}

/** GitHub upload — token is the user's GitHub PAT. */
export async function ghUpload(
  token: string,
  spec: github.GhRepoSpec,
  file: { buffer: Buffer; mime: string; filename: string },
): Promise<NormalizedUploadResult & { sha: string }> {
  const res = await github.uploadOne(token, spec, file);
  return {
    url: res.url,
    externalId: res.externalId,
    bytes: res.bytes,
    filename: res.filename,
    mime: res.mime,
    sha: res.sha,
  };
}

/* ---- listings ---- */

export async function utList(
  token: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: NormalizedListItem[]; hasMore: boolean }> {
  const { items, hasMore } = await uploadthing.listFiles(token, opts);
  return {
    items: items
      // UT's listFiles returns metadata-only entries (no URL) until we construct
      // one in the provider. If for any reason the URL is missing, drop the row
      // instead of leaking an empty string to the UI.
      .filter((i) => typeof i.url === "string" && i.url.length > 0)
      .map((i) => ({
        externalId: i.externalId,
        filename: i.filename,
        size: i.size,
        // biome-ignore lint/style/noNonNullAssertion: filtered above
        url: i.url!,
      })),
    hasMore,
  };
}

export async function cldList(
  rawSecret: string,
  opts: { folder?: string; nextCursor?: string; max?: number } = {},
): Promise<{ items: NormalizedListItem[]; nextCursor?: string }> {
  const creds = parseCloudinarySecret(rawSecret);
  const listOpts: { folder?: string; nextCursor?: string; max?: number } = {};
  if (opts.folder !== undefined) listOpts.folder = opts.folder;
  if (opts.nextCursor !== undefined) listOpts.nextCursor = opts.nextCursor;
  if (opts.max !== undefined) listOpts.max = opts.max;
  const { items, nextCursor } = await cloudinary.listResources(creds, listOpts);
  const out: { items: NormalizedListItem[]; nextCursor?: string } = {
    items: items.map((i) => {
      const x: NormalizedListItem = {
        externalId: i.externalId,
        filename: i.filename,
        size: i.size,
        url: i.url,
      };
      if (i.width !== undefined) x.width = i.width;
      if (i.height !== undefined) x.height = i.height;
      return x;
    }),
  };
  if (nextCursor) out.nextCursor = nextCursor;
  return out;
}

export async function ghList(
  token: string,
  spec: github.GhRepoSpec,
): Promise<{ items: (NormalizedListItem & { sha: string })[] }> {
  const items = await github.listFiles(token, spec);
  return {
    items: items.map((i) => ({
      externalId: i.externalId,
      filename: i.filename,
      size: i.size,
      url: i.url,
      sha: i.sha,
    })),
  };
}

/* ---- deletes ---- */

export async function utDelete(token: string, keys: string[]): Promise<void> {
  await uploadthing.deleteFiles(token, keys);
}

export async function cldDelete(
  rawSecret: string,
  publicId: string,
): Promise<void> {
  const creds = parseCloudinarySecret(rawSecret);
  await cloudinary.destroy(creds, publicId);
}

export async function ghDelete(
  token: string,
  spec: github.GhRepoSpec,
  repoPath: string,
  sha: string,
): Promise<void> {
  await github.deleteFile(token, spec, repoPath, sha);
}

/* ---- pings ---- */

export async function utPing(token: string): Promise<void> {
  await uploadthing.ping(token);
}

export async function cldPing(rawSecret: string): Promise<void> {
  const creds = parseCloudinarySecret(rawSecret);
  await cloudinary.ping(creds);
}

export async function ghPing(
  token: string,
  spec: { owner: string; repo: string },
): Promise<void> {
  await github.ping(token, spec);
}

export { parseRepoString } from "./github";
