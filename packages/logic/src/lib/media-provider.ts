import type { MediaProvider } from "@wryte/logic/types/media";

export { resolveDefaultProvider } from "@wryte/logic/types/media";

/**
 * Whether the Library tab can list media for a provider.
 *
 * Credential-backed providers are always listable — an unconfigured one simply
 * returns an empty page. GitHub is the exception: without a repo and a media
 * directory there is nothing to read from.
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
