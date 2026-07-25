/**
 * Cloudinary provider — credentials are passed inline on every call so
 * concurrent requests can use different accounts without trampling
 * the global `cloudinary.config()`.
 *
 * v2 SDK only — `cloudinary.v1` is legacy and not used.
 */
"use node";

import { v2 as cloudinary } from "cloudinary";
import { mapCloudinaryError, throwMediaError } from "./errors";
import { randomSuffix, splitExtension } from "./shared";

/**
 * Cloudinary derives a public_id from the uploaded file's name — but only when
 * it *has* one. We upload a base64 data URI, which carries no filename, so
 * `use_filename` has nothing to work from and Cloudinary falls back to a random
 * id like `quzsyj0cloja0zzh3ggq`. That id is what the media library then shows
 * as the file's name, and because it has no extension the grid can't tell it's
 * an image and renders a placeholder instead of a preview.
 *
 * Passing the public_id explicitly fixes both. The extension is stripped —
 * Cloudinary appends the real format itself — and the characters are reduced to
 * what reads cleanly in a URL.
 */
function publicIdFromFilename(filename: string): string {
  const slug = splitExtension(filename)
    .stem.normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "file"}-${randomSuffix()}`;
}

export interface CloudinaryCreds {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

export interface CldUploadResult {
  url: string;
  externalId: string;
  bytes: number;
  filename: string;
  mime: string;
  width?: number;
  height?: number;
}

export interface CldListItem {
  externalId: string;
  filename: string;
  size: number;
  url: string;
  format?: string;
  width?: number;
  height?: number;
  uploadedAt?: number;
}

export async function uploadOne(
  creds: CloudinaryCreds,
  file: { buffer: Buffer; mime: string; filename: string },
  opts: { folder?: string; publicId?: string } = {},
): Promise<CldUploadResult> {
  const dataUri = `data:${file.mime};base64,${file.buffer.toString("base64")}`;
  try {
    const publicId = opts.publicId ?? publicIdFromFilename(file.filename);
    const res = await cloudinary.uploader.upload(dataUri, {
      ...creds,
      resource_type: "auto",
      ...(opts.folder ? { folder: opts.folder } : {}),
      public_id: publicId,
      // The suffix in `publicId` already disambiguates, so let Cloudinary use
      // the id verbatim rather than appending a second random segment.
      unique_filename: false,
      use_filename: false,
    });
    const result: CldUploadResult = {
      url: res.secure_url,
      externalId: res.public_id,
      bytes: res.bytes,
      filename: file.filename,
      mime: file.mime,
    };
    if (typeof res.width === "number") result.width = res.width;
    if (typeof res.height === "number") result.height = res.height;
    return result;
  } catch (err) {
    throwMediaError(
      {
        code: mapCloudinaryError(err),
        message:
          (err as { message?: string })?.message ?? "Cloudinary upload failed",
        provider: "cloudinary",
        operation: "upload",
      },
      err,
    );
  }
}

export async function listResources(
  creds: CloudinaryCreds,
  opts: { folder?: string; nextCursor?: string; max?: number } = {},
): Promise<{ items: CldListItem[]; nextCursor?: string }> {
  try {
    const res = await cloudinary.api.resources({
      ...creds,
      type: "upload",
      max_results: opts.max ?? 50,
      ...(opts.folder ? { prefix: opts.folder } : {}),
      ...(opts.nextCursor ? { next_cursor: opts.nextCursor } : {}),
    });
    const resources = (res as { resources: unknown[] }).resources as Array<{
      public_id: string;
      secure_url: string;
      bytes: number;
      format?: string;
      width?: number;
      height?: number;
      created_at?: string;
    }>;
    const items: CldListItem[] = resources.map((r) => {
      // public_ids carry no extension. Re-attaching the stored format keeps the
      // displayed name honest and lets the library recognise it as an image —
      // including for files uploaded before public_ids were set explicitly.
      const base = r.public_id.split("/").pop() ?? r.public_id;
      const item: CldListItem = {
        externalId: r.public_id,
        filename:
          r.format && !base.toLowerCase().endsWith(`.${r.format.toLowerCase()}`)
            ? `${base}.${r.format}`
            : base,
        size: r.bytes,
        url: r.secure_url,
      };
      if (r.format !== undefined) item.format = r.format;
      if (r.width !== undefined) item.width = r.width;
      if (r.height !== undefined) item.height = r.height;
      if (r.created_at !== undefined)
        item.uploadedAt = Date.parse(r.created_at);
      return item;
    });
    const out: { items: CldListItem[]; nextCursor?: string } = { items };
    const next = (res as { next_cursor?: string }).next_cursor;
    if (next) out.nextCursor = next;
    return out;
  } catch (err) {
    throwMediaError(
      {
        code: mapCloudinaryError(err),
        message:
          (err as { message?: string })?.message ?? "Cloudinary list failed",
        provider: "cloudinary",
        operation: "list",
      },
      err,
    );
  }
}

export async function destroy(
  creds: CloudinaryCreds,
  publicId: string,
): Promise<void> {
  try {
    // The official type declarations only list a narrow `{ resource_type, type,
    // invalidate }` options object for `destroy`, but the SDK's runtime layer
    // accepts auth credentials inline (it forwards them to the signed-URL
    // builder). Cast through `unknown` so we keep per-request creds without
    // mutating the global `cloudinary.config()`.
    await cloudinary.uploader.destroy(
      publicId,
      creds as unknown as { resource_type?: "image" | "raw" | "video" },
    );
  } catch (err) {
    throwMediaError(
      {
        code: mapCloudinaryError(err),
        message:
          (err as { message?: string })?.message ?? "Cloudinary delete failed",
        provider: "cloudinary",
        operation: "delete",
      },
      err,
    );
  }
}

export async function ping(creds: CloudinaryCreds): Promise<void> {
  try {
    await cloudinary.api.ping(creds);
  } catch (err) {
    throwMediaError(
      {
        code: mapCloudinaryError(err),
        message:
          (err as { message?: string })?.message ?? "Cloudinary ping failed",
        provider: "cloudinary",
        operation: "ping",
      },
      err,
    );
  }
}
