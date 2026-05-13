"use client";

import { useAction, useQuery } from "convex/react";
import {
  ArrowLeft,
  Cloud,
  Copy,
  ExternalLink,
  GitBranch,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubInvalidation, useGithubMedia } from "@/hooks/use-github";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveProvider = "github" | "uploadthing" | "cloudinary";

/** Provider-agnostic shape used by the card grid. */
interface UnifiedMediaItem {
  /** Stable identity within the provider — GitHub repo path, UT key, Cloudinary public_id. */
  externalId: string;
  /** Display name (filename). */
  name: string;
  /** Final URL embedded into markdown. */
  url: string;
  /** Bytes. */
  size: number;
  /** GitHub-only blob SHA — used for deletion. */
  sha?: string;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MediaPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const project = useQuery(api.projects.get, { projectId });

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedMediaItem | null>(
    null,
  );

  // Determine the active provider. Treat the legacy "external" value as github.
  const provider: ActiveProvider = useMemo(() => {
    const mode = project?.mediaStorageMode;
    if (mode === "uploadthing" || mode === "cloudinary") return mode;
    return "github";
  }, [project?.mediaStorageMode]);

  const hasGithubConfig = Boolean(project?.githubRepo && project?.mediaPath);

  /* ---------- GitHub source (existing TanStack hook) ---------- */
  const isGithub = provider === "github";
  const {
    data: githubData,
    isLoading: isGithubLoading,
    refetch: refetchGithub,
  } = useGithubMedia({
    repo: isGithub && project ? (project.githubRepo ?? null) : null,
    branch: project?.githubBranch ?? "main",
    path: isGithub && project ? (project.mediaPath ?? null) : null,
  });
  const { invalidateMedia } = useGithubInvalidation();

