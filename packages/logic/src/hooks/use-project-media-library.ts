"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useGithubInvalidation } from "@wryte/logic/hooks/use-github";
import {
  MEDIA_PROVIDER_LABELS,
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
  /** Which bucket this came from — listings are merged, so rows carry it. */
  provider: MediaProvider;
  /** GitHub blob SHA — required for deletion. */
  sha?: string;
  /** GitHub repo-relative path (no leading slash) for frontmatter selection. */
  path?: string;
};

/** The provider tabs double as filters, plus a merged "everything" view. */
export type MediaFilter = MediaProvider | "all";

export type ProjectMediaContext = {
  mediaStorageMode?: MediaProvider;
  githubRepo?: string;
  githubBranch?: string;
  mediaPath?: string;
} | null;

/** A connected provider, as returned by `media.credentialsDb.listEnabledProviders`. */
export type MediaProviderOption = {
  provider: MediaProvider;
  isDefault: boolean;
  configured: boolean;
  status?: "active" | "verifying" | "invalid" | "rotating";
};

/** One provider that couldn't be listed. The rest of the page carries on. */
export type MediaProviderError = {
  provider: MediaProvider;
  label: string;
  message: string;
};

type ProviderState = {
  items: MediaLibraryItem[];
  cursor: string | null;
  status: "idle" | "loading" | "loaded" | "error";
  error: string | null;
};

const EMPTY_STATE: ProviderState = {
  items: [],
  cursor: null,
  status: "idle",
  error: null,
};

