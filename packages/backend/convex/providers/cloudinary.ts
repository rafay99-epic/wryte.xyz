"use node";

import { v2 as cloudinary } from "cloudinary";
import { mapCloudinaryError, throwMediaError } from "./errors";
import { randomSuffix, splitExtension } from "./shared";

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
    const options: CloudinaryCreds & {
      resource_type?: "image" | "raw" | "video";
    } = creds;
    await cloudinary.uploader.destroy(publicId, options);
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
