export type CloudinarySecret = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

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

export type R2Secret = {
  account_id: string;
  access_key_id: string;
  secret_access_key: string;
  bucket: string;
  public_base_url: string;
};

const R2_REQUIRED_FIELDS = [
  "account_id",
  "access_key_id",
  "secret_access_key",
  "bucket",
  "public_base_url",
] as const satisfies readonly (keyof R2Secret)[];

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
  if (parsed.hostname.endsWith(".r2.cloudflarestorage.com")) {
    throw new Error(
      "That's the S3 API endpoint, which only answers signed requests — images stored against it won't load in a browser. Use the bucket's public URL instead: enable the r2.dev subdomain under R2 → your bucket → Settings → Public access, or connect a custom domain.",
    );
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

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

export function splitExtension(filename: string): {
  stem: string;
  ext: string;
} {
  const dot = filename.lastIndexOf(".");
  return dot > 0
    ? { stem: filename.slice(0, dot), ext: filename.slice(dot) }
    : { stem: filename, ext: "" };
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function uniqueObjectKey(prefix: string, filename: string): string {
  const { stem, ext } = splitExtension(filename);
  const name = `${stem}-${randomSuffix()}${ext}`;
  return prefix ? `${prefix}/${name}` : name;
}

export type R2ListedObject = {
  key: string;
  size: number;
  etag?: string;
};

export type R2ListObjectsResult = {
  items: R2ListedObject[];
  nextContinuationToken?: string;
};

const NAMED_XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

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
