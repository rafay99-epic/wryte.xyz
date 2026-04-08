"use client";

import { useAction, useQuery } from "convex/react";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  GitBranch,
  Globe,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type MediaFile,
  useGithubInvalidation,
  useGithubMedia,
} from "@/hooks/use-github";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export default function MediaPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const project = useQuery(api.projects.get, { projectId });

  // Set active project in sidebar on mount
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);

  const hasGithub = Boolean(project?.githubRepo && project?.mediaPath);

  // --- Media files via TanStack Query (replaces Zustand media store) ---
  const {
    data: mediaData,
    isLoading,
    refetch: refetchMedia,
  } = useGithubMedia({
    repo: project?.githubRepo ?? null,
    branch: project?.githubBranch ?? "main",
    path: project?.mediaPath ?? null,
  });
  const files = mediaData?.files ?? [];

  const { invalidateMedia } = useGithubInvalidation();

  /** Refresh media files — invalidates cache and refetches. */
  const fetchRemoteMedia = useCallback(async () => {
    await invalidateMedia();
  }, [invalidateMedia]);

  // Filter files by search
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [files, searchQuery]);

  /** Called after a successful upload — refresh from GitHub. */
  const handleUploaded = useCallback(() => {
    void fetchRemoteMedia();
  }, [fetchRemoteMedia]);

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
          <p className="mt-1 text-sm text-muted-foreground">
            {hasGithub
              ? `${files.length} file${files.length !== 1 ? "s" : ""} in /${project.mediaPath}`
              : "Manage images and media files for your project."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasGithub && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchMedia()}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("size-3.5", isLoading && "animate-spin")}
              />
              Refresh
            </Button>
          )}
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="size-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Search */}
      {files.length > 0 && (
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

      {/* Loading state — only shown on first fetch */}
      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Scanning media directory on GitHub...
        </div>
      )}

      {/* Content */}
      {filteredFiles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredFiles.map((file) => (
            <MediaCard
              key={file.path}
              file={file}
              onDelete={() => setDeleteTarget(file)}
            />
          ))}
        </div>
      ) : !isLoading && files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <ImageIcon className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-lg font-semibold">No media files found</h2>
          <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
            {hasGithub
              ? `No media files found in /${project.mediaPath}. Upload files to get started.`
              : "Configure GitHub settings to scan your repo for media files, or upload new ones."}
          </p>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="size-4" />
            Upload Media
          </Button>
        </div>
      ) : searchQuery.trim() && filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <Search className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : null}

      {/* Unified Upload Dialog */}
      <UploadMediaDialog
        projectId={projectId}
        hasGithub={hasGithub}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploaded={handleUploaded}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteMediaDialog
        file={deleteTarget}
        projectId={projectId}
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
/*  Media Card                                                         */
/* ------------------------------------------------------------------ */

