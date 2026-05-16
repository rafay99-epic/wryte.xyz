import type { MediaProvider, MediaStorageMode } from "@/types/media";

/**
 * Resolve the active media provider from a project's storage mode.
 * Mirrors `resolveActiveProvider` in `convex/media/uploads.ts`.
 */
export function resolveActiveMediaProvider(
  mode: MediaStorageMode | undefined,
): MediaProvider {
  if (mode === "uploadthing" || mode === "cloudinary") return mode;
  return "github";
}

/**
 * Whether the Library tab can list media for the active provider.
 */
export function canShowMediaLibrary(
  provider: MediaProvider,
  project:
    | {
        githubRepo?: string;
        mediaPath?: string;
      }
    | null
    | undefined,
): boolean {
  if (provider === "github") {
    return Boolean(project?.githubRepo && project?.mediaPath);
  }
  return true;
}
