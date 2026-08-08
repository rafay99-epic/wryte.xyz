"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  CONTENT_SEARCH_DEBOUNCE_MS,
  MIN_CONTENT_TERM,
} from "@wryte/backend/cms/_lib/documentContent";
import { useDebouncedValue } from "@wryte/logic/hooks/use-debounced-value";
import {
  type ContentFile,
  useGithubContentList,
  useGithubInvalidation,
} from "@wryte/logic/hooks/use-github";
import { fadeSlideUp, smoothTransition } from "@wryte/logic/lib/motion";
import {
  getTagFieldName,
  type ParsedFrontmatter,
  parseFrontmatterJson,
} from "@wryte/logic/lib/parse-frontmatter";
import { buildSearchIndex, searchItems } from "@wryte/logic/lib/search";
import { cn } from "@wryte/logic/lib/utils";
import { useBoardStore } from "@wryte/logic/stores/board-store";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useSearchStore } from "@wryte/logic/stores/search-store";
import {
  type BoardColumnDef,
  DEFAULT_BOARD_COLUMNS,
} from "@wryte/logic/types/board";
import { Button, buttonVariants } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Cloud, Plus, Settings, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SyncConflictsBanner } from "@/components/editor/sync-conflicts-banner";
import { BoardSettingsDialog } from "@/features/content-dashboard/components/board-settings-dialog";
import { ContentDashboard } from "@/features/content-dashboard/components/content-dashboard";
import type { ViewFilter } from "@/features/content-dashboard/components/content-empty-state";
import type { ContentItem } from "@/features/content-dashboard/components/content-table-row";
import {
  DeleteDocumentDialog,
  type DeleteTarget,
} from "@/features/content-dashboard/components/delete-document-dialog";
import {
  DeleteRemoteFileDialog,
  type RemoteDeleteTarget,
} from "@/features/content-dashboard/components/delete-remote-file-dialog";
import { FileImportSheet } from "@/features/content-dashboard/components/file-import-sheet";
import { useBulkDelete } from "@/features/content-dashboard/hooks/use-bulk-delete";
import { useBulkImport } from "@/features/content-dashboard/hooks/use-bulk-import";
import { ScheduleDialog } from "@/features/editor/components/schedule-dialog";
import { CreateDocumentDialog } from "@/features/new-project-document/components/create-document-dialog";

/** A file entry returned from the GitHub Contents API. */
type RemoteFile = ContentFile;

/**
 * Project detail page — thin orchestrator that fetches data, manages state,
 * and delegates rendering to `<ContentDashboard>` + dialog components.
 */
