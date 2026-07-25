"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  useGithubInvalidation,
  useGithubMedia,
} from "@wryte/logic/hooks/use-github";
import { canShowMediaLibrary } from "@wryte/logic/lib/media-provider";
import {
  type MediaProvider,
  resolveDefaultProvider,
} from "@wryte/logic/types/media";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  mediaStorageMode?: MediaProvider;
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

/** A connected provider, as returned by `media.credentialsDb.listEnabledProviders`. */
export type MediaProviderOption = {
  provider: MediaProvider;
  isDefault: boolean;
  configured: boolean;
  status?: "active" | "verifying" | "invalid" | "rotating";
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
  // Which connected provider is being browsed. `null` means "follow the
  // project's default", so a settings change is picked up without extra
  // wiring — and switching tabs is one setState for every consumer.
  const [selected, setSelected] = useState<MediaProvider | null>(null);

  const providerTabs: MediaProviderOption[] =
    useQuery(
      api.media.credentialsDb.listEnabledProviders,
      enabled ? { projectId } : "skip",
    ) ?? [];

  /** Connected providers only — what a picker should ever offer. */
  const configuredTabs = useMemo(
    () => providerTabs.filter((tab) => tab.configured),
    [providerTabs],
  );

  const provider = useMemo(() => {
    if (selected) return selected;
    const projectDefault = resolveDefaultProvider(project?.mediaStorageMode);
    // The default can point at a provider that was never connected (or was
    // disconnected since). Uploading there fails, so fall through to something
    // that actually works rather than routing into a guaranteed error.
    if (providerTabs.length === 0) return projectDefault;
    const defaultTab = providerTabs.find((t) => t.provider === projectDefault);
    if (defaultTab?.configured) return projectDefault;
    return configuredTabs[0]?.provider ?? projectDefault;
  }, [selected, project?.mediaStorageMode, providerTabs, configuredTabs]);

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

  // Per-provider listing cache. Provider APIs are billed per call and every
  // one is a server round-trip, so flipping between tabs must not re-list a
  // bucket that was already fetched. Entries only clear on an explicit
  // `refresh()` or after an upload.
  const cacheRef = useRef<
    Map<MediaProvider, { items: MediaLibraryItem[]; cursor: string | null }>
  >(new Map());
  const providerCursorRef = useRef<string | null>(null);
  // Monotonic token. Each fetch bumps it; in-flight fetches whose token is
  // no longer the latest drop their result instead of stomping on the state
  // for the newer (e.g. for a different project, or a different provider)
  // fetch. The previous boolean lock dropped the NEW fetch when an old one
  // was still running.
  const fetchSeqRef = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clears cached listings when the project changes.
  useEffect(() => {
    cacheRef.current.clear();
  }, [projectId]);

  const fetchProvider = useCallback(
    async (opts?: { append?: boolean }) => {
      if (isGithub || !enabled) return;
      const seq = ++fetchSeqRef.current;
      const append = opts?.append ?? false;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsProviderLoading(true);
        setError(null);
      }
      try {
        const cursor = append ? providerCursorRef.current : null;
        const res = await listMedia({
          projectId,
          provider,
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        // A newer fetch superseded this one (e.g. projectId or provider
        // changed) — drop the result rather than overwriting the newer state.
        if (seq !== fetchSeqRef.current) return;
        const newItems: MediaLibraryItem[] = res.items.map((it) => ({
          externalId: it.externalId,
          name: it.filename,
          url: it.url,
          size: it.size,
        }));
        setProviderItems((prev) => {
          const merged = append ? [...prev, ...newItems] : newItems;
          cacheRef.current.set(provider, {
            items: merged,
            cursor: res.nextCursor,
          });
          return merged;
        });
        providerCursorRef.current = res.nextCursor;
        setHasMore(res.nextCursor !== null);
      } catch (err) {
        if (seq !== fetchSeqRef.current) return;
        const data = (err as { data?: { message?: string } })?.data;
        const message =
          data?.message ??
          (err instanceof Error ? err.message : "Failed to load media");
        setError(message);
        if (!append) setProviderItems([]);
        setHasMore(false);
      } finally {
        if (seq === fetchSeqRef.current) {
          if (append) setIsLoadingMore(false);
          else setIsProviderLoading(false);
        }
      }
    },
    [enabled, isGithub, listMedia, projectId, provider],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchProvider is stable per (projectId, provider); reset when either, the provider mode, or enabled changes.
  useEffect(() => {
    if (isGithub || !enabled) return;
    setError(null);

    // Already listed this provider in this session — restore it instead of
    // spending another provider API call to learn the same thing.
    const cached = cacheRef.current.get(provider);
    if (cached) {
      setProviderItems(cached.items);
      providerCursorRef.current = cached.cursor;
      setHasMore(cached.cursor !== null);
      return;
    }

    setProviderItems([]);
    setHasMore(false);
    providerCursorRef.current = null;
    void fetchProvider({ append: false });
  }, [enabled, isGithub, projectId, provider, fetchProvider]);

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
      cacheRef.current.delete(provider);
      providerCursorRef.current = null;
      setHasMore(false);
      await fetchProvider({ append: false });
    }
  }, [fetchProvider, invalidateMedia, isGithub, refetchGithub, provider]);

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
    /** The provider currently being browsed — selected tab, else the default. */
    provider,
    /** Switch which connected provider the library reads and writes. */
    setProvider: setSelected,
    /** Every provider the project knows about, including an unconnected default. */
    providerTabs,
    /**
     * Only providers that can actually be used. Pickers that upload should
     * offer these — an unconnected provider in the list is a dead end.
     */
    configuredTabs,
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
