import { v } from "convex/values";

export type CredentialSource = "vault" | "github-oauth";

export type SecretFormat = "raw" | "json";

export type CredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  secret?: boolean;
  optional?: boolean;
  excludeFromSecret?: boolean;
  showAfterSave?: boolean;
};

export type MediaProviderIconName = "repo" | "upload" | "cloud" | "bucket";

export type MediaProviderLocationKind = "repo-path" | "prefix" | "flat";

export type MediaProviderEntry = {
  id: MediaProvider;
  label: string;
  description: string;
  credentialSource: CredentialSource;
  secretFormat: SecretFormat;
  fields: CredentialField[];
  dashboardUrl?: string;
  pathHint: string;
  icon: MediaProviderIconName;
  locationKind: MediaProviderLocationKind;
};

export const MEDIA_PROVIDER_IDS = [
  "github",
  "uploadthing",
  "cloudinary",
  "r2",
] as const;

export type MediaProvider = (typeof MEDIA_PROVIDER_IDS)[number];

export const CREDENTIAL_PROVIDER_IDS = [
  "uploadthing",
  "cloudinary",
  "r2",
] as const;

export type CredentialProvider = (typeof CREDENTIAL_PROVIDER_IDS)[number];

export const MEDIA_PROVIDERS: Record<MediaProvider, MediaProviderEntry> = {
  github: {
    id: "github",
    label: "GitHub",
    description: "Commit into the repo",
    credentialSource: "github-oauth",
    secretFormat: "raw",
    fields: [],
    pathHint:
      "Repo directory for images, e.g. public/images (Astro/Next.js) or static/images (Hugo/SvelteKit).",
    icon: "repo",
    locationKind: "repo-path",
  },
  uploadthing: {
    id: "uploadthing",
    label: "UploadThing",
    description: "Your own account",
    credentialSource: "vault",
    secretFormat: "raw",
    dashboardUrl: "https://uploadthing.com/dashboard",
    fields: [
      {
        key: "token",
        label: "UPLOADTHING_TOKEN",
        placeholder: "ut_...",
        hint: "The single base64-encoded token from your UploadThing dashboard.",
        secret: true,
      },
    ],
    pathHint: "Informational for UploadThing — files live in a flat namespace.",
    icon: "upload",
    locationKind: "flat",
  },
  cloudinary: {
    id: "cloudinary",
    label: "Cloudinary",
    description: "Your own account",
    credentialSource: "vault",
    secretFormat: "json",
    dashboardUrl: "https://console.cloudinary.com/settings/api-keys",
    fields: [
      {
        key: "cloud_name",
        label: "Cloud name",
        placeholder: "my-cloud",
        hint: "Visible in your Cloudinary URLs.",
        showAfterSave: true,
      },
      {
        key: "folder",
        label: "Folder",
        placeholder: "wryte/blog",
        hint: "Display-only label for your own reference — uploads use the media directory above.",
        optional: true,
        excludeFromSecret: true,
        showAfterSave: true,
      },
      {
        key: "api_key",
        label: "API key",
        placeholder: "123456789012345",
        secret: true,
      },
      {
        key: "api_secret",
        label: "API secret",
        placeholder: "your_api_secret",
        secret: true,
      },
    ],
    pathHint:
      "Folder prefix every upload lands under in your Cloudinary account.",
    icon: "cloud",
    locationKind: "prefix",
  },
  r2: {
    id: "r2",
    label: "Cloudflare R2",
    description: "Your own S3 bucket",
    credentialSource: "vault",
    secretFormat: "json",
    dashboardUrl: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
    fields: [
      {
        key: "account_id",
        label: "Account ID",
        placeholder: "a1b2c3d4e5f6...",
        hint: "Your Cloudflare account ID — shown on the R2 overview page.",
        showAfterSave: true,
      },
      {
        key: "bucket",
        label: "Bucket name",
        placeholder: "my-blog-media",
        showAfterSave: true,
      },
      {
        key: "public_base_url",
        label: "Public base URL",
        placeholder: "https://cdn.example.com",
        hint: "Where the bucket is served from. Every stored media URL is built from this, so it must be the public origin (custom domain or r2.dev subdomain).",
        showAfterSave: true,
      },
      {
        key: "access_key_id",
        label: "Access key ID",
        placeholder: "from an R2 API token",
        secret: true,
      },
      {
        key: "secret_access_key",
        label: "Secret access key",
        placeholder: "from an R2 API token",
        secret: true,
      },
    ],
    pathHint: "Key prefix every upload lands under, e.g. blog/images.",
    icon: "bucket",
    locationKind: "prefix",
  },
};

export const mediaProviderValidator = v.union(
  v.literal("github"),
  v.literal("uploadthing"),
  v.literal("cloudinary"),
  v.literal("r2"),
);

export const credentialProviderValidator = v.union(
  v.literal("uploadthing"),
  v.literal("cloudinary"),
  v.literal("r2"),
);

type AssertExtends<T extends true> = T;
export type _MediaProvidersInSync = AssertExtends<
  [MediaProvider] extends [typeof mediaProviderValidator.type]
    ? [typeof mediaProviderValidator.type] extends [MediaProvider]
      ? true
      : false
    : false
>;
export type _CredentialProvidersInSync = AssertExtends<
  [CredentialProvider] extends [typeof credentialProviderValidator.type]
    ? [typeof credentialProviderValidator.type] extends [CredentialProvider]
      ? true
      : false
    : false
>;

export const ALL_MEDIA_PROVIDERS: MediaProviderEntry[] = MEDIA_PROVIDER_IDS.map(
  (id) => MEDIA_PROVIDERS[id],
);

export const ALL_CREDENTIAL_PROVIDERS: MediaProviderEntry[] =
  CREDENTIAL_PROVIDER_IDS.map((id) => MEDIA_PROVIDERS[id]);

export function getMediaProvider(id: MediaProvider): MediaProviderEntry {
  return MEDIA_PROVIDERS[id];
}

export function isMediaProvider(value: string): value is MediaProvider {
  return (MEDIA_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isCredentialProvider(
  value: string,
): value is CredentialProvider {
  return (CREDENTIAL_PROVIDER_IDS as readonly string[]).includes(value);
}

export function describeMediaLocation(
  provider: MediaProvider,
  mediaPath: string | null | undefined,
): string | null {
  if (!mediaPath) return null;
  switch (MEDIA_PROVIDERS[provider].locationKind) {
    case "repo-path":
      return `/${mediaPath.replace(/^\/+/, "")}`;
    case "prefix":
      return mediaPath;
    case "flat":
      return null;
  }
}

export function resolveDefaultProvider(
  mode: string | null | undefined,
): MediaProvider {
  return typeof mode === "string" && isMediaProvider(mode) ? mode : "github";
}

export const MEDIA_PROVIDER_LABELS: Record<MediaProvider, string> =
  Object.fromEntries(
    MEDIA_PROVIDER_IDS.map((id) => [id, MEDIA_PROVIDERS[id].label]),
  ) as Record<MediaProvider, string>;

export type MediaCredentialStatus =
  | "active"
  | "verifying"
  | "invalid"
  | "rotating";

export const credentialStatusValidator = v.union(
  v.literal("active"),
  v.literal("verifying"),
  v.literal("invalid"),
  v.literal("rotating"),
);

export type NormalizedMediaItem = {
  externalId: string;
  filename: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
  sha?: string;
};
