"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type MediaFilter,
  type MediaLibraryItem,
  useProjectMediaLibrary,
} from "@wryte/logic/hooks/use-project-media-library";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import {
  describeMediaLocation,
  MEDIA_PROVIDER_LABELS,
  type MediaProvider,
} from "@wryte/logic/types/media";
import { Button, buttonVariants } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { Input } from "@wryte/ui/input";
import { MediaProviderIcon } from "@wryte/ui/media-provider-icon";
import { MediaProviderTabs } from "@wryte/ui/media-provider-tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@wryte/ui/sheet";
import { Skeleton } from "@wryte/ui/skeleton";
import { useAction, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  ExternalLink,
  ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BatchImageUpload,
  type InitialImageBatch,
} from "@/components/media/batch-image-upload";
import { MediaImage } from "@/features/media-library/components/media-image";
import { usePendingDeletes } from "@/features/media-library/hooks/use-pending-deletes";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveProvider = MediaProvider;

type UnifiedMediaItem = MediaLibraryItem;

function hasFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes("Files");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function MediaLibraryPage({
  projectId: rawProjectId,
}: {
  projectId: string;
}) {
  const projectId = rawProjectId as Id<"projects">;
  const project = useQuery(api.cms.projects.get, { projectId });

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [initialUploadBatch, setInitialUploadBatch] =
    useState<InitialImageBatch | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const uploadBatchIdRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedMediaItem | null>(
    null,
  );
  // Pessimistic delete state — exit animation runs on click rather than
  // after the network round-trip. See `usePendingDeletes` for the rules.
  const {
    pendingDeletes,
    markPendingDelete,
    restorePendingDelete,
    pruneAgainst,
  } = usePendingDeletes();

  const {
    filter,
    setFilter,
    providerTabs,
    configuredTabs,
    items,
    errors,
    isLoading,
    isLoadingMore,
    hasMore: providerHasMore,
    loadMore,
    refresh,
  } = useProjectMediaLibrary({
    projectId,
    project,
    enabled: project !== undefined && project !== null,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!providerHasMore || isLoading || isLoadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [providerHasMore, isLoading, isLoadingMore, loadMore]);

  const filteredItems = useMemo(() => {
    const base = pendingDeletes.size
      ? items.filter((it) => !pendingDeletes.has(it.externalId))
      : items;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, pendingDeletes, searchQuery]);

  // Whenever the source `items` change (e.g. after refresh), any pending
  // deletes that the server has confirmed away can be dropped.
  useEffect(() => {
    if (pendingDeletes.size === 0) return;
    pruneAgainst(new Set(items.map((i) => i.externalId)));
  }, [items, pendingDeletes.size, pruneAgainst]);

  // Auto-load more when a search has zero matches but there are more pages
  // to fetch. Cap at 5 extra fetches per search to avoid excessive API calls.
  const autoFetchCountRef = useRef(0);
  const lastSearchRef = useRef("");

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    if (q !== lastSearchRef.current) {
      autoFetchCountRef.current = 0;
      lastSearchRef.current = q;
    }
    if (!providerHasMore) return;
    if (isLoading || isLoadingMore) return;
    if (autoFetchCountRef.current >= 5) return;
    const hasMatch = items.some((it) =>
      it.name.toLowerCase().includes(q.toLowerCase()),
    );
    if (!hasMatch) {
      autoFetchCountRef.current++;
      loadMore();
    }
  }, [searchQuery, providerHasMore, isLoading, isLoadingMore, items, loadMore]);

  // Searching is scoped to the visible tab, so the query belongs to that tab
  // too: carrying it across a switch silently hides files in the new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clears the query when the tab changes.
  useEffect(() => {
    setSearchQuery("");
  }, [filter]);

  const handleUploaded = useCallback(() => {
    void refresh();
  }, [refresh]);

  const openUploadSheet = useCallback(() => {
    setInitialUploadBatch(null);
    setUploadSheetOpen(true);
  }, []);

  const handlePageDrop = useCallback((event: React.DragEvent) => {
    if (!hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    uploadBatchIdRef.current += 1;
    setInitialUploadBatch({
      id: uploadBatchIdRef.current,
      files: Array.from(event.dataTransfer.files),
    });
    setUploadSheetOpen(true);
  }, []);

  /* ---------- Render guards ---------- */
  if (project === undefined) {
    return (
      <div className="p-4 sm:p-6">
        <Skeleton className="mb-6 h-7 w-24" />
        <Skeleton className="mb-2 h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (project === null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Project not found.
      </div>
    );
  }

  const scopeLabel =
    filter === "all" ? "all providers" : PROVIDER_LABEL[filter];
  const location =
    filter === "all" ? null : describeMediaLocation(filter, project.mediaPath);

  // Nothing connected at all, or the one provider being viewed was never set
  // up. The server reports this directly, so it isn't inferred from "empty
  // list plus an error".
  const needsConfig =
    configuredTabs.length === 0 ||
    (filter !== "all" &&
      providerTabs.find((tab) => tab.provider === filter)?.configured ===
        false);

  return (
    <div
      className="relative p-4 sm:p-6"
      onDragEnter={(event) => {
        if (!hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDraggingFiles(true);
      }}
      onDragOver={(event) => {
        if (hasFiles(event.dataTransfer)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event.dataTransfer)) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDraggingFiles(false);
      }}
      onDrop={handlePageDrop}
    >
      {isDraggingFiles && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center border-2 border-dashed border-primary bg-background/95">
          <div className="text-center">
            <Upload className="mx-auto mb-3 size-8 text-primary" />
            <p className="font-medium">Drop up to 10 images to upload</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You can review the batch before it starts.
            </p>
          </div>
        </div>
      )}
      {/* Navigation lives in the sidebar's single Back button — no
          per-page back links. */}
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Media
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
            <ScopeBadge filter={filter} />
            <span>·</span>
            <span>
              {items.length} file{items.length === 1 ? "" : "s"}
            </span>
            {location ? (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="hidden truncate font-mono text-xs sm:inline">
                  {location}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <RefreshCw
              className={cn("size-3.5", isLoading && "animate-spin")}
            />
            {/* The icon carries it on narrow screens; the label would push the
                Upload button off the row. */}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={openUploadSheet}>
            <Upload className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {/*
        Tabs filter what's already loaded — "All" merges every connected
        provider. Hidden when only one is connected.
      */}
      <MediaProviderTabs
        tabs={configuredTabs}
        selected={filter}
        onSelect={setFilter}
        className="mb-4"
      />

      {/* Search */}
      {items.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              filter === "all"
                ? "Search all providers…"
                : `Search ${PROVIDER_LABEL[filter]}…`
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && items.length === 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Loading from {scopeLabel}…
        </div>
      )}

      {/* Error state for provider listing (e.g. missing credentials) */}
      {errors.length > 0 && (
        <div className="mb-4 space-y-2">
          {errors.map((failure) => (
            <div
              key={failure.provider}
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p className="font-medium">Couldn't load from {failure.label}.</p>
              <p className="mt-1 text-xs">{failure.message}</p>
              <Link
                href={`/projects/${projectId}/settings`}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "mt-2",
                )}
              >
                Fix in settings
              </Link>
            </div>
          ))}
          {errors.length < configuredTabs.length && (
            <p className="text-xs text-muted-foreground">
              Other providers loaded normally — their files are below.
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredItems.map((item) => (
              <MediaCard
                key={`${item.provider}:${item.externalId}`}
                item={item}
                showProvider={filter === "all"}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : !isLoading && items.length === 0 ? (
        <EmptyState
          scopeLabel={scopeLabel}
          needsConfig={needsConfig}
          onUpload={openUploadSheet}
          location={location}
          projectId={projectId}
        />
      ) : searchQuery.trim() && filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <Search className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {providerHasMore || isLoadingMore
              ? `Searching… loaded ${items.length} so far`
              : `No results for "${searchQuery}" in ${scopeLabel}`}
          </p>
          {(providerHasMore || isLoadingMore) && (
            <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      ) : null}

      {/* Infinite-scroll sentinel + loading indicator */}
      {(providerHasMore || isLoadingMore) && (
        <div
          ref={sentinelRef}
          className="mt-6 flex items-center justify-center"
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading more…
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load more
            </Button>
          )}
        </div>
      )}

      {/* End-of-list marker */}
      {!providerHasMore && !isLoadingMore && items.length > 0 && (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {items.length} file{items.length === 1 ? "" : "s"} loaded · end of
          list
        </p>
      )}

      <UploadMediaSheet
        projectId={projectId}
        providers={configuredTabs.map((tab) => tab.provider)}
        initialFiles={initialUploadBatch}
        open={uploadSheetOpen}
        onOpenChange={(nextOpen) => {
          setUploadSheetOpen(nextOpen);
          if (!nextOpen) setInitialUploadBatch(null);
        }}
        onUploaded={handleUploaded}
      />

      <DeleteMediaDialog
        item={deleteTarget}
        projectId={projectId}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onOptimisticDelete={markPendingDelete}
        onRestore={restorePendingDelete}
        onDeleted={handleUploaded}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider helpers                                                   */
/* ------------------------------------------------------------------ */

const PROVIDER_LABEL = MEDIA_PROVIDER_LABELS;

/** What the grid is currently showing: one provider, or the merged view. */
function ScopeBadge({ filter }: { filter: MediaFilter }) {
  if (filter === "all") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Layers className="size-3" />
        All providers
      </span>
    );
  }
  return <ProviderChip provider={filter} />;
}

/**
 * Corner marker on a card in the merged view: which bucket this file is in.
 *
 * Icon only. A full "CLOUDFLARE R2" label reads as a headline over a thumbnail
 * grid — the source is a hint you glance at, not something to announce, so the
 * name lives in the tooltip and the accessible label instead.
 */
function ProviderMark({ provider }: { provider: ActiveProvider }) {
  const label = PROVIDER_LABEL[provider];
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className="absolute left-1.5 top-1.5 rounded-md bg-background/75 p-1 text-muted-foreground backdrop-blur-sm"
    >
      <MediaProviderIcon provider={provider} className="size-3" />
    </span>
  );
}

/** Provider marker with its name — for the header, where there's room. */
function ProviderChip({ provider }: { provider: ActiveProvider }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <MediaProviderIcon provider={provider} className="size-3" />
      {PROVIDER_LABEL[provider]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({
  scopeLabel,
  needsConfig,
  onUpload,
  location,
  projectId,
}: {
  scopeLabel: string;
  needsConfig: boolean;
  onUpload: () => void;
  location: string | null;
  projectId: Id<"projects">;
}) {
  if (needsConfig) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
        <UploadCloud className="mb-4 size-12 text-muted-foreground/30" />
        <h2 className="mb-2 text-lg font-semibold">No storage connected</h2>
        <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
          Connect a provider — GitHub, UploadThing, Cloudinary or Cloudflare R2
          — and your uploads will show up here.
        </p>
        <Link
          href={`/projects/${projectId}/settings`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Open Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
      <ImageIcon className="mb-4 size-12 text-muted-foreground/30" />
      <h2 className="mb-2 text-lg font-semibold">Nothing here yet</h2>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        {location
          ? `No media in ${location} yet.`
          : `No media in ${scopeLabel} yet.`}{" "}
        Upload an image to get started.
      </p>
      <Button size="sm" onClick={onUpload}>
        <Upload className="size-4" />
        Upload Media
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media Card                                                         */
/* ------------------------------------------------------------------ */

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(?:$|[?#])/i;

/** True when a filename or URL path ends in a renderable image extension. */
function hasImageExtension(value: string): boolean {
  return IMAGE_EXTENSIONS.test(value);
}

function MediaCard({
  item,
  showProvider,
  onDelete,
}: {
  item: UnifiedMediaItem;
  /** Stamp the source bucket on the card — only useful in the merged view. */
  showProvider: boolean;
  onDelete: () => void;
}) {
  const isImage =
    typeof item.url === "string" &&
    item.url.length > 0 &&
    // Checked against the URL as well as the name: object stores don't all
    // keep an extension in the display name (a Cloudinary public_id has none),
    // and a missing extension shouldn't downgrade a real image to a
    // placeholder icon.
    (hasImageExtension(item.name) || hasImageExtension(item.url));
  const sizeKB = (item.size / 1024).toFixed(1);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(item.url).then(
      () => toast.success("URL copied"),
      () => toast.error("Failed to copy"),
    );
  }, [item.url]);

  // For GitHub, the path-style URL (e.g. "/images/foo.png") is what users want
  // in markdown. For UT/Cloudinary, only the full URL is meaningful.
  const showPathCopy = item.provider === "github";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{
        layout: { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] },
        opacity: { duration: 0.18 },
        scale: { duration: 0.18 },
        y: { duration: 0.18 },
      }}
      className="group overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/30"
    >
      <div className="relative flex h-28 items-center justify-center bg-muted/50 sm:h-36">
        {isImage ? (
          <MediaImage
            src={item.url}
            alt={item.name}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <ImageIcon className="size-10 text-muted-foreground/30" />
        )}
        {showProvider && <ProviderMark provider={item.provider} />}
        <div
          className={cn(
            "absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 bg-black/50 p-2 transition-opacity",
            // Touch devices have no hover, so a hover-only overlay hides copy,
            // open and delete behind a gesture that doesn't exist there.
            "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          )}
        >
          <Button size="xs" variant="secondary" onClick={handleCopyUrl}>
            <Copy className="size-3" />
            URL
          </Button>
          {showPathCopy && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(`/${item.externalId}`).then(
                  () => toast.success("Path copied"),
                  () => toast.error("Failed to copy"),
                );
              }}
            >
              <Copy className="size-3" />
              Path
            </Button>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "xs", variant: "secondary" }))}
          >
            <ExternalLink className="size-3" />
          </a>
          <Button
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-xs font-medium">{item.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {sizeKB} KB
        </p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload sheet                                                       */
/* ------------------------------------------------------------------ */

function UploadMediaSheet({
  projectId,
  providers,
  initialFiles,
  open,
  onOpenChange,
  onUploaded,
}: {
  projectId: Id<"projects">;
  providers: MediaProvider[];
  initialFiles: InitialImageBatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const [isRunning, setIsRunning] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isRunning) return;
    onOpenChange(nextOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="sm:max-w-xl lg:max-w-2xl"
        overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-none"
        showCloseButton={!isRunning}
      >
        <SheetHeader className="pr-14">
          <SheetTitle>Upload images</SheetTitle>
          <SheetDescription>
            Review up to 10 images. Two files upload at a time.
          </SheetDescription>
        </SheetHeader>

        {open && (
          <BatchImageUpload
            projectId={projectId}
            providers={providers}
            initialFiles={initialFiles}
            layout="tray"
            onCancel={() => handleOpenChange(false)}
            onRunningChange={setIsRunning}
            onComplete={(files) => {
              toast.success(
                `Uploaded ${files.length} image${files.length === 1 ? "" : "s"}`,
              );
              onUploaded();
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Dialog                                                      */
/* ------------------------------------------------------------------ */

function DeleteMediaDialog({
  item,
  projectId,
  open,
  onOpenChange,
  onOptimisticDelete,
  onRestore,
  onDeleted,
}: {
  item: UnifiedMediaItem | null;
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called the moment the user confirms — hides the card before the API call. */
  onOptimisticDelete: (externalId: string) => void;
  /** Called if the API call fails so the card can be restored. */
  onRestore: (externalId: string) => void;
  onDeleted: () => void;
}) {
  const deleteByRef = useAction(api.media.uploads.deleteByRef);

  const handleDelete = useCallback(() => {
    if (!item) return;
    const args: Parameters<typeof deleteByRef>[0] = {
      projectId,
      provider: item.provider,
      externalId: item.externalId,
    };
    if (item.provider === "github" && item.sha) {
      args.sha = item.sha;
    }

    // Close the dialog and hide the card immediately. The network call
    // continues in the background; if it fails, we restore the card and
    // surface the error.
    onOptimisticDelete(item.externalId);
    onOpenChange(false);
    const deletedId = item.externalId;
    const deletedName = item.name;

    (async () => {
      try {
        await deleteByRef(args);
        toast.success(`Deleted ${deletedName}`);
        onDeleted();
      } catch (err) {
        onRestore(deletedId);
        const data = (err as { data?: { message?: string } })?.data;
        toast.error(
          data?.message ??
            (err instanceof Error ? err.message : "Failed to delete"),
        );
      }
    })();
  }, [
    deleteByRef,
    item,
    onDeleted,
    onOpenChange,
    onOptimisticDelete,
    onRestore,
    projectId,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Media File</DialogTitle>
          <DialogDescription>
            Delete{" "}
            <span className="font-medium text-foreground">{item?.name}</span>{" "}
            from {item ? PROVIDER_LABEL[item.provider] : "storage"}? Existing
            documents that reference this URL will get a broken image.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
