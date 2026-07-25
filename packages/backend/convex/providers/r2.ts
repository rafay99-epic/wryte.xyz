/**
 * Cloudflare R2 provider — the S3 API, signed with `aws4fetch`.
 *
 * `aws4fetch` over `@aws-sdk/client-s3` on purpose: SigV4 plus `fetch` is the
 * entire dependency surface we need (2.5 kB, zero transitive deps) and it is
 * Cloudflare's own documented approach for R2. The full AWS SDK would add
 * megabytes for a presigner and a paginator we deliberately don't use.
 *
 * Only four operations are needed, mirroring the other provider modules:
 *   PutObject / ListObjectsV2 / DeleteObject / HeadBucket
 *
 * Object URLs are built from the credential's `public_base_url` rather than
 * presigned: a URL written into a document has to outlive any signature.
 */
"use node";

import { AwsClient } from "aws4fetch";
import { mapR2Error, throwMediaError } from "./errors";
import {
  normalizeKeyPrefix,
  parseListObjectsV2Xml,
  type R2ListedObject,
  type R2Secret,
  uniqueObjectKey,
} from "./shared";

export type { R2Secret } from "./shared";

export interface R2UploadResult {
  url: string;
  externalId: string;
  bytes: number;
  filename: string;
  mime: string;
}

export interface R2ListItem {
  externalId: string;
  filename: string;
  size: number;
  url: string;
}

/** R2 speaks the S3 API at an account-scoped endpoint, region fixed to `auto`. */
function client(creds: R2Secret): AwsClient {
  return new AwsClient({
    accessKeyId: creds.access_key_id,
    secretAccessKey: creds.secret_access_key,
    service: "s3",
    region: "auto",
  });
}

function bucketUrl(creds: R2Secret): string {
  return `https://${creds.account_id}.r2.cloudflarestorage.com/${encodeURIComponent(creds.bucket)}`;
}

/** Percent-encodes each key segment while keeping `/` as a path separator. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function objectUrl(creds: R2Secret, key: string): string {
  return `${bucketUrl(creds)}/${encodeKey(key)}`;
}

/** The URL we persist — public, unsigned, and stable for the life of the object. */
export function publicUrlForKey(creds: R2Secret, key: string): string {
  return `${creds.public_base_url}/${encodeKey(key)}`;
}

/**
 * S3 errors come back as an XML body. Surface `<Message>` when present so the
 * error log says "Access Denied" rather than just a status code.
 */
async function readErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await res.text();
    const message = body.match(/<Message>([\s\S]*?)<\/Message>/)?.[1];
    if (message) return message.trim();
  } catch {
    // Body already consumed or unreadable — fall through.
  }
  return `${fallback} (HTTP ${String(res.status)})`;
}

async function failed(
  res: Response,
  operation: "upload" | "list" | "delete" | "ping",
  fallback: string,
): Promise<never> {
  const message = await readErrorMessage(res, fallback);
  throwMediaError({
    code: mapR2Error({ status: res.status, message }),
    message,
    provider: "r2",
    operation,
  });
}

export async function uploadOne(
  creds: R2Secret,
  file: { buffer: Buffer; mime: string; filename: string },
  opts: { prefix?: string } = {},
): Promise<R2UploadResult> {
  const key = uniqueObjectKey(normalizeKeyPrefix(opts.prefix), file.filename);
  const res = await client(creds).fetch(objectUrl(creds, key), {
    method: "PUT",
    body: new Uint8Array(file.buffer),
    headers: {
      "content-type": file.mime,
      // Keys are unique per upload, so the object at a given URL never
      // changes — safe to let browsers and Cloudflare cache it forever.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!res.ok) await failed(res, "upload", "R2 upload failed");

  return {
    url: publicUrlForKey(creds, key),
    externalId: key,
    bytes: file.buffer.byteLength,
    filename: file.filename,
    mime: file.mime,
  };
}

export async function listObjects(
  creds: R2Secret,
  opts: { prefix?: string; continuationToken?: string; max?: number } = {},
): Promise<{ items: R2ListItem[]; nextCursor: string | null }> {
  const url = new URL(bucketUrl(creds));
  url.searchParams.set("list-type", "2");
  url.searchParams.set("max-keys", String(Math.min(opts.max ?? 50, 1000)));
  const prefix = normalizeKeyPrefix(opts.prefix);
  if (prefix) url.searchParams.set("prefix", `${prefix}/`);
  if (opts.continuationToken) {
    url.searchParams.set("continuation-token", opts.continuationToken);
  }

  const res = await client(creds).fetch(url.toString());
  if (!res.ok) await failed(res, "list", "R2 list failed");

  const parsed = parseListObjectsV2Xml(await res.text());
  return {
    items: parsed.items.map((object: R2ListedObject) => ({
      externalId: object.key,
      filename: object.key.split("/").pop() ?? object.key,
      size: object.size,
      url: publicUrlForKey(creds, object.key),
    })),
    nextCursor: parsed.nextContinuationToken ?? null,
  };
}

export async function deleteObject(
  creds: R2Secret,
  key: string,
): Promise<void> {
  const res = await client(creds).fetch(objectUrl(creds, key), {
    method: "DELETE",
  });
  // DeleteObject is idempotent: S3 answers 204 whether or not the key existed.
  // A 404 from a proxy in front of the bucket means the same thing to us.
  if (!res.ok && res.status !== 404) {
    await failed(res, "delete", "R2 delete failed");
  }
}

/** HeadBucket — the cheapest call that proves the keys and bucket both work. */
export async function ping(creds: R2Secret): Promise<void> {
  const res = await client(creds).fetch(bucketUrl(creds), { method: "HEAD" });
  if (!res.ok) {
    // HEAD has no body, so there is no `<Message>` to surface.
    throwMediaError({
      code: mapR2Error({ status: res.status }),
      message:
        res.status === 404
          ? `Bucket "${creds.bucket}" was not found in this Cloudflare account.`
          : `R2 rejected the credentials (HTTP ${String(res.status)}).`,
      provider: "r2",
      operation: "ping",
    });
  }
}
