"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { getUploadErrorMessage } from "@wryte/logic/lib/batch-image-upload";
import {
  MEDIA_PROVIDER_LABELS,
  type MediaProvider,
  resolveDefaultProvider,
} from "@wryte/logic/types/media";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MediaLibraryItem = {
  externalId: string;
  name: string;
  url: string;
  size: number;
  provider: MediaProvider;
  sha?: string;
  path?: string;
};

export type MediaFilter = MediaProvider | "all";

export type ProjectMediaContext = {
  mediaStorageMode?: MediaProvider;
  githubRepo?: string;
  githubBranch?: string;
  mediaPath?: string;
} | null;

export type MediaProviderOption = {
  provider: MediaProvider;
  isDefault: boolean;
  configured: boolean;
  status?: "active" | "verifying" | "invalid" | "rotating";
};

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

const NO_PROVIDERS: MediaProviderOption[] = [];

const PAGE_SIZE = 40;

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
    ) ?? NO_PROVIDERS;

  const configuredTabs = useMemo(
    () => providerTabs.filter((tab) => tab.configured),
    [providerTabs],
  );

  const uploadProvider = useMemo<MediaProvider>(() => {
    if (filter !== "all") return filter;
    const projectDefault = resolveDefaultProvider(project?.mediaStorageMode);
    if (providerTabs.length === 0) return projectDefault;
    const defaultTab = providerTabs.find((t) => t.provider === projectDefault);
    if (defaultTab?.configured) return projectDefault;
    return configuredTabs[0]?.provider ?? projectDefault;
  }, [filter, project?.mediaStorageMode, providerTabs, configuredTabs]);

  const listMedia = useAction(api.media.uploads.list);

  const mediaPath = project?.mediaPath;

  const requestedRef = useRef<Set<MediaProvider>>(new Set());
  const queueRef = useRef<MediaProvider[]>([]);
  const pumpingRef = useRef(false);
  const generationRef = useRef(0);

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
        const message = getUploadErrorMessage(err, "Failed to load media");
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

  const queueUnrequested = useCallback(
    (tabs: MediaProviderOption[]) => {
      let queued = false;
      for (const tab of tabs) {
        if (requestedRef.current.has(tab.provider)) continue;
        requestedRef.current.add(tab.provider);
        queueRef.current.push(tab.provider);
        queued = true;
      }
      if (queued) void pump();
    },
    [pump],
  );

  useEffect(() => {
    if (!enabled) return;
    queueUnrequested(configuredTabs);
  }, [configuredTabs, enabled, queueUnrequested]);

  const resetAll = useCallback(() => {
    generationRef.current += 1;
    requestedRef.current.clear();
    queueRef.current = [];
    setByProvider({});
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the project changes.
  useEffect(() => {
    resetAll();
  }, [projectId, resetAll]);

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

  const loadMore = useCallback(() => {
    const next = visibleProviders.find(
      (provider) =>
        (byProviderRef.current[provider]?.cursor ?? null) !== null &&
        byProviderRef.current[provider]?.status !== "loading",
    );
    if (next) void loadPage(next, true);
  }, [visibleProviders, loadPage]);

  const refresh = useCallback(async () => {
    resetAll();
    if (enabled) queueUnrequested(configuredTabs);
  }, [resetAll, enabled, queueUnrequested, configuredTabs]);

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
    filter,
    setFilter,
    uploadProvider,
    providerTabs,
    configuredTabs,
    items,
    errors,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    getSelectionValue,
  };
}