type UseProjectMediaLibraryArgs = {
  projectId: Id<"projects">;
  project: ProjectMediaContext | undefined;
  /** When false, no provider is contacted at all. */
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

/** How many rows one page asks a provider for. */
const PAGE_SIZE = 40;

/**
 * The media library's data layer, shared by the library page and the three
 * editor pickers.
 *
 * Every provider is listed through the same Convex action — including GitHub,
 * which used to take a separate client-side path and forced an `isGithub`
 * branch through most of this file.
 *
 * Three properties the UI depends on:
 *
 *  - **One fetch per provider.** Results are held per provider for the life of
 *    the hook, so switching tabs filters what's already in memory rather than
 *    re-listing a bucket. Provider APIs bill per call.
 *  - **Loaded in sequence.** Connected providers are listed one after another,
 *    a page at a time, so opening the library never fans out N concurrent
 *    actions.
 *  - **Failures stay local.** A provider that errors records its own message
 *    and the others still render — one expired key can't blank the page.
 */
export function useProjectMediaLibrary({
  projectId,
  project,
  enabled = true,
}: UseProjectMediaLibraryArgs) {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [byProvider, setByProvider] = useState<
    Partial<Record<MediaProvider, ProviderState>>
  >({});

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

  /**
   * Where an upload goes. A filtered view uploads to what you're looking at;
   * the merged view falls back to the project default, or to any connected
   * provider when that default was never set up.
   */
  const uploadProvider = useMemo<MediaProvider>(() => {
    if (filter !== "all") return filter;
    const projectDefault = resolveDefaultProvider(project?.mediaStorageMode);
    if (providerTabs.length === 0) return projectDefault;
    const defaultTab = providerTabs.find((t) => t.provider === projectDefault);
    if (defaultTab?.configured) return projectDefault;
    return configuredTabs[0]?.provider ?? projectDefault;
  }, [filter, project?.mediaStorageMode, providerTabs, configuredTabs]);

  const { invalidateMedia } = useGithubInvalidation();
  const listMedia = useAction(api.media.uploads.list);

  const mediaPath = project?.mediaPath;

  // Providers already asked for, so a re-render can't re-queue them.
  const requestedRef = useRef<Set<MediaProvider>>(new Set());
  const queueRef = useRef<MediaProvider[]>([]);
  const pumpingRef = useRef(false);
  // Bumped whenever the whole view resets; in-flight pages from before the
  // reset drop their results instead of repopulating stale state.
  const generationRef = useRef(0);

  // `loadPage` reads the current cursor without taking `byProvider` as a
  // dependency, which would rebuild it on every page and restart the queue.
  const byProviderRef = useRef(byProvider);
  useEffect(() => {
    byProviderRef.current = byProvider;
  }, [byProvider]);

  const loadPage = useCallback(
    async (provider: MediaProvider, append: boolean) => {
      const generation = generationRef.current;
      const cursor = append
        ? (byProviderRef.current[provider]?.cursor ?? null)
        : null;

      setByProvider((prev) => ({
        ...prev,
        [provider]: {
          ...(prev[provider] ?? EMPTY_STATE),
          status: "loading",
          error: null,
        },
      }));

      try {
        const res = await listMedia({
          projectId,
          provider,
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        });
        if (generation !== generationRef.current) return;

        const rows: MediaLibraryItem[] = res.items.map((it) => ({
          externalId: it.externalId,
          name: it.filename,
          url: it.url,
          size: it.size,
          provider,
          ...(it.sha !== undefined ? { sha: it.sha } : {}),
          // GitHub's externalId *is* the repo path, which frontmatter needs to
          // turn into a site-relative URL.
          ...(provider === "github" ? { path: it.externalId } : {}),
        }));

        setByProvider((prev) => {
          const previous = prev[provider] ?? EMPTY_STATE;
          return {
            ...prev,
            [provider]: {
              items: append ? [...previous.items, ...rows] : rows,
              cursor: res.nextCursor,
              status: "loaded",
              error: null,
            },
          };
        });
      } catch (err) {
        if (generation !== generationRef.current) return;
        const data = (err as { data?: { message?: string } })?.data;
        const message =
          data?.message ??
          (err instanceof Error ? err.message : "Failed to load media");
        setByProvider((prev) => ({
          ...prev,
          [provider]: {
            ...(prev[provider] ?? EMPTY_STATE),
            status: "error",
            error: message,
          },
        }));
      }
    },
    [listMedia, projectId],
  );

  /** Drains the queue one provider at a time — never a concurrent fan-out. */
  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    try {
      for (;;) {
        const next = queueRef.current.shift();
        if (!next) break;
        await loadPage(next, false);
      }
    } finally {
      pumpingRef.current = false;
    }
  }, [loadPage]);

  // Queue any newly-connected provider that hasn't been listed yet.
  useEffect(() => {
    if (!enabled) return;
    let queued = false;
    for (const tab of configuredTabs) {
      if (requestedRef.current.has(tab.provider)) continue;
      requestedRef.current.add(tab.provider);
      queueRef.current.push(tab.provider);
      queued = true;
    }
    if (queued) void pump();
  }, [configuredTabs, enabled, pump]);

  const resetAll = useCallback(() => {
    generationRef.current += 1;
    requestedRef.current.clear();
    queueRef.current = [];
    setByProvider({});
  }, []);

  // A different project shares nothing with this one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the project changes.
  useEffect(() => {
    resetAll();
  }, [projectId, resetAll]);

  /* ---------- Derived view ---------- */

  const visibleProviders = useMemo<MediaProvider[]>(
    () =>
      filter === "all" ? configuredTabs.map((tab) => tab.provider) : [filter],
    [filter, configuredTabs],
  );

  const items = useMemo<MediaLibraryItem[]>(
    () =>
      visibleProviders.flatMap((provider) => byProvider[provider]?.items ?? []),
    [visibleProviders, byProvider],
  );

  const errors = useMemo<MediaProviderError[]>(
    () =>
      visibleProviders
        .map((provider) => ({ provider, state: byProvider[provider] }))
        .filter((entry) => entry.state?.status === "error")
        .map((entry) => ({
          provider: entry.provider,
          label: MEDIA_PROVIDER_LABELS[entry.provider],
          message: entry.state?.error ?? "Failed to load media",
        })),
    [visibleProviders, byProvider],
  );

  const isLoading = visibleProviders.some(
    (provider) => (byProvider[provider]?.status ?? "idle") === "idle",
  );
  const isLoadingMore = visibleProviders.some(
    (provider) => byProvider[provider]?.status === "loading",
  );
  const hasMore = visibleProviders.some(
    (provider) => (byProvider[provider]?.cursor ?? null) !== null,
  );

  /** Pulls one more page, from one provider, so "load more" is never a fan-out. */
  const loadMore = useCallback(() => {
    const next = visibleProviders.find(
      (provider) =>
        (byProviderRef.current[provider]?.cursor ?? null) !== null &&
        byProviderRef.current[provider]?.status !== "loading",
    );
    if (next) void loadPage(next, true);
  }, [visibleProviders, loadPage]);

  const refresh = useCallback(async () => {
    // GitHub listings are also cached by the repo-contents query.
    await invalidateMedia();
    resetAll();
  }, [invalidateMedia, resetAll]);

  /** Value to store in frontmatter/settings when an item is selected. */
  const getSelectionValue = useCallback(
    (item: MediaLibraryItem): string => {
      if (item.provider === "github" && item.path) {
        return githubPublicPath(item.path, mediaPath);
      }
      return item.url;
    },
    [mediaPath],
  );

  return {
    /** Active tab: a provider, or "all" for the merged view. */
    filter,
    setFilter,
    /** Destination for uploads made from the current view. */
    uploadProvider,
    /** Every provider the project knows about, including an unconnected default. */
    providerTabs,
    /** Only providers that can actually be used — what pickers should offer. */
    configuredTabs,
    items,
    /** Per-provider listing failures in the current view. Never throws. */
    errors,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    getSelectionValue,
  };
}