  /* ---------- UploadThing / Cloudinary source (Convex action) ---------- */
  const listMedia = useAction(api.media.list);
  const [providerItems, setProviderItems] = useState<UnifiedMediaItem[]>([]);
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerHasMore, setProviderHasMore] = useState(false);

  // Cursor lives in a ref so paging through doesn't re-create `fetchProvider`
  // on every page (which would re-trigger the IntersectionObserver effect).
  const providerCursorRef = useRef<string | null>(null);
  // Guard against concurrent fetches (e.g. user spam-clicking refresh while
  // a page is still in flight).
  const inFlightRef = useRef(false);

  const fetchProvider = useCallback(
    async (opts?: { append?: boolean }) => {
      if (isGithub) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const append = opts?.append ?? false;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsProviderLoading(true);
        setProviderError(null);
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
        const newItems = res.items.map((it) => ({
          externalId: it.externalId,
          name: it.filename,
          url: it.url,
          size: it.size,
        }));
        setProviderItems((prev) =>
          append ? [...prev, ...newItems] : newItems,
        );
        providerCursorRef.current = res.nextCursor;
        setProviderHasMore(res.nextCursor !== null);
      } catch (err) {
        const data = (err as { data?: { message?: string } })?.data;
        const message =
          data?.message ??
          (err instanceof Error ? err.message : "Failed to load media");
        setProviderError(message);
        if (!append) setProviderItems([]);
        // Stop chasing pages on error.
        setProviderHasMore(false);
      } finally {
        inFlightRef.current = false;
        if (append) setIsLoadingMore(false);
        else setIsProviderLoading(false);
      }
    },
    [isGithub, listMedia, projectId],
  );

  // Reset + fetch first page whenever the project or provider changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchProvider is stable per-projectId; we only want this on mount/provider switch.
  useEffect(() => {
    if (isGithub) return;
    setProviderItems([]);
    setProviderError(null);
    setProviderHasMore(false);
    providerCursorRef.current = null;
    void fetchProvider({ append: false });
  }, [isGithub, projectId]);

  // Sentinel element used by the IntersectionObserver below.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (isGithub) return;
    if (!providerHasMore || isProviderLoading || isLoadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void fetchProvider({ append: true });
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    isGithub,
    providerHasMore,
    isProviderLoading,
    isLoadingMore,
    fetchProvider,
  ]);

  /* ---------- Unified items ---------- */
  const items: UnifiedMediaItem[] = useMemo(() => {
    if (isGithub) {
      // Filter out files without a usable URL — happens when the GitHub
      // download_url is missing (e.g. private repos using OAuth headers,
      // or transient API errors).
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
        }));
    }
    return providerItems.filter(
      (i) => typeof i.url === "string" && i.url.length > 0,
    );
  }, [isGithub, githubData?.files, providerItems]);

  const isLoading = isGithub ? isGithubLoading : isProviderLoading;
  const errorMessage = isGithub ? null : providerError;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const refresh = useCallback(async () => {
    if (isGithub) {
      await invalidateMedia();
      void refetchGithub();
    } else {
      // Restart from page 1.
      providerCursorRef.current = null;
      setProviderHasMore(false);
      await fetchProvider({ append: false });
    }
  }, [fetchProvider, invalidateMedia, isGithub, refetchGithub]);

  // Auto-load more when a search has zero matches but there are more pages
  // to fetch — the user is presumably looking for something past page 1.
  useEffect(() => {
    if (isGithub) return;
    if (!searchQuery.trim()) return;
    if (!providerHasMore) return;
    if (isProviderLoading || isLoadingMore) return;
    const hasMatch = providerItems.some((it) =>
      it.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    if (!hasMatch) {
      void fetchProvider({ append: true });
    }
  }, [
    isGithub,
    searchQuery,
    providerHasMore,
    isProviderLoading,
    isLoadingMore,
    providerItems,
    fetchProvider,
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

  // Provider not yet configured (no credentials saved).
  const needsConfig =
    (provider === "uploadthing" || provider === "cloudinary") &&
    items.length === 0 &&
    !isProviderLoading &&
    providerError !== null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="size-4" />
          Back to Project
        </Link>
      </div>

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
          {filteredItems.map((item) => (
            <MediaCard
              key={`${provider}:${item.externalId}`}
              item={item}
              provider={provider}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchProvider({ append: true })}
            >
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
        onDeleted={handleUploaded}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider helpers                                                   */
/* ------------------------------------------------------------------ */

const PROVIDER_LABEL: Record<ActiveProvider, string> = {
  github: "GitHub",
  uploadthing: "UploadThing",
  cloudinary: "Cloudinary",
};

const PROVIDER_ICON: Record<ActiveProvider, typeof GitBranch> = {
  github: GitBranch,
  uploadthing: UploadCloud,
  cloudinary: Cloud,
};

function describeLocation(
  provider: ActiveProvider,
  project: { mediaPath?: string; githubRepo?: string },
): string | null {
  if (provider === "github") {
    return project.mediaPath ? `/${project.mediaPath}` : null;
  }
  if (provider === "cloudinary") {
    return project.mediaPath ? project.mediaPath : null;
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
    <div className="group overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/30">
      <div className="relative flex h-36 items-center justify-center bg-muted/50">
        {isImage ? (
          <Image
            src={item.url}
            alt={item.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="eager"
            unoptimized
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
    </div>
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
  const uploadMedia = useAction(api.media.upload);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setIsDragging(false);
    }
  }, [open]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    setIsUploading(true);
    try {
      const bytes = await selectedFile.arrayBuffer();
      await uploadMedia({
        projectId,
        bytes,
        mime: selectedFile.type,
        filename: selectedFile.name,
      });
      toast.success(`Uploaded ${selectedFile.name}`);
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
    }
  }, [onOpenChange, onUploaded, projectId, selectedFile, uploadMedia]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload to {PROVIDER_LABEL[provider]}</DialogTitle>
          <DialogDescription>
            Files go directly to your{" "}
            {provider === "github"
              ? "GitHub repo"
              : `${PROVIDER_LABEL[provider]} account`}{" "}
            — change the destination in project settings.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
          )}
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
        >
          <Upload className="mb-2 size-8 text-muted-foreground" />
          {selectedFile ? (
            <div className="text-center">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Images up to 16 MB
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSelectedFile(file);
            }}
            className="hidden"
          />
        </div>

        <DialogFooter>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading && <Loader2 className="size-4 animate-spin" />}
            Upload to {PROVIDER_LABEL[provider]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  onDeleted,
}: {
  item: UnifiedMediaItem | null;
  projectId: Id<"projects">;
  provider: ActiveProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteByRef = useAction(api.media.deleteByRef);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    setIsDeleting(true);
    try {
      const args: Parameters<typeof deleteByRef>[0] = {
        projectId,
        provider,
        externalId: item.externalId,
      };
      if (provider === "github" && item.sha) {
        args.sha = item.sha;
      }
      await deleteByRef(args);
      toast.success(`Deleted ${item.name}`);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to delete"),
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteByRef, item, onDeleted, onOpenChange, projectId, provider]);

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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
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