export function ProjectDetailPage({
  projectId: rawProjectId,
}: {
  projectId: string;
}) {
  const projectId = rawProjectId as Id<"projects">;
  const router = useRouter();

  const project = useQuery(api.cms.projects.get, { projectId });
  const documents = useQuery(api.cms.documents.list, { projectId });
  const boardColumns = useQuery(api.cms.boardColumns.getColumns, {
    projectId,
  }) as BoardColumnDef[] | undefined;
  const columns = boardColumns ?? DEFAULT_BOARD_COLUMNS;
  const projectDeleted = project === null;

  // Redirect to projects list if the project was deleted
  useEffect(() => {
    if (projectDeleted) {
      router.push("/projects");
    }
  }, [projectDeleted, router]);

  // Set active project in sidebar on mount; reset transient state on unmount
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
    return () => {
      useBoardStore.getState().reset();
      useSearchStore.getState().setQuery("");
    };
  }, [projectId]);

  // --- Search store (persisted per-project) ---
  const searchQuery = useSearchStore((s) => s.query);
  const setSearchQuery = useSearchStore((s) => s.setQuery);

  // Body search, scoped to this project. The client-side index below only sees
  // `excerpt` (the denormalized first ~200 characters), so a phrase from deeper
  // in an article is invisible to it — bodies live in `document_content`
  // specifically so this page's list query never reads them. This query is the
  // one that can see them: debounced, length-gated, and capped server-side.
  const debouncedQuery = useDebouncedValue(
    searchQuery.trim(),
    CONTENT_SEARCH_DEBOUNCE_MS,
  );
  const bodySearchTerm =
    debouncedQuery.length >= MIN_CONTENT_TERM ? debouncedQuery : "";
  const bodyHits = useQuery(
    api.cms.documents.searchContent,
    bodySearchTerm ? { term: bodySearchTerm, projectId } : "skip",
  );
  const bodyHitIds = useMemo(
    () => new Set((bodyHits ?? []).map((hit) => hit.documentId as string)),
    [bodyHits],
  );
  const sortOrder = useSearchStore((s) => s.getSortOrder(projectId));
  const kindFilter = useSearchStore((s) => s.getKindFilter(projectId));
  const tagFilters = useSearchStore((s) => s.getTagFilters(projectId));
  const statusFilter = useSearchStore((s) => s.getStatusFilter(projectId));

  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<
    string | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [remoteDeleteTarget, setRemoteDeleteTarget] =
    useState<RemoteDeleteTarget | null>(null);

  // Only attempt remote file fetching when the project has GitHub configured.
  const hasGithub = Boolean(project?.githubRepo && project?.contentPath);

  // --- Remote GitHub files via TanStack Query ---
  const {
    data: remoteData,
    isLoading: isLoadingRemote,
    isFetched: hasLoadedRemote,
    refetch: refetchRemoteFiles,
  } = useGithubContentList({
    repo: project?.githubRepo ?? null,
    branch: project?.githubBranch ?? "main",
    path: project?.contentPath ?? null,
  });
  const remoteFiles: RemoteFile[] = remoteData?.files ?? [];

  const { invalidateContent } = useGithubInvalidation();

  /** Refresh remote files — used after delete/import. */
  const fetchRemoteFiles = useCallback(async () => {
    await invalidateContent();
  }, [invalidateContent]);

  // --- Build unified content items ---

  const importedPaths = useMemo(() => {
    const s = new Set<string>();
    for (const d of documents ?? []) {
      if (d.githubPath) s.add(d.githubPath);
    }
    return s;
  }, [documents]);

  const contentItems = useMemo<ContentItem[]>(() => {
    const items: ContentItem[] = [];

    for (const doc of documents ?? []) {
      // `excerpt` + `wordCount` are derived server-side now (the list query no
      // longer ships full `content` — see convex/cms/documents.ts:list).
      const excerpt = doc.excerpt;
      const hasGithubPath = Boolean(doc.githubPath);
      const isSynced =
        hasGithubPath &&
        doc.githubSyncedAt != null &&
        doc.githubSyncedAt >= doc.updatedAt;
      const needsSync =
        hasGithubPath &&
        (doc.githubSyncedAt == null || doc.githubSyncedAt < doc.updatedAt);

      const item: ContentItem = {
        kind: "local",
        id: doc._id,
        title: doc.title,
        slug: doc.slug,
        path: doc.githubPath ?? "",
        status: doc.status,
        synced: isSynced,
        needsSync,
        excerpt,
        updatedAt: doc.updatedAt,
        tags: doc.tags ?? [],
        wordCount: doc.wordCount,
      };
      if (doc.boardPosition !== undefined) {
        item.boardPosition = doc.boardPosition;
      }
      items.push(item);
    }

    for (const file of remoteFiles) {
      if (!importedPaths.has(file.path)) {
        const title = file.name.replace(/\.mdx?$/, "").replace(/[-_]/g, " ");
        items.push({
          kind: "remote",
          title,
          slug: file.name.replace(/\.mdx?$/, ""),
          path: file.path,
          synced: false,
          excerpt: "",
          size: file.size,
          sha: file.sha,
        });
      }
    }

    return items;
  }, [documents, remoteFiles, importedPaths]);

  // --- Frontmatter map for tags/author ---
  const tagFieldName = useMemo(
    () => getTagFieldName(project?.frontmatterSchema),
    [project?.frontmatterSchema],
  );

  const frontmatterMap = useMemo(() => {
    const map = new Map<string, ParsedFrontmatter>();
    for (const doc of documents ?? []) {
      map.set(doc._id, parseFrontmatterJson(doc.frontmatter, tagFieldName));
    }
    return map;
  }, [documents, tagFieldName]);

  // --- All unique tags (for filter UI) ---
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of contentItems) {
      for (const tag of item.tags ?? []) {
        tagSet.add(tag);
      }
      if (item.id) {
        const fm = frontmatterMap.get(item.id);
        if (fm?.tags) {
          for (const tag of fm.tags) {
            tagSet.add(tag);
          }
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [contentItems, frontmatterMap]);

  // --- Search index (pre-computed for performance) ---
  const searchIndex = useMemo(
    () => buildSearchIndex(contentItems, frontmatterMap),
    [contentItems, frontmatterMap],
  );

  // --- Filter & search ---
  const filteredItems = useMemo(() => {
    // 1. Tab filter (view filter from tabs)
    let items = contentItems;
    if (viewFilter === "local") {
      items = items.filter((i) => i.kind === "local");
    } else if (viewFilter === "remote") {
      items = items.filter((i) => i.kind === "remote");
    } else if (viewFilter !== "all") {
      items = items.filter((i) => i.status === viewFilter);
    }

    // 2. Kind filter from search store
    if (kindFilter !== "all") {
      items = items.filter((i) => i.kind === kindFilter);
    }

    // 3. Status filter from search store
    if (statusFilter) {
      items = items.filter((i) => i.status === statusFilter);
    }

    // 4. Tag filters from search store (OR logic — match any selected tag)
    if (tagFilters.length > 0) {
      const tagSet = new Set(tagFilters);
      items = items.filter((i) => {
        const itemTags = i.tags ?? [];
        // Also check frontmatter tags
        const fm = i.id ? frontmatterMap.get(i.id) : undefined;
        const allTags = [...itemTags, ...(fm?.tags ?? [])];
        return allTags.some((t) => tagSet.has(t));
      });
    }

    // 5. Text search with relevance scoring
    const query = searchQuery.trim();
    if (query) {
      // Build a filtered search index matching current item set
      const itemIds = new Set(
        items.map((i) => (i.kind === "local" ? i.id : i.path)),
      );
      const filteredIndex = searchIndex.filter((si) =>
        itemIds.has(si.item.kind === "local" ? si.item.id : si.item.path),
      );
      const scored = searchItems(filteredIndex, query);

      // Sort by relevance when searching
      if (sortOrder === "relevance" || sortOrder === "newest") {
        scored.sort((a, b) => b.score - a.score);
      }

      const matched = scored.map((s) => s.item);

      // Documents whose BODY matches but whose excerpt/title/tags don't — the
      // client index cannot see these at all. Appended after the scored rows
      // (step 6 re-sorts them into the chosen order unless it's relevance) and
      // drawn from the already-filtered `items`, so tab/status/tag filters
      // still apply.
      if (bodyHitIds.size > 0) {
        const seen = new Set(
          matched.map((i) => (i.kind === "local" ? i.id : i.path)),
        );
        for (const item of items) {
          if (item.kind !== "local" || !item.id) continue;
          if (seen.has(item.id) || !bodyHitIds.has(item.id)) continue;
          matched.push(item);
        }
      }

      items = matched;
    }

    // 6. Sort (when not in relevance-search mode)
    if (!query || sortOrder !== "relevance") {
      items = [...items].sort((a, b) => {
        switch (sortOrder) {
          case "newest":
            return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
          case "oldest":
            return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
          case "a-z":
            return a.title.localeCompare(b.title);
          case "z-a":
            return b.title.localeCompare(a.title);
          default: {
            // Default: local first, then by date
            if (a.kind !== b.kind) return a.kind === "local" ? -1 : 1;
            if (a.kind === "local" && b.kind === "local") {
              return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
            }
            return a.title.localeCompare(b.title);
          }
        }
      });
    }

    return items;
  }, [
    contentItems,
    viewFilter,
    searchQuery,
    kindFilter,
    statusFilter,
    tagFilters,
    sortOrder,
    searchIndex,
    frontmatterMap,
    bodyHitIds,
  ]);

  // --- Auto-import + navigate for remote files ---
  const importFile = useAction(api.integrations.github.importFileFromGithub);
  const [importingPath, setImportingPath] = useState<string | null>(null);

  // Bulk import lifecycle — owns batchId, isStarting, reactive batch query.
  const {
    batch,
    isStarting: isStartingImport,
    start: startBulkImportFlow,
    done: handleBulkImportDone,
    lastResult: importLastResult,
  } = useBulkImport(projectId);

  const handleResolveConflicts = useCallback(
    (conflictId: Id<"sync_conflicts">) => {
      router.push(`/projects/${projectId}/conflicts/${conflictId}`);
    },
    [projectId, router],
  );

  /**
   * Wraps the Convex `importFileFromGithub` action with automatic retries on
   * the rate-limit response. Convex throws a `ConvexError` whose `.data`
   * carries `{ kind: "RateLimited", retryAfter: <ms> }`; we sleep for that
   * window and try again (up to 3 attempts). Anything else bubbles up.
   *
   * This makes large bulk imports just slow down under throttle instead of
   * silently failing partway through.
   */
  const importWithRetry = useCallback(
    async (
      args: { projectId: Id<"projects">; filePath: string },
      maxRetries = 3,
    ) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await importFile(args);
        } catch (err) {
          const data = (
            err as { data?: { kind?: string; retryAfter?: number } }
          )?.data;
          if (
            data?.kind === "RateLimited" &&
            typeof data.retryAfter === "number" &&
            attempt < maxRetries
          ) {
            await new Promise((resolve) =>
              setTimeout(resolve, (data.retryAfter ?? 0) + 50),
            );
            continue;
          }
          throw err;
        }
      }
      throw new Error("Import failed after max retries");
    },
    [importFile],
  );

  // --- Bulk publish ---
  const bulkPublishAction = useAction(api.integrations.github.bulkPublish);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [bulkPublishProgress, setBulkPublishProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const handleOpenItem = useCallback(
    async (item: ContentItem) => {
      if (item.kind === "local" && item.id) {
        router.push(`/editor/${item.id}`);
        return;
      }

      setImportingPath(item.path);
      try {
        const result = (await importWithRetry({
          projectId,
          filePath: item.path,
        })) as {
          documentId: string;
          title: string;
        };
        toast.success(`Opened "${result.title}"`);
        router.push(`/editor/${result.documentId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open file");
        setImportingPath(null);
      }
    },
    [projectId, importWithRetry, router],
  );

  // Bulk import handler — thin pass-through to the hook. Returns the
  // hook's result so callers (like the Sync button) can await the
  // classification before showing UI.
  const handleBatchImport = useCallback(
    (paths: string[]) => startBulkImportFlow(paths),
    [startBulkImportFlow],
  );

  /**
   * Smart Sync — refresh the GitHub file list, then diff-import any
   * changed files. Skips unchanged files entirely (no workpool jobs)
   * and surfaces conflicts via the bulk-import dialog. This replaces
   * the old "just invalidate the TanStack cache" behavior of the Sync
   * button so a click means "bring Convex into agreement with GitHub"
   * instead of "show me the file picker again."
   */
  const handleSyncFromGithub = useCallback(async () => {
    const refetched = await refetchRemoteFiles();
    const files = refetched.data?.files ?? remoteFiles;
    const allPaths = files.map((f) => f.path);
    if (allPaths.length === 0) {
      toast.info("No files in the configured content path.");
      return;
    }
    await startBulkImportFlow(allPaths);
  }, [refetchRemoteFiles, remoteFiles, startBulkImportFlow]);

  // --- Bulk publish handler ---
  const handleBulkPublish = useCallback(
    async (docIds: string[]) => {
      if (!hasGithub) {
        toast.error("GitHub not configured for this project");
        return;
      }
      setIsBulkPublishing(true);
      setBulkPublishProgress({ done: 0, total: docIds.length });

      try {
        const result = (await bulkPublishAction({
          projectId,
          documentIds: docIds as Id<"documents">[],
        })) as {
          success: number;
          failed: number;
          commitUrl?: string;
        };

        setBulkPublishProgress({ done: result.success, total: docIds.length });

        if (result.success > 0 && result.failed === 0) {
          toast.success(
            `Published ${result.success} ${result.success === 1 ? "article" : "articles"} in a single commit`,
            {
              description: result.commitUrl ? "View on GitHub" : undefined,
              action: result.commitUrl
                ? {
                    label: "Open commit",
                    onClick: () => window.open(result.commitUrl, "_blank"),
                  }
                : undefined,
            },
          );
        } else if (result.success > 0 && result.failed > 0) {
          toast.warning(`Published ${result.success}, ${result.failed} failed`);
        } else {
          toast.error("Failed to publish articles");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk publish failed");
      } finally {
        setIsBulkPublishing(false);
        setBulkPublishProgress(null);
      }
    },
    [projectId, hasGithub, bulkPublishAction],
  );

  // --- Bulk delete ---
  // Same shape as bulk import: dialog owns progress UI; parent threads
  // the reactive batch state through. Hook also re-runs the remote file
  // refresh in `done` because a github/both delete makes that list stale.
  const {
    batch: deleteBatch,
    isStarting: isStartingDelete,
    start: handleBulkDelete,
    done: handleBulkDeleteDone,
  } = useBulkDelete({
    projectId,
    documents,
    remoteFiles,
    onDone: fetchRemoteFiles,
  });

  // --- Delete handlers ---
  const handleDeleteLocal = useCallback(
    (item: ContentItem) => {
      const doc = (documents ?? []).find((d) => d._id === item.id);
      const target: DeleteTarget = {
        documentId: item.id as Id<"documents">,
        title: item.title,
      };
      if (doc?.githubPath) target.githubPath = doc.githubPath;
      if (doc?.githubSha) target.githubSha = doc.githubSha;
      setDeleteTarget(target);
    },
    [documents],
  );

  const handleDeleteRemote = useCallback((item: ContentItem) => {
    if (!item.sha) {
      return;
    }
    setRemoteDeleteTarget({
      path: item.path,
      sha: item.sha,
      title: item.title,
    });
  }, []);

  if (project === undefined || documents === undefined || projectDeleted) {
    return <ProjectDetailSkeleton />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            /{project.slug}
            {hasGithub && (
              <span className="ml-2 inline-flex items-center gap-1 text-blue-500">
                <Cloud className="size-3" />
                {project.githubRepo}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/trash`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <Trash2 className="size-4" />
            Trash
          </Link>
          <Link
            href={`/projects/${projectId}/settings`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          {project?.importEnabled && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="size-4" />
              Import
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            New Document
          </Button>
        </div>
      </motion.div>

      {/* Pending sync conflicts banner */}
      <SyncConflictsBanner projectId={projectId} />

      {/* Content Dashboard */}
      <ContentDashboard
        items={filteredItems}
        allItems={contentItems}
        columns={columns}
        allTags={allTags}
        viewFilter={viewFilter}
        onViewFilterChange={setViewFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasGithub={hasGithub}
        isSearchingBodies={Boolean(bodySearchTerm) && bodyHits === undefined}
        isLoadingRemote={isLoadingRemote}
        hasLoadedRemote={hasLoadedRemote}
        onRefreshRemote={() => void handleSyncFromGithub()}
        onOpenItem={(item) => void handleOpenItem(item)}
        onDeleteLocal={handleDeleteLocal}
        onDeleteRemote={handleDeleteRemote}
        importingPath={importingPath}
        onCreateClick={(initialStatus) => {
          setCreateInitialStatus(initialStatus);
          setCreateDialogOpen(true);
        }}
        onBatchImport={handleBatchImport}
        isStartingImport={isStartingImport}
        importBatch={batch}
        importLastResult={importLastResult}
        onBulkImportDone={handleBulkImportDone}
        onResolveConflicts={handleResolveConflicts}
        onBulkPublish={hasGithub ? handleBulkPublish : undefined}
        isBulkPublishing={isBulkPublishing}
        bulkPublishProgress={bulkPublishProgress}
        onBulkDelete={handleBulkDelete}
        isStartingDelete={isStartingDelete}
        deleteBatch={deleteBatch}
        onBulkDeleteDone={handleBulkDeleteDone}
        projectId={projectId}
        frontmatterMap={frontmatterMap}
      />

      {/* Dialogs */}
      <CreateDocumentDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setCreateInitialStatus(undefined);
        }}
        initialStatus={createInitialStatus}
      />

      <FileImportSheet
        projectId={projectId}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      {deleteTarget && (
        <DeleteDocumentDialog
          target={deleteTarget}
          projectId={projectId}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}

      <BoardSettingsDialog projectId={projectId} columns={columns} />

      <BoardScheduleDialog />

      {remoteDeleteTarget && (
        <DeleteRemoteFileDialog
          target={remoteDeleteTarget}
          projectId={projectId}
          open={remoteDeleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRemoteDeleteTarget(null);
          }}
          onDeleted={fetchRemoteFiles}
        />
      )}
    </div>
  );
}

/**
 * Renders the ScheduleDialog when a card is dropped on a "schedule" column.
 * If the user dismisses without scheduling, the card is reverted to its
 * previous column. We detect this by checking whether the document's status
 * changed to "scheduled" — if so, the schedule succeeded and no revert is needed.
 */
function BoardScheduleDialog() {
  const pendingDocId = useBoardStore((s) => s.pendingScheduleDocId);
  const pendingPrevStatus = useBoardStore((s) => s.pendingSchedulePrevStatus);
  const clearPendingSchedule = useBoardStore((s) => s.clearPendingSchedule);
  const moveCard = useMutation(api.cms.documents.moveCard);

  // Query the document to check its status on close
  const document = useQuery(
    api.cms.documents.get,
    pendingDocId ? { documentId: pendingDocId as Id<"documents"> } : "skip",
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && pendingDocId && pendingPrevStatus) {
        // Only revert if the document was NOT successfully scheduled
        const wasScheduled = document?.status === "scheduled";
        if (!wasScheduled) {
          void moveCard({
            documentId: pendingDocId as Id<"documents">,
            targetStatus: pendingPrevStatus,
            boardPosition: 0,
          });
        }
      }
      if (!open) clearPendingSchedule();
    },
    [
      pendingDocId,
      pendingPrevStatus,
      clearPendingSchedule,
      moveCard,
      document?.status,
    ],
  );

  if (!pendingDocId) return null;

  return (
    <ScheduleDialog
      open={true}
      onOpenChange={handleOpenChange}
      documentId={pendingDocId}
    />
  );
}

// --- Skeleton ---

function ProjectDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <Skeleton className="mb-4 h-10 w-full" />
      <Skeleton className="mb-4 h-8 w-64" />
      <div className="overflow-hidden rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
