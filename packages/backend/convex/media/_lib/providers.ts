/**
 * Media provider registry — the single source of truth.
 *
 * Every place that used to hard-code the
 * `"github" | "uploadthing" | "cloudinary"` union now reads from here:
 *   - Convex arg/schema validators import {@link mediaProviderValidator} or
 *     {@link credentialProviderValidator}
 *   - The Node-side upload/list/delete dispatcher looks up an adapter by id
 *     (see `convex/providers/registry.ts`)
 *   - The settings UI maps {@link ALL_MEDIA_PROVIDERS} and renders each entry's
 *     credential fields, labels and hints — no per-provider JSX
 *   - `@wryte/logic/types/media` is a thin re-export so the front end and the
 *     backend can never drift
 *
 * This file is import-safe from the browser: it pulls in only `convex/values`
 * (isomorphic) — never `uploadthing`, `cloudinary`, `aws4fetch`, or any
 * `"use node"` module. Those live behind the adapters.
 *
 * **Adding a provider is a two-file change:**
 *   1. here — an id in {@link MEDIA_PROVIDER_IDS}, an entry in
 *      {@link MEDIA_PROVIDERS}, and a matching `v.literal(...)` in the
 *      validators below
 *   2. one adapter in `convex/providers/registry.ts`
 *
 * Nothing else. The settings form, the wizard, the provider tabs, the icon and
 * the location string all read the entry — `icon` names a glyph rather than
 * importing one, so a provider reusing an existing glyph needs no UI change.
 *
 * Three layers keep that promise honest: the compile-time assertions below fail
 * if ids and validators drift, `ADAPTERS` is typed exhaustively so a new id has
 * nowhere to hide, and `tests/media-providers.test.ts` checks the things types
 * can't — duplicate field keys, a secret marked for display, a `raw` provider
 * with more than one input.
 */

import { v } from "convex/values";

/**
 * Where the credential for a provider comes from.
 * - `vault`: the user pastes provider credentials, we keep them in WorkOS
 *   Vault and hand the raw secret to the adapter (`mediaCredentials` row).
 * - `github-oauth`: no `mediaCredentials` row — the adapter reuses the user's
 *   existing GitHub OAuth token and the project's repo settings.
 */
export type CredentialSource = "vault" | "github-oauth";

/**
 * How the credential fields are serialised into the single vault secret.
 * - `raw`: one field, stored verbatim (UploadThing's opaque token).
 * - `json`: a JSON object keyed by {@link CredentialField.key}.
 */
export type SecretFormat = "raw" | "json";

/**
 * One input in a provider's credential form. The settings UI renders these
 * generically, so a new provider needs no new component code.
 */
export type CredentialField = {
  /** Key in the vault secret JSON — also the `publicConfig` key. */
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Password input with a reveal toggle; cleared after save, never echoed. */
  secret?: boolean;
  /** Save is allowed with this field blank. */
  optional?: boolean;
  /** Omit from the vault secret — display-only config (default: included). */
  excludeFromSecret?: boolean;
  /** Mirror into `publicConfig` so it can be shown back after save. */
  showAfterSave?: boolean;
};

/**
 * Which glyph represents a provider. A name rather than a component so this
 * module stays browser-safe and free of any UI dependency; `@wryte/ui`'s
 * `MediaProviderIcon` maps these to icons in one exhaustive place, so a new
 * provider that reuses an existing name needs no UI change at all.
 */
export type MediaProviderIconName = "repo" | "upload" | "cloud" | "bucket";

/**
 * What `project.mediaPath` means for a provider, and therefore how a location
 * is written for a human.
 * - `repo-path`: a directory in a git repo, shown with a leading slash
 * - `prefix`: a folder / key prefix inside a bucket
 * - `flat`: no namespacing — nothing meaningful to show
 */
export type MediaProviderLocationKind = "repo-path" | "prefix" | "flat";

export type MediaProviderEntry = {
  id: MediaProvider;
  /** Display name used in dropdowns, badges, toasts and error prefixes. */
  label: string;
  /** One-line description for the storage-backend picker card. */
  description: string;
  credentialSource: CredentialSource;
  secretFormat: SecretFormat;
  /** Empty for `github-oauth` providers. */
  fields: CredentialField[];
  /** "Get your keys →" link target. Absent for GitHub (OAuth already done). */
  dashboardUrl?: string;
  /** Explains what `project.mediaPath` means for this provider. */
  pathHint: string;
  icon: MediaProviderIconName;
  locationKind: MediaProviderLocationKind;
};

/**
 * The set of provider ids. Adding one here (plus a {@link MEDIA_PROVIDERS}
 * entry, a `v.literal` in the validators, and an adapter) is the entire
 * surface for a new storage backend.
 */
export const MEDIA_PROVIDER_IDS = [
  "github",
  "uploadthing",
  "cloudinary",
  "r2",
] as const;

export type MediaProvider = (typeof MEDIA_PROVIDER_IDS)[number];

/**
 * Providers configured with user-supplied credentials. GitHub is excluded —
 * it rides the OAuth token the user already granted. These are the ids that
 * can appear in the `mediaCredentials` table.
 */
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
        // Half of Cloudinary's credential pair. On its own it identifies the
        // account; next to the secret it's full access — so it gets the same
        // treatment as the secret and never leaves the vault.
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
        // Same reasoning as Cloudinary's API key: it's one half of the token
        // pair, not public metadata.
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

/**
 * Convex validator for the full provider union — used by `schema.ts` for
 * `projects.mediaStorageMode` / `media.provider`, and by the media actions.
 */
export const mediaProviderValidator = v.union(
  v.literal("github"),
  v.literal("uploadthing"),
  v.literal("cloudinary"),
  v.literal("r2"),
);

/**
 * Convex validator for providers that own a `mediaCredentials` row. GitHub is
 * absent by design — it has no stored secret.
 */
export const credentialProviderValidator = v.union(
  v.literal("uploadthing"),
  v.literal("cloudinary"),
  v.literal("r2"),
);

/**
 * Compile-time guards: each validator's inferred union and the id tuple it
 * mirrors must be mutually assignable. If a provider is added to one but not
 * the other, these lines stop compiling. Type-only — no runtime cost.
 */
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

/** All entries in declaration order — for mapping in the settings UI. */
export const ALL_MEDIA_PROVIDERS: MediaProviderEntry[] = MEDIA_PROVIDER_IDS.map(
  (id) => MEDIA_PROVIDERS[id],
);

/** Entries the user connects with their own credentials, in declaration order. */
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

/**
 * Human-readable destination for a provider, or null when it has none.
 * Keeps "where do my files go?" out of per-provider branches in the UI.
 */
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

/**
 * Resolves a project's `mediaStorageMode` to the provider that uploads and
 * listings route to. An absent or unrecognised mode falls back to GitHub so
 * writes still resolve for projects created before the field existed.
 */
export function resolveDefaultProvider(
  mode: string | null | undefined,
): MediaProvider {
  return typeof mode === "string" && isMediaProvider(mode) ? mode : "github";
}

/** Display labels keyed by id — convenience for badges and toasts. */
export const MEDIA_PROVIDER_LABELS: Record<MediaProvider, string> =
  Object.fromEntries(
    MEDIA_PROVIDER_IDS.map((id) => [id, MEDIA_PROVIDERS[id].label]),
  ) as Record<MediaProvider, string>;

/** Credential verification state machine, shared by the DB and the UI. */
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

/** A normalised listing row, identical in shape for every provider. */
export type NormalizedMediaItem = {
  externalId: string;
  filename: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
  /** GitHub blob SHA — only present for the GitHub provider. */
  sha?: string;
};