function MediaCard({
  file,
  onDelete,
}: {
  file: MediaFile;
  onDelete: () => void;
}) {
  const isImage = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(file.name);
  const sizeKB = (file.size / 1024).toFixed(1);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(file.downloadUrl).then(
      () => toast.success("URL copied"),
      () => toast.error("Failed to copy"),
    );
  }, [file.downloadUrl]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(`/${file.path}`).then(
      () => toast.success("Path copied"),
      () => toast.error("Failed to copy"),
    );
  }, [file.path]);

  return (
    <div className="group overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/30">
      {/* Preview */}
      <div className="relative flex h-36 items-center justify-center bg-muted/50">
        {isImage ? (
          <Image
            src={file.downloadUrl}
            alt={file.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="eager"
            unoptimized
          />
        ) : (
          <ImageIcon className="size-10 text-muted-foreground/30" />
        )}
        {/* Hover actions overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="xs" variant="secondary" onClick={handleCopyUrl}>
            <Copy className="size-3" />
            URL
          </Button>
          <Button size="xs" variant="secondary" onClick={handleCopyPath}>
            <Copy className="size-3" />
            Path
          </Button>
          <a
            href={file.downloadUrl}
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
      {/* Info */}
      <div className="px-3 py-2">
        <p className="truncate text-xs font-medium">{file.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {sizeKB} KB
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Unified Upload Dialog                                              */
/* ------------------------------------------------------------------ */

type UploadDestination = "github" | "external";

function UploadMediaDialog({
  projectId,
  hasGithub,
  open,
  onOpenChange,
  onUploaded,
}: {
  projectId: Id<"projects">;
  hasGithub: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const uploadMedia = useAction(api.github.uploadMediaToGithub);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [destination, setDestination] = useState<UploadDestination>(
    hasGithub ? "github" : "external",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // External URL fields
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setIsDragging(false);
      setExtName("");
      setExtUrl("");
    }
  }, [open]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setSelectedFile(file);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleUploadToGithub = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1] ?? "";
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await uploadMedia({
        projectId,
        fileName: selectedFile.name,
        base64Content: base64,
        contentType: selectedFile.type,
      });

      toast.success(`Uploaded ${selectedFile.name} to GitHub`);
      onUploaded();
      onOpenChange(false);
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, projectId, uploadMedia, onUploaded, onOpenChange]);

  const handleAddExternal = useCallback(() => {
    const trimmedName = extName.trim();
    const trimmedUrl = extUrl.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!trimmedUrl) {
      toast.error("URL is required");
      return;
    }
    // For now, external references just get copied to clipboard
    // (full external storage will be added later)
    navigator.clipboard.writeText(trimmedUrl).then(
      () => {
        toast.success("External URL copied to clipboard");
        onOpenChange(false);
      },
      () => toast.error("Failed to copy"),
    );
  }, [extName, extUrl, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>
            Choose where to upload your media file.
          </DialogDescription>
        </DialogHeader>

        {/* Destination selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDestination("github")}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors",
              destination === "github"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40",
              !hasGithub && "cursor-not-allowed opacity-50",
            )}
            disabled={!hasGithub}
          >
            <GitBranch className="size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">GitHub</p>
              <p className="text-[11px] text-muted-foreground">
                Upload to your repo
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setDestination("external")}
            className={cn(
              "flex flex-1 items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-colors",
              destination === "external"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <Globe className="size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">External URL</p>
              <p className="text-[11px] text-muted-foreground">
                Link to hosted file
              </p>
            </div>
          </button>
        </div>

        {/* GitHub upload */}
        {destination === "github" && (
          <div className="space-y-4">
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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
                    Images, SVGs, and other media files
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.svg,.gif,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* External URL */}
        {destination === "external" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ext-name">Name</Label>
              <Input
                id="ext-name"
                placeholder="hero-image.png"
                value={extName}
                onChange={(e) => setExtName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-url">URL</Label>
              <Input
                id="ext-url"
                placeholder="https://..."
                value={extUrl}
                onChange={(e) => setExtUrl(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Paste the URL of an image hosted elsewhere. The URL will be copied
              for use in your documents.
            </p>
          </div>
        )}

        <DialogFooter>
          {destination === "github" ? (
            <Button
              onClick={handleUploadToGithub}
              disabled={!selectedFile || isUploading}
            >
              {isUploading && <Loader2 className="size-4 animate-spin" />}
              Upload to GitHub
            </Button>
          ) : (
            <Button onClick={handleAddExternal}>
              <ExternalLink className="size-4" />
              Copy URL
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Media Dialog                                                */
/* ------------------------------------------------------------------ */

function DeleteMediaDialog({
  file,
  projectId,
  open,
  onOpenChange,
  onDeleted,
}: {
  file: MediaFile | null;
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteFile = useAction(api.github.deleteFileFromGithub);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!file) return;
    setIsDeleting(true);
    try {
      let githubAccessToken: string | undefined;
      try {
        const tokenRes = await fetch("/api/github/token");
        if (tokenRes.ok) {
          const data = (await tokenRes.json()) as { token?: string };
          if (data.token) githubAccessToken = data.token;
        }
      } catch {
        // Fall back to stored PAT
      }

      const args: Parameters<typeof deleteFile>[0] = {
        projectId,
        filePath: file.path,
        sha: file.sha,
      };
      if (githubAccessToken) args.githubAccessToken = githubAccessToken;

      await deleteFile(args);

      toast.success(`Deleted ${file.name}`);
      onOpenChange(false);
      // Also do a full refresh in background to ensure consistency
      onDeleted();
    } catch {
      toast.error("Failed to delete file from GitHub");
    } finally {
      setIsDeleting(false);
    }
  }, [file, projectId, deleteFile, onDeleted, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Media File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{file?.name}</span>?
            This will permanently remove it from your GitHub repository.
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
