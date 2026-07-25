/**
 * Shared media provider types.
 *
 * Mirrors `convex/media/*` and `convex/providers/index.ts` validators
 * so the FE and BE agree on which providers exist.
 */

export type MediaProvider = "uploadthing" | "cloudinary" | "github";

export const MEDIA_PROVIDERS: readonly MediaProvider[] = [
  "uploadthing",
  "cloudinary",
  "github",
] as const;

/** Provider names that are configured per-project via the credentials UI. */
export type ConfigurableMediaProvider = "uploadthing" | "cloudinary";

export const CONFIGURABLE_MEDIA_PROVIDERS: readonly ConfigurableMediaProvider[] =
  ["uploadthing", "cloudinary"] as const;

/** Storage mode chosen per project — drives upload routing. */
export type MediaStorageMode = "github" | "uploadthing" | "cloudinary";

export const MEDIA_STORAGE_MODES: readonly MediaStorageMode[] = [
  "github",
  "uploadthing",
  "cloudinary",
] as const;

export type MediaCredentialStatus =
  | "active"
  | "verifying"
  | "invalid"
  | "rotating";

/** Display labels used in dropdowns, badges, and toasts. */
export const MEDIA_PROVIDER_LABELS: Record<MediaProvider, string> = {
  uploadthing: "UploadThing",
  cloudinary: "Cloudinary",
  github: "GitHub",
};

/** A normalised list item shape returned from any provider. */
export type NormalizedMediaItem = {
  externalId: string;
  filename: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
};
