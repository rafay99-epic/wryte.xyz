/**
 * Media provider types — a thin re-export of the backend registry.
 *
 * `packages/backend/convex/media/_lib/providers.ts` is the single source of
 * truth and is browser-safe by design (it imports only `convex/values`). This
 * module exists so front-end code keeps the short `@wryte/logic/types/media`
 * import path without a hand-maintained mirror that can drift from the schema.
 */

export type {
  CredentialField,
  CredentialProvider,
  CredentialSource,
  MediaCredentialStatus,
  MediaProvider,
  MediaProviderEntry,
  MediaProviderIconName,
  MediaProviderLocationKind,
  NormalizedMediaItem,
  SecretFormat,
} from "@wryte/backend/media/_lib/providers";
export {
  ALL_CREDENTIAL_PROVIDERS,
  ALL_MEDIA_PROVIDERS,
  CREDENTIAL_PROVIDER_IDS,
  describeMediaLocation,
  getMediaProvider,
  isCredentialProvider,
  isMediaProvider,
  MEDIA_PROVIDER_IDS,
  MEDIA_PROVIDER_LABELS,
  MEDIA_PROVIDERS,
  resolveDefaultProvider,
} from "@wryte/backend/media/_lib/providers";
