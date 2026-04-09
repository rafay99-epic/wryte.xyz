"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Cloud, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScheduleDialog } from "@/components/editor/schedule-dialog";
import { BoardSettingsDialog } from "@/components/projects/content-dashboard/board-settings-dialog";
import { ContentDashboard } from "@/components/projects/content-dashboard/content-dashboard";
import type { ViewFilter } from "@/components/projects/content-dashboard/content-empty-state";
import type { ContentItem } from "@/components/projects/content-dashboard/content-table-row";
import {
  DeleteDocumentDialog,
  type DeleteTarget,
} from "@/components/projects/content-dashboard/delete-document-dialog";
import {
  DeleteRemoteFileDialog,
  type RemoteDeleteTarget,
} from "@/components/projects/content-dashboard/delete-remote-file-dialog";
import { CreateDocumentDialog } from "@/components/projects/create-document-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ContentFile,
  useGithubContentList,
  useGithubInvalidation,
} from "@/hooks/use-github";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import {
  getTagFieldName,
  type ParsedFrontmatter,
  parseFrontmatterJson,
} from "@/lib/parse-frontmatter";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useEditorStore } from "@/stores/editor-store";
import { type BoardColumnDef, DEFAULT_BOARD_COLUMNS } from "@/types/board";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

/** A file entry returned from the GitHub Contents API. */
type RemoteFile = ContentFile;

// Dynamic import reference — cast needed because the GitHub action is generated at build time.
// biome-ignore lint/suspicious/noExplicitAny: Convex api types are generated at build time
const importAction = (api as any).github.importFileFromGithub;

/**
 * Project detail page — thin orchestrator that fetches data, manages state,
 * and delegates rendering to `<ContentDashboard>` + dialog components.
 */
export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();

  const project = useQuery(api.projects.get, { projectId });
  const documents = useQuery(api.documents.list, { projectId });
  const boardColumns = useQuery(api.boardColumns.getColumns, { projectId }) as
    | BoardColumnDef[]
    | undefined;
  const columns = boardColumns ?? DEFAULT_BOARD_COLUMNS;
  const projectDeleted = project === null;

  // Redirect to projects list if the project was deleted
  useEffect(() => {
    if (projectDeleted) {
      router.push("/projects");
    }
  }, [projectDeleted, router]);

  // Set active project in sidebar on mount; reset board store on unmount
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
    return () => {
      useBoardStore.getState().reset();
    };
  }, [projectId]);

  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
      const excerpt =
        doc.content.length > 120
          ? `${doc.content.slice(0, 120)}...`
          : doc.content;
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

  // --- Filter & search ---
  const filteredItems = useMemo(() => {
    let items = contentItems;

    // Special filters
    if (viewFilter === "local") {
      items = items.filter((i) => i.kind === "local");
    } else if (viewFilter === "remote") {
      items = items.filter((i) => i.kind === "remote");
    } else if (viewFilter !== "all") {
      // Dynamic column filter — match by column ID (status)
      items = items.filter((i) => i.status === viewFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "local" ? -1 : 1;
      if (a.kind === "local" && b.kind === "local") {
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      }
      return a.title.localeCompare(b.title);
    });

    return items;
  }, [contentItems, viewFilter, searchQuery]);

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

  // --- Auto-import + navigate for remote files ---
  const importFile = useAction(importAction);
  const [importingPath, setImportingPath] = useState<string | null>(null);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<{
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
        let githubAccessToken: string | undefined;
        try {
          const res = await fetch("/api/github/token");
          if (res.ok) {
            const data = (await res.json()) as { token?: string };
            if (data.token) githubAccessToken = data.token;
          }
        } catch {
          // Fall back to stored PAT
        }

        const args: {
          projectId: Id<"projects">;
          filePath: string;
          githubAccessToken?: string;
        } = { projectId, filePath: item.path };
        if (githubAccessToken) args.githubAccessToken = githubAccessToken;

        const result = (await importFile(args)) as {
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
    [projectId, importFile, router],
  );

  // --- Batch import for multi-select ---
  const handleBatchImport = useCallback(
    async (paths: string[]) => {
      setIsBatchImporting(true);
      setBatchImportProgress({ done: 0, total: paths.length });

      let githubAccessToken: string | undefined;
      try {
        const res = await fetch("/api/github/token");
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          if (data.token) githubAccessToken = data.token;
        }
      } catch {
        // Fall back to stored PAT
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < paths.length; i++) {
        const filePath = paths[i] as string;
        try {
          const args: {
            projectId: Id<"projects">;
            filePath: string;
            githubAccessToken?: string;
          } = { projectId, filePath };
          if (githubAccessToken) args.githubAccessToken = githubAccessToken;

          await importFile(args);
          successCount++;
        } catch {
          failCount++;
        }
        setBatchImportProgress({ done: i + 1, total: paths.length });
      }

      setIsBatchImporting(false);
      setBatchImportProgress(null);

      if (successCount > 0 && failCount === 0) {
        toast.success(
          `Imported ${successCount} ${successCount === 1 ? "file" : "files"} successfully`,
        );
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(
          `Imported ${successCount} ${successCount === 1 ? "file" : "files"}, ${failCount} failed`,
        );
      } else {
        toast.error("Failed to import files");
      }
    },
    [projectId, importFile],
  );

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
            href={`/projects/${projectId}/settings`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            New Document
          </Button>
        </div>
      </motion.div>

      {/* Content Dashboard */}
      <ContentDashboard
        items={filteredItems}
        allItems={contentItems}
        columns={columns}
        viewFilter={viewFilter}
        onViewFilterChange={setViewFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasGithub={hasGithub}
        isLoadingRemote={isLoadingRemote}
        hasLoadedRemote={hasLoadedRemote}
        onRefreshRemote={() => void refetchRemoteFiles()}
        onOpenItem={(item) => void handleOpenItem(item)}
        onDeleteLocal={handleDeleteLocal}
        onDeleteRemote={handleDeleteRemote}
        importingPath={importingPath}
        onCreateClick={(initialStatus) => {
          setCreateInitialStatus(initialStatus);
          setCreateDialogOpen(true);
        }}
        onBatchImport={handleBatchImport}
        isBatchImporting={isBatchImporting}
        batchImportProgress={batchImportProgress}
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
  const moveCard = useMutation(api.documents.moveCard);

  // Query the document to check its status on close
  const document = useQuery(
    api.documents.get,
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
