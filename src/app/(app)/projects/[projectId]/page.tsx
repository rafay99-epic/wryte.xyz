"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  Cloud,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { CreateDocumentDialog } from "@/components/projects/create-document-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

/** The active tab filter controlling which content rows are visible. */
type ViewFilter =
  | "all"
  | "local"
  | "remote"
  | "draft"
  | "published"
  | "scheduled";

/** A file entry returned from the GitHub Contents API. */
interface RemoteFile {
  name: string;
  path: string;
  sha: string;
  size: number;
}

/**
 * Unified content row used in the project content table.
 *
 * Merges two sources into one list:
 *  - **local** — documents stored in Convex (created or imported).
 *  - **remote** — markdown files found on GitHub that have not been imported yet.
 *
 * This lets the user see *all* content in one view and import remote files on click.
 */
interface ContentItem {
  kind: "local" | "remote";
  /** Convex document ID — only present for local items. */
  id?: string;
  title: string;
  slug: string;
  /** GitHub path relative to repo root (empty string if never synced). */
  path: string;
  status?: "draft" | "scheduled" | "published";
  /** True when the local document originated from a GitHub import. */
  synced: boolean;
  excerpt: string;
  updatedAt?: number;
  /** File size in bytes — only present for remote items. */
  size?: number;
}

// Dynamic import reference — cast needed because the GitHub action is generated at build time.
// biome-ignore lint/suspicious/noExplicitAny: Convex api types are generated at build time
const importAction = (api as any).github.importFileFromGithub;

/**
 * Project detail page — shows a unified content table combining local Convex
 * documents and remote GitHub files, with search, filtering, and auto-import.
 *
 * Key flows:
 *  - On mount, local documents are fetched via `documents.list` and (if the
 *    project has a linked GitHub repo) remote markdown files are fetched from
 *    the GitHub Contents API.
 *  - Clicking a local document navigates to the editor.
 *  - Clicking a remote-only file triggers an auto-import action that pulls the
 *    file content into Convex as a new document, then navigates to it.
 */
