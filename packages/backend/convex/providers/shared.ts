/**
 * Shared, runtime-agnostic helpers for provider modules. Anything here must
 * work in both the default Convex runtime and the Node-only one (no
 * `"use node"` directive) — which also makes it unit-testable with plain
 * `bun test`, no Convex harness.
 */

/** Cloudinary credential blob stored in vault. */
export type CloudinarySecret = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

/** Parses the vault-stored secret for a Cloudinary credential. */
export function parseCloudinarySecret(raw: string): CloudinarySecret {
  const parsed = JSON.parse(raw) as Partial<CloudinarySecret>;
  if (!parsed.cloud_name || !parsed.api_key || !parsed.api_secret) {
    throw new Error(
      "Cloudinary credentials are missing required fields (cloud_name, api_key, api_secret)",
    );
  }
  return {
    cloud_name: parsed.cloud_name,
    api_key: parsed.api_key,
    api_secret: parsed.api_secret,
  };
}

/* ------------------------------------------------------------------ */
/*  Cloudflare R2                                                      */
/* ------------------------------------------------------------------ */

/**
 * Cloudflare R2 credential blob stored in vault.
 *
 * `public_base_url` is required, not a nicety: R2 buckets are private by
 * default and have no derivable public hostname, so it is the only way to
 * build a URL we can persist into a document. Presigned URLs expire (7 days
 * max) and would rot inside published content.
 */
export type R2Secret = {
  account_id: string;
  access_key_id: string;
  secret_access_key: string;
  bucket: string;
  /** Public origin the bucket is served from, no trailing slash. */
  public_base_url: string;
};

const R2_REQUIRED_FIELDS = [
  "account_id",
  "access_key_id",
  "secret_access_key",
  "bucket",
  "public_base_url",
] as const satisfies readonly (keyof R2Secret)[];

/**
 * Validates and normalises a public base URL. Rejects anything that isn't an
 * absolute http(s) origin, since the result is concatenated with object keys
 * and stored in user content.
 */
export function normalizePublicBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(
      `Public base URL must be an absolute URL, e.g. https://cdn.example.com (got "${raw}")`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Public base URL must use http:// or https://");
  }
  // The S3 endpoint is the single most tempting wrong answer here — it's the
  // URL Cloudflare shows next to the API tokens. Accepting it stores object
  // URLs that every browser gets `InvalidArgument: Authorization` from, because
  // that host only answers SigV4-signed requests. Nothing downstream can detect
  // this, so it has to be refused at the point of entry.
  if (parsed.hostname.endsWith(".r2.cloudflarestorage.com")) {
    throw new Error(
      "That's the S3 API endpoint, which only answers signed requests — images stored against it won't load in a browser. Use the bucket's public URL instead: enable the r2.dev subdomain under R2 → your bucket → Settings → Public access, or connect a custom domain.",
    );
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

/** Parses the vault-stored secret for a Cloudflare R2 credential. */
export function parseR2Secret(raw: string): R2Secret {
  let parsed: Partial<Record<keyof R2Secret, unknown>>;
  try {
    parsed = JSON.parse(raw) as Partial<Record<keyof R2Secret, unknown>>;
  } catch {
    throw new Error(
      `Cloudflare R2 credentials must be JSON with ${R2_REQUIRED_FIELDS.join(", ")}`,
    );
  }
  const missing = R2_REQUIRED_FIELDS.filter((key) => {
    const value = parsed[key];
    return typeof value !== "string" || value.trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(
      `Cloudflare R2 credentials are missing required fields (${missing.join(", ")})`,
    );
  }
  return {
    account_id: String(parsed.account_id).trim(),
    access_key_id: String(parsed.access_key_id).trim(),
    secret_access_key: String(parsed.secret_access_key).trim(),
    bucket: String(parsed.bucket).trim(),
    public_base_url: normalizePublicBaseUrl(String(parsed.public_base_url)),
  };
}

/**
 * Reduces a user-supplied directory setting to a safe object-key prefix:
 * no leading/trailing slashes, no empty or dot segments. `mediaPath` doubles
 * as a GitHub repo directory and an object-store prefix, so a `..` segment
 * would otherwise escape the intended location.
 */
export function normalizeKeyPrefix(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .split("/")
    .map((segment) => segment.trim())
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");
}

/** Splits a filename into its stem and its final extension (dot included). */
export function splitExtension(filename: string): {
  stem: string;
  ext: string;
} {
  const dot = filename.lastIndexOf(".");
  return dot > 0
    ? { stem: filename.slice(0, dot), ext: filename.slice(dot) }
    : { stem: filename, ext: "" };
}

/** Short disambiguator appended to uploaded names. */
export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Builds a collision-free object key. Plain `PutObject` overwrites silently,
 * where UploadThing dedupes and Cloudinary versions — so a short random
 * suffix keeps "upload the same filename twice" from destroying the first
 * copy that documents may already reference.
 */
export function uniqueObjectKey(prefix: string, filename: string): string {
  const { stem, ext } = splitExtension(filename);
  const name = `${stem}-${randomSuffix()}${ext}`;
  return prefix ? `${prefix}/${name}` : name;
}

/* ---- ListObjectsV2 XML ---- */

export type R2ListedObject = {
  key: string;
  size: number;
  etag?: string;
};

export type R2ListObjectsResult = {
  items: R2ListedObject[];
  /** Only set when the response was truncated. */
  nextContinuationToken?: string;
};

const NAMED_XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/**
 * Single-pass entity decode. One pass matters: sequential `replace` calls
 * would turn `&amp;lt;` into `<` instead of the literal `&lt;`.
 */
function decodeXmlEntities(input: string): string {
  return input.replace(
    /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,
    (match) => {
      const named = NAMED_XML_ENTITIES[match];
      if (named !== undefined) return named;
      const codePoint = match.startsWith("&#x")
        ? Number.parseInt(match.slice(3, -1), 16)
        : Number.parseInt(match.slice(2, -1), 10);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    },
  );
}

function tagValue(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1];
}

/**
 * Minimal ListObjectsV2 response reader.
 *
 * The S3 API has no JSON listing, so this is the one place we touch XML.
 * A dedicated parser dependency would be a lot of bytes for four tags —
 * but the parser is exercised by `tests/r2.test.ts` precisely because
 * hand-rolled parsing is where this would otherwise rot.
 *
 * Keys ending in `/` are dropped: S3 clients create those as zero-byte
 * "directory" markers and they are not media.
 */
export function parseListObjectsV2Xml(xml: string): R2ListObjectsResult {
  const items: R2ListedObject[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const block = match[1] ?? "";
    const rawKey = tagValue(block, "Key");
    if (rawKey === undefined) continue;
    const key = decodeXmlEntities(rawKey);
    if (key === "" || key.endsWith("/")) continue;

    const rawSize = Number(tagValue(block, "Size") ?? "0");
    const item: R2ListedObject = {
      key,
      size: Number.isFinite(rawSize) ? rawSize : 0,
    };
    const rawEtag = tagValue(block, "ETag");
    if (rawEtag !== undefined) {
      item.etag = decodeXmlEntities(rawEtag).replace(/^"+|"+$/g, "");
    }
    items.push(item);
  }

  const isTruncated = (tagValue(xml, "IsTruncated") ?? "").trim() === "true";
  const token = tagValue(xml, "NextContinuationToken");
  if (isTruncated && token) {
    return { items, nextContinuationToken: decodeXmlEntities(token).trim() };
  }
  return { items };
}
