"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useImageCompression } from "@wryte/logic/hooks/use-image-compression";
import {
  type MediaLibraryItem,
  useProjectMediaLibrary,
} from "@wryte/logic/hooks/use-project-media-library";
import { useUploadLimit } from "@wryte/logic/hooks/use-upload-limit";
import { useWatermarkRemoval } from "@wryte/logic/hooks/use-watermark-removal";
import {
  type CompressionSettings,
  describeSavings,
} from "@wryte/logic/lib/image-compression/index";
import { formatMb } from "@wryte/logic/lib/upload-limits";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import {
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
import { MediaProviderTabs } from "@wryte/ui/media-provider-tabs";
import { Skeleton } from "@wryte/ui/skeleton";
import { UploadProgress } from "@wryte/ui/upload-progress";
import { useAction, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  Copy,
  ExternalLink,
  FileImage,
  GitBranch,
  HardDrive,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CompressionOverrideDisclosure } from "@/components/forms/compression-override-disclosure";
import { MediaImage } from "@/features/media-library/components/media-image";
import { usePendingDeletes } from "@/features/media-library/hooks/use-pending-deletes";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveProvider = MediaProvider;

type UnifiedMediaItem = MediaLibraryItem;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function MediaLibraryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const project = useQuery(api.cms.projects.get, { projectId });

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
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
    provider,
    setProvider,
    providerTabs,
    isGithub,
    hasGithubConfig,
    items,
    isLoading,
    isLoadingMore,
    error: errorMessage,
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
    if (isGithub) return;
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
  }, [isGithub, providerHasMore, isLoading, isLoadingMore, loadMore]);

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
    if (isGithub) return;
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
  }, [
    isGithub,
    searchQuery,
    providerHasMore,
    isLoading,
    isLoadingMore,
    items,
    loadMore,
  ]);

  const handleUploaded = useCallback(() => {
    void refresh();
  }, [refresh]);

  /* ---------- Render guards ---------- */
  if (project === undefined) {
    return (
      <div className="p-6">
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

  const providerLabel = PROVIDER_LABEL[provider];
  const providerIcon = PROVIDER_ICON[provider];
  const location = describeLocation(provider, project);

  // Provider selected but never connected — the server reports this directly,
  // so it no longer has to be inferred from "empty list plus an error".
  const needsConfig =
    providerTabs.find((tab) => tab.provider === provider)?.configured === false;

  return (
    <div className="p-6">
      {/* Navigation lives in the sidebar's single Back button — no
          per-page back links. */}
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ProviderBadge provider={provider} />
            <span>·</span>
            <span>
              {items.length} file{items.length === 1 ? "" : "s"}
            </span>
            {location ? (
              <>
                <span>·</span>
                <span className="font-mono text-xs">{location}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("size-3.5", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {/*
        One tab per connected provider. Selecting one re-lists from that bucket
        and points uploads and deletes at it, so several storage backends stay
        browsable side by side. Hidden when only one is connected.
      */}
      <MediaProviderTabs
        tabs={providerTabs}
        selected={provider}
        onSelect={setProvider}
        className="mb-4"
      />

      {/* Search */}
      {items.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search media files..."
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
          Loading from {providerLabel}…
        </div>
      )}

      {/* Error state for provider listing (e.g. missing credentials) */}
      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">Couldn't load from {providerLabel}.</p>
          <p className="mt-1 text-xs">{errorMessage}</p>
          <Link
            href={`/projects/${projectId}/settings`}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "mt-2",
            )}
          >
            Open Media settings
          </Link>
        </div>
      )}

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredItems.map((item) => (
              <MediaCard
                key={`${provider}:${item.externalId}`}
                item={item}
                provider={provider}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : !isLoading && items.length === 0 ? (
        <EmptyState
          provider={provider}
          hasGithubConfig={hasGithubConfig}
          needsConfig={needsConfig}
          onUpload={() => setUploadDialogOpen(true)}
          providerIcon={providerIcon}
          location={location}
          projectId={projectId}
        />
      ) : searchQuery.trim() && filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <Search className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {providerHasMore || isLoadingMore
              ? `Searching… loaded ${items.length} so far`
              : `No results for "${searchQuery}"`}
          </p>
          {(providerHasMore || isLoadingMore) && (
            <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      ) : null}

      {/* Infinite-scroll sentinel + loading indicator */}
      {!isGithub && (providerHasMore || isLoadingMore) && (
        <div
          ref={sentinelRef}
          className="mt-6 flex items-center justify-center"
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading more from {providerLabel}…
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load more
            </Button>
          )}
        </div>
      )}

      {/* End-of-list marker */}
      {!isGithub && !providerHasMore && !isLoadingMore && items.length > 0 && (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          {items.length} file{items.length === 1 ? "" : "s"} loaded · end of
          list
        </p>
      )}

      <UploadMediaDialog
        projectId={projectId}
        provider={provider}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploaded={handleUploaded}
      />

      <DeleteMediaDialog
        item={deleteTarget}
        projectId={projectId}
        provider={provider}
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

/** Only the glyph is a UI choice — everything else lives in the registry. */
const PROVIDER_ICON: Record<ActiveProvider, typeof GitBranch> = {
  github: GitBranch,
  uploadthing: UploadCloud,
  cloudinary: Cloud,
  r2: HardDrive,
};

function describeLocation(
  provider: ActiveProvider,
  project: { mediaPath?: string; githubRepo?: string },
): string | null {
  if (provider === "github") {
    return project.mediaPath ? `/${project.mediaPath}` : null;
  }
  // Cloudinary folders and R2 key prefixes are both `mediaPath`; UploadThing
  // has a flat namespace and nothing to show.
  if (provider === "cloudinary" || provider === "r2") {
    return project.mediaPath ?? null;
  }
  return null;
}

function ProviderBadge({ provider }: { provider: ActiveProvider }) {
  const Icon = PROVIDER_ICON[provider];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3" />
      {PROVIDER_LABEL[provider]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyState({
  provider,
  hasGithubConfig,
  needsConfig,
  onUpload,
  providerIcon: ProviderIcon,
  location,
  projectId,
}: {
  provider: ActiveProvider;
  hasGithubConfig: boolean;
  needsConfig: boolean;
  onUpload: () => void;
  providerIcon: typeof GitBranch;
  location: string | null;
  projectId: Id<"projects">;
}) {
  if (needsConfig) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
        <ProviderIcon className="mb-4 size-12 text-muted-foreground/50" />
        <h2 className="mb-2 text-lg font-semibold">
          Connect {PROVIDER_LABEL[provider]}
        </h2>
        <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
          Add your {PROVIDER_LABEL[provider]} credentials in project settings to
          load media from your account.
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
      <ImageIcon className="mb-4 size-12 text-muted-foreground/50" />
      <h2 className="mb-2 text-lg font-semibold">No media files found</h2>
      <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
        {provider === "github"
          ? hasGithubConfig
            ? `Nothing in ${location ?? "your repo"} yet. Upload to get started.`
            : "Configure GitHub settings to scan your repo for media, or upload new files."
          : `No media in your ${PROVIDER_LABEL[provider]} account yet. Upload to get started.`}
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

function MediaCard({
  item,
  provider,
  onDelete,
}: {
  item: UnifiedMediaItem;
  provider: ActiveProvider;
  onDelete: () => void;
}) {
  const isImage =
    /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(item.name) &&
    typeof item.url === "string" &&
    item.url.length > 0;
  const sizeKB = (item.size / 1024).toFixed(1);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(item.url).then(
      () => toast.success("URL copied"),
      () => toast.error("Failed to copy"),
    );
  }, [item.url]);

  // For GitHub, the path-style URL (e.g. "/images/foo.png") is what users want
  // in markdown. For UT/Cloudinary, only the full URL is meaningful.
  const showPathCopy = provider === "github";

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
      <div className="relative flex h-36 items-center justify-center bg-muted/50">
        {isImage ? (
          <MediaImage
            src={item.url}
            alt={item.name}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <ImageIcon className="size-10 text-muted-foreground/30" />
        )}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
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
/*  Upload Dialog                                                      */
/* ------------------------------------------------------------------ */

function UploadMediaDialog({
  projectId,
  provider,
  open,
  onOpenChange,
  onUploaded,
}: {
  projectId: Id<"projects">;
  provider: ActiveProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const uploadMedia = useAction(api.media.uploads.upload);
  const { compress, isCompressing, resolvedSettings } =
    useImageCompression(projectId);
  const { removeWatermark } = useWatermarkRemoval(projectId);
  const { maxBytes: maxUploadBytes, formatted: maxUploadLabel } =
    useUploadLimit(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [override, setOverride] = useState<CompressionSettings | null>(null);
  const [progressStep, setProgressStep] = useState<string | null>(null);

  const uploadSteps = [
    { id: "compress", label: "Compressing image" },
    { id: "watermark", label: "Checking for Gemini watermark" },
    { id: "upload", label: "Uploading to provider" },
  ];

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setIsDragging(false);
      setOverride(null);
      setProgressStep(null);
    }
  }, [open]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    setIsUploading(true);

    try {
      // Step 1: Compress
      setProgressStep("compress");
      const compressed = await compress(selectedFile, override ?? undefined);
      let toUpload = compressed.file;
      let savings = describeSavings(compressed);

      // Step 2: Check & remove watermark
      setProgressStep("watermark");
      const cleaned = await removeWatermark(toUpload);
      if (cleaned.wasApplied) {
        savings = savings
          ? `${savings} · Gemini watermark removed`
          : "Gemini watermark removed";
        toUpload = cleaned.file;
      }

      if (toUpload.size > maxUploadBytes) {
        toast.error("File too large", {
          description: `${formatMb(toUpload.size)} exceeds the ${maxUploadLabel} limit (even after compression). Try a smaller image, increase compression, or raise the limit in project settings.`,
        });
        setIsUploading(false);
        setProgressStep(null);
        return;
      }

      // Step 3: Upload
      setProgressStep("upload");
      const bytes = await toUpload.arrayBuffer();
      // Explicit destination: the upload lands in whichever provider the
      // library is showing, not silently in the project default.
      await uploadMedia({
        projectId,
        provider,
        bytes,
        mime: toUpload.type,
        filename: toUpload.name,
      });
      toast.success(`Uploaded ${toUpload.name}`, {
        description: savings || undefined,
      });
      onUploaded();
      onOpenChange(false);
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to upload"),
      );
    } finally {
      setIsUploading(false);
      setProgressStep(null);
    }
  }, [
    compress,
    removeWatermark,
    maxUploadBytes,
    maxUploadLabel,
    onOpenChange,
    onUploaded,
    override,
    projectId,
    provider,
    selectedFile,
    uploadMedia,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="relative">
          {selectedFile && !isUploading && !isCompressing && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute -right-1 -top-1 z-10 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="size-3.5" />
            </button>
          )}

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-4 text-primary" />
              Upload to {PROVIDER_LABEL[provider]}
            </DialogTitle>
            <DialogDescription>
              {provider === "github"
                ? "Image goes straight to your GitHub repo."
                : `Image goes straight to your ${PROVIDER_LABEL[provider]} account.`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Drop zone / file preview */}
        {selectedFile && !isUploading && !isCompressing ? (
          <SelectedFilePreview
            file={selectedFile}
            onRemove={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        ) : (
          <DropZone
            isDragging={isDragging}
            isProcessing={isUploading || isCompressing}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) setSelectedFile(file);
            }}
            onFileSelected={(file) => setSelectedFile(file)}
            fileInputRef={fileInputRef}
            maxLabel={maxUploadLabel}
          />
        )}

        {/* Compression override (only when idle with a file) */}
        {selectedFile && !isUploading && !isCompressing && (
          <div className="mt-3">
            <CompressionOverrideDisclosure
              resolvedSettings={resolvedSettings}
              override={override}
              onOverrideChange={setOverride}
            />
          </div>
        )}

        {/* Progress step indicator */}
        {progressStep && (
          <div className="mt-4">
            <UploadProgress steps={uploadSteps} currentStep={progressStep} />
          </div>
        )}

        <DialogFooter className="mt-3 gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedFile(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || isCompressing}
          >
            {(isUploading || isCompressing) && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {isCompressing
              ? "Compressing…"
              : isUploading
                ? "Uploading…"
                : `Upload to ${PROVIDER_LABEL[provider]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components for the Upload dialog                               */
/* ------------------------------------------------------------------ */

function SelectedFilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isImage = file.type.startsWith("image/");
  const sizeKB = (file.size / 1024).toFixed(1);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border">
      {/* Preview area */}
      <div className="flex max-h-36 items-center justify-center bg-muted/30">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-h-36 w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-24 items-center justify-center">
            <FileImage className="size-10 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* File info row */}
      <div className="flex items-center gap-3 border-t px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <ImageIcon className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {file.name}
          </p>
          <p className="text-[11px] text-muted-foreground">{sizeKB} KB</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Remove file"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DropZone({
  isDragging,
  isProcessing,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelected,
  fileInputRef,
  maxLabel,
}: {
  isDragging: boolean;
  isProcessing: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelected: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  maxLabel: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "mt-4 flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-all",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        isProcessing && "pointer-events-none opacity-60",
      )}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isProcessing ? (
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      ) : isDragging ? (
        <Upload className="size-8 text-primary" />
      ) : (
        <Upload className="size-8 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-medium">
          {isProcessing ? "Processing…" : "Drop a file here or click to browse"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Images up to {maxLabel}
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          // Reset so the same file can be re-selected.
          e.target.value = "";
        }}
        className="hidden"
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Dialog                                                      */
/* ------------------------------------------------------------------ */

function DeleteMediaDialog({
  item,
  projectId,
  provider,
  open,
  onOpenChange,
  onOptimisticDelete,
  onRestore,
  onDeleted,
}: {
  item: UnifiedMediaItem | null;
  projectId: Id<"projects">;
  provider: ActiveProvider;
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
      provider,
      externalId: item.externalId,
    };
    if (provider === "github" && item.sha) {
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
    provider,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Media File</DialogTitle>
          <DialogDescription>
            Delete{" "}
            <span className="font-medium text-foreground">{item?.name}</span>{" "}
            from {PROVIDER_LABEL[provider]}? Existing documents that reference
            this URL will get a broken image.
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
