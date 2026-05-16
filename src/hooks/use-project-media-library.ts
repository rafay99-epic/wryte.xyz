"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGithubInvalidation, useGithubMedia } from "@/hooks/use-github";
import {
  canShowMediaLibrary,
  resolveActiveMediaProvider,
} from "@/lib/media-provider";
import type { MediaStorageMode } from "@/types/media";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/** Provider-agnostic media item for library grids and pickers. */
export type MediaLibraryItem = {
  externalId: string;
  name: string;
  url: string;
  size: number;
  /** GitHub blob SHA — required for deletion. */
  sha?: string;
  /** GitHub repo-relative path (no leading slash) for frontmatter selection. */
  path?: string;
};

export type ProjectMediaContext = {
  mediaStorageMode?: MediaStorageMode;
  githubRepo?: string;
  githubBranch?: string;
  mediaPath?: string;
} | null;

type UseProjectMediaLibraryArgs = {
  projectId: Id<"projects">;
  project: ProjectMediaContext | undefined;
  /** When false, skips provider API fetches (GitHub query also disabled). */
  enabled?: boolean;
};

function githubPublicPath(repoPath: string, mediaPath?: string): string {
  const mediaRoot = mediaPath?.replace(/^\/+|\/+$/g, "");
  const normalizedRepoPath = repoPath.replace(/^\/+/, "");
  const relativePath =
    mediaRoot && normalizedRepoPath.startsWith(`${mediaRoot}/`)
      ? normalizedRepoPath.slice(mediaRoot.length + 1)
      : normalizedRepoPath.slice(normalizedRepoPath.lastIndexOf("/") + 1);
  const publicRoot = mediaRoot?.startsWith("public/")
    ? mediaRoot.slice("public/".length)
    : mediaRoot;

  return `/${publicRoot ? `${publicRoot}/` : ""}${relativePath}`;
}

export function useProjectMediaLibrary({
  projectId,
  project,
  enabled = true,
}: UseProjectMediaLibraryArgs) {
  const provider = useMemo(
    () => resolveActiveMediaProvider(project?.mediaStorageMode),
    [project?.mediaStorageMode],
  );

  const isGithub = provider === "github";
  const hasGithubConfig = Boolean(project?.githubRepo && project?.mediaPath);
  const showLibrary = canShowMediaLibrary(provider, project);

  const githubEnabled = enabled && isGithub && hasGithubConfig;

  const {
    data: githubData,
    isLoading: isGithubLoading,
    refetch: refetchGithub,
  } = useGithubMedia({
    repo: githubEnabled ? (project?.githubRepo ?? null) : null,
    branch: project?.githubBranch ?? "main",
    path: githubEnabled ? (project?.mediaPath ?? null) : null,
  });

  const { invalidateMedia } = useGithubInvalidation();
  const listMedia = useAction(api.media.uploads.list);

  const [providerItems, setProviderItems] = useState<MediaLibraryItem[]>([]);
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const providerCursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchProvider = useCallback(
    async (opts?: { append?: boolean }) => {
      if (isGithub || !enabled) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const append = opts?.append ?? false;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsProviderLoading(true);
        setError(null);
      }
      try {
        const args: {
          projectId: Id<"projects">;
          cursor?: string;
          limit?: number;
        } = { projectId, limit: 100 };
        const cursor = append ? providerCursorRef.current : null;
        if (cursor) args.cursor = cursor;
        const res = await listMedia(args);
        const newItems: MediaLibraryItem[] = res.items.map((it) => ({
          externalId: it.externalId,
          name: it.filename,
          url: it.url,
          size: it.size,
        }));
        setProviderItems((prev) =>
          append ? [...prev, ...newItems] : newItems,
        );
        providerCursorRef.current = res.nextCursor;
        setHasMore(res.nextCursor !== null);
      } catch (err) {
        const data = (err as { data?: { message?: string } })?.data;
        const message =
          data?.message ??
          (err instanceof Error ? err.message : "Failed to load media");
        setError(message);
        if (!append) setProviderItems([]);
        setHasMore(false);
      } finally {
        inFlightRef.current = false;
        if (append) setIsLoadingMore(false);
        else setIsProviderLoading(false);
      }
    },
    [enabled, isGithub, listMedia, projectId],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchProvider is stable per projectId; reset when provider mode or enabled changes.
  useEffect(() => {
    if (isGithub || !enabled) return;
    setProviderItems([]);
    setError(null);
    setHasMore(false);
    providerCursorRef.current = null;
    void fetchProvider({ append: false });
  }, [enabled, isGithub, projectId, fetchProvider]);

  const items: MediaLibraryItem[] = useMemo(() => {
    if (isGithub) {
      return (githubData?.files ?? [])
        .filter(
          (f) => typeof f.downloadUrl === "string" && f.downloadUrl.length > 0,
        )
        .map((f) => ({
          externalId: f.path,
          name: f.name,
          url: f.downloadUrl,
          size: f.size,
          sha: f.sha,
          path: f.path,
        }));
    }
    return providerItems.filter(
      (i) => typeof i.url === "string" && i.url.length > 0,
    );
  }, [isGithub, githubData?.files, providerItems]);

  const isLoading = isGithub ? isGithubLoading : isProviderLoading;

  const loadMore = useCallback(() => {
    void fetchProvider({ append: true });
  }, [fetchProvider]);

  const refresh = useCallback(async () => {
    if (isGithub) {
      await invalidateMedia();
      void refetchGithub();
    } else {
      providerCursorRef.current = null;
      setHasMore(false);
      await fetchProvider({ append: false });
    }
  }, [fetchProvider, invalidateMedia, isGithub, refetchGithub]);

  /** Value to store in frontmatter/settings when an item is selected. */
  const getSelectionValue = useCallback(
    (item: MediaLibraryItem): string => {
      if (provider === "github" && item.path) {
        return githubPublicPath(item.path, project?.mediaPath);
      }
      return item.url;
    },
    [project?.mediaPath, provider],
  );

  return {
    provider,
    isGithub,
    hasGithubConfig,
    showLibrary,
    items,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    getSelectionValue,
  };
}