export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();

  const project = useQuery(api.projects.get, { projectId });
  const documents = useQuery(api.documents.list, { projectId });

  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Id<"documents"> | null>(
    null,
  );

  // --- Remote GitHub files ---
  // These are fetched client-side from our `/api/github/content` route, which
  // proxies the GitHub Contents API. They supplement the Convex document list.
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);

  // Only attempt remote file fetching when the project has GitHub configured.
  const hasGithub = Boolean(project?.githubRepo && project?.contentPath);

  /** Fetch the list of markdown files from the GitHub content directory. */
  const fetchRemoteFiles = useCallback(async () => {
    if (!project?.githubRepo || !project?.contentPath) return;
    setIsLoadingRemote(true);
    try {
      const params = new URLSearchParams({
        repo: project.githubRepo,
        branch: project.githubBranch ?? "main",
        path: project.contentPath,
      });
      const res = await fetch(`/api/github/content?${params.toString()}`);
      const data = (await res.json()) as { files: RemoteFile[] };
      if (res.ok) {
        setRemoteFiles(data.files);
      }
    } catch {
      // Silently fail — remote files are supplementary and non-blocking.
    } finally {
      setIsLoadingRemote(false);
      setHasLoadedRemote(true);
    }
  }, [project?.githubRepo, project?.githubBranch, project?.contentPath]);

  // Auto-fetch remote files once the project data is available.
  useEffect(() => {
    if (hasGithub) {
      void fetchRemoteFiles();
    }
  }, [hasGithub, fetchRemoteFiles]);

  // --- Build unified content items ---

  // Track which GitHub paths already have a corresponding local document so
  // we can exclude them from the "remote-only" list and avoid duplicates.
  const importedPaths = useMemo(() => {
    const s = new Set<string>();
    for (const d of documents ?? []) {
      if (d.githubPath) s.add(d.githubPath);
    }
    return s;
  }, [documents]);

  // Merge local documents and remote-only files into a single ContentItem[].
  const contentItems = useMemo<ContentItem[]>(() => {
    const items: ContentItem[] = [];

    // Local Convex documents — always shown regardless of GitHub state.
    for (const doc of documents ?? []) {
      const excerpt =
        doc.content.length > 120
          ? `${doc.content.slice(0, 120)}...`
          : doc.content;
      items.push({
        kind: "local",
        id: doc._id,
        title: doc.title,
        slug: doc.slug,
        path: doc.githubPath ?? "",
        status: doc.status,
        synced: Boolean(doc.githubPath),
        excerpt,
        updatedAt: doc.updatedAt,
      });
    }

    // Remote-only files — GitHub files not yet imported into Convex.
    // The title is derived from the filename by stripping the extension and
    // replacing dashes/underscores with spaces.
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
        });
      }
    }

    return items;
  }, [documents, remoteFiles, importedPaths]);

  // Filter & search
  const filteredItems = useMemo(() => {
    let items = contentItems;

    // Filter by view
    switch (viewFilter) {
      case "local":
        items = items.filter((i) => i.kind === "local");
        break;
      case "remote":
        items = items.filter((i) => i.kind === "remote");
        break;
      case "draft":
        items = items.filter((i) => i.status === "draft");
        break;
      case "published":
        items = items.filter(
          (i) => i.status === "published" || i.kind === "remote",
        );
        break;
      case "scheduled":
        items = items.filter((i) => i.status === "scheduled");
        break;
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q),
      );
    }

    // Sort: local items by updatedAt desc, remote items alphabetically, local first
    items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "local" ? -1 : 1;
      if (a.kind === "local" && b.kind === "local") {
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      }
      return a.title.localeCompare(b.title);
    });

    return items;
  }, [contentItems, viewFilter, searchQuery]);

  const localCount = contentItems.filter((i) => i.kind === "local").length;
  const remoteCount = contentItems.filter((i) => i.kind === "remote").length;

  // Auto-import + navigate for remote files
  const importFile = useAction(importAction);
  const [importingPath, setImportingPath] = useState<string | null>(null);

  const handleOpenItem = useCallback(
    async (item: ContentItem) => {
      if (item.kind === "local" && item.id) {
        router.push(`/editor/${item.id}`);
        return;
      }

      // Remote file — auto-import then navigate
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

  if (project === undefined || documents === undefined) {
    return <ProjectDetailSkeleton />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
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
      </div>

      {/* Search + Refresh */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, slug, or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasGithub && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRemoteFiles}
            disabled={isLoadingRemote}
          >
            <RefreshCw
              className={cn("size-3.5", isLoadingRemote && "animate-spin")}
            />
            Sync
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={viewFilter}
        onValueChange={(v) => setViewFilter(v as ViewFilter)}
      >
        <TabsList variant="line">
          <TabsTrigger value="all">
            All
            <span className="ml-1 text-xs text-muted-foreground">
              {contentItems.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          {hasGithub && (
            <>
              <TabsTrigger value="local">
                Local
                <span className="ml-1 text-xs text-muted-foreground">
                  {localCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="remote">
                Remote
                <span className="ml-1 text-xs text-muted-foreground">
                  {remoteCount}
                </span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Single content area for all tabs */}
        <div className="mt-4">
          {/* Loading state for remote files */}
          {isLoadingRemote && !hasLoadedRemote && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Fetching remote files from GitHub...
            </div>
          )}

          {filteredItems.length === 0 ? (
            <EmptyState
              viewFilter={viewFilter}
              searchQuery={searchQuery}
              onCreateClick={() => setCreateDialogOpen(true)}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                      Status
                    </th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                      Updated
                    </th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <ContentRow
                      key={item.kind === "local" ? item.id : item.path}
                      item={item}
                      isImporting={importingPath === item.path}
                      onOpen={() => void handleOpenItem(item)}
                      onDelete={
                        item.kind === "local" && item.id
                          ? () => setDeleteTarget(item.id as Id<"documents">)
                          : undefined
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Tabs>

      <CreateDocumentDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {deleteTarget && (
        <DeleteDocumentDialog
          documentId={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

// --- Content Table Row ---

function ContentRow({
  item,
  isImporting,
  onOpen,
  onDelete,
}: {
  item: ContentItem;
  isImporting: boolean;
  onOpen: () => void;
  onDelete?: (() => void) | undefined;
}) {
  return (
    <tr
      className="group cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/30"
      onClick={onOpen}
    >
      {/* Title + meta */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {item.kind === "remote" ? (
            <Cloud className="size-3.5 shrink-0 text-blue-500" />
          ) : item.synced ? (
            <span className="relative flex size-3.5 shrink-0">
              <FileText className="size-3.5 text-foreground" />
              <Cloud className="absolute -right-1 -bottom-0.5 size-2 text-blue-500" />
            </span>
          ) : (
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{item.title}</span>
              {isImporting && (
                <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {item.kind === "remote" ? item.path : `/${item.slug}`}
              {item.size !== undefined && (
                <span className="ml-2 text-muted-foreground/50">
                  {(item.size / 1024).toFixed(1)} KB
                </span>
              )}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="hidden px-4 py-3 sm:table-cell">
        {item.kind === "local" && item.status ? (
          <DocumentStatusBadge status={item.status} />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Cloud className="size-2.5" />
            Remote
          </span>
        )}
      </td>

      {/* Updated */}
      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
        {item.updatedAt
          ? new Date(item.updatedAt).toLocaleDateString()
          : item.kind === "remote"
            ? "On GitHub"
            : "—"}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

// --- Empty State ---

function EmptyState({
  viewFilter,
  searchQuery,
  onCreateClick,
}: {
  viewFilter: ViewFilter;
  searchQuery: string;
  onCreateClick: () => void;
}) {
  if (searchQuery.trim()) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <Search className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No results for &ldquo;{searchQuery}&rdquo;
        </p>
      </div>
    );
  }

  const messages: Record<ViewFilter, string> = {
    all: "No documents yet. Create your first one to get started.",
    local: "No local documents. Import from GitHub or create a new one.",
    remote: "No remote files found in the content directory.",
    draft: "No drafts.",
    published: "No published documents.",
    scheduled: "No scheduled documents.",
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
      <FileText className="mb-3 size-10 text-muted-foreground/50" />
      <p className="mb-4 text-sm text-muted-foreground">
        {messages[viewFilter]}
      </p>
      {(viewFilter === "all" || viewFilter === "local") && (
        <Button size="sm" onClick={onCreateClick}>
          <Plus className="size-4" />
          New Document
        </Button>
      )}
    </div>
  );
}

// --- Delete Dialog ---

function DeleteDocumentDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: Id<"documents">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const removeDocument = useMutation(api.documents.remove);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await removeDocument({ documentId });
      toast.success("Document deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  }, [documentId, removeDocument, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this document? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
