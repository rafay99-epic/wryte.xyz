"use client";

import { useAction, useQuery } from "convex/react";
import { Check, ImageIcon, Loader2, Search, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MediaFile } from "@/hooks/use-github";
import { useGithubMedia } from "@/hooks/use-github";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface MediaPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Called with the selected image URL/path. */
  onSelect: (url: string) => void;
}

/**
 * Reusable media browser drawer.
 *
 * Shows three tabs — Library (GitHub media), Staged (Convex uploads pending
 * publish), and Upload — and returns a plain URL string via `onSelect`.
 */
export function MediaPickerDrawer({
  open,
  onOpenChange,
  projectId,
  onSelect,
}: MediaPickerDrawerProps) {
  const project = useQuery(
    api.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const hasGithub = Boolean(project?.githubRepo && project?.mediaPath);

  const { data: mediaData, isLoading: isLoadingMedia } = useGithubMedia({
    repo: project?.githubRepo ?? null,
    branch: project?.githubBranch ?? "main",
    path: project?.mediaPath ?? null,
  });
  const githubFiles = mediaData?.files ?? [];

  // Project-scoped media records (any provider). These are the rows we wrote
  // when the editor uploaded an image — the source of truth for "Recent".
  const projectMedia =
    useQuery(
      api.mediaDb.listForProject,
      projectId
        ? { projectId: projectId as Id<"projects">, pageSize: 50 }
        : "skip",
    )?.items ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  const filteredGithubFiles = useMemo(() => {
    if (!searchQuery.trim()) return githubFiles;
    const q = searchQuery.toLowerCase();
    return githubFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [githubFiles, searchQuery]);

  const filteredProjectMedia = useMemo(() => {
    if (!searchQuery.trim()) return projectMedia;
    const q = searchQuery.toLowerCase();
    return projectMedia.filter((item) =>
      (item.filename ?? item.fileName ?? "").toLowerCase().includes(q),
    );
  }, [projectMedia, searchQuery]);

  const handleSelect = useCallback(
    (url: string) => {
      onSelect(url);
      onOpenChange(false);
      setSearchQuery("");
      setExternalUrl("");
    },
    [onSelect, onOpenChange],
  );

  const handleExternalUrlSubmit = useCallback(() => {
    const trimmed = externalUrl.trim();
    if (!trimmed) return;
    handleSelect(trimmed);
  }, [externalUrl, handleSelect]);

  // Determine the default active tab
  const defaultTab =
    hasGithub && githubFiles.length > 0
      ? "library"
      : projectMedia.length > 0
        ? "recent"
        : "upload";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            Select Image
          </SheetTitle>
          <SheetDescription>
            Choose from your media library, staged uploads, or upload a new
            image.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full">
              {hasGithub && <TabsTrigger value="library">Library</TabsTrigger>}
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>

            {/* GitHub Library */}
            {hasGithub && (
              <TabsContent value="library">
                {isLoadingMedia ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGithubFiles.length === 0 ? (
                  <EmptyState
                    message={
                      searchQuery
                        ? "No matches found"
                        : "No media files in GitHub"
                    }
                  />
                ) : (
                  <MediaGrid>
                    {filteredGithubFiles.map((file) => (
                      <GitHubMediaItem
                        key={file.path}
                        file={file}
                        onSelect={() => handleSelect(`/${file.path}`)}
                      />
                    ))}
                  </MediaGrid>
                )}
              </TabsContent>
            )}

            {/* Recent uploads (project-scoped, any provider) */}
            <TabsContent value="recent">
              {filteredProjectMedia.length === 0 ? (
                <EmptyState
                  message={searchQuery ? "No matches found" : "No uploads yet"}
                />
              ) : (
                <MediaGrid>
                  {filteredProjectMedia.map((item) => {
                    const url = item.url ?? "";
                    const filename = item.filename ?? item.fileName ?? "image";
                    return (
                      <RecentMediaItem
                        key={item._id}
                        url={url}
                        filename={filename}
                        onSelect={() => handleSelect(url)}
                      />
                    );
                  })}
                </MediaGrid>
              )}
            </TabsContent>

            {/* Upload */}
            <TabsContent value="upload">
              <UploadTab projectId={projectId} onUploaded={handleSelect} />
            </TabsContent>

            {/* External URL */}
            <TabsContent value="url">
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="media-picker-url">Image URL</Label>
                  <Input
                    id="media-picker-url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleExternalUrlSubmit();
                      }
                    }}
                  />
                </div>

                {externalUrl.trim() && (
                  <div className="overflow-hidden rounded-lg border bg-muted/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={externalUrl}
                      alt="preview"
                      className="max-h-48 w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                <Button
                  onClick={handleExternalUrlSubmit}
                  disabled={!externalUrl.trim()}
                  className="w-full"
                >
                  Use This URL
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal sub-components                                            */
/* ------------------------------------------------------------------ */

function MediaGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 pt-2">{children}</div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <ImageIcon className="mb-3 size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function GitHubMediaItem({
  file,
  onSelect,
}: {
  file: MediaFile;
  onSelect: () => void;
}) {
  const isImage =
    /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(file.name) &&
    typeof file.downloadUrl === "string" &&
    file.downloadUrl.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/10"
    >
      <div className="relative flex h-24 items-center justify-center bg-muted/50">
        {isImage ? (
          <Image
            src={file.downloadUrl}
            alt={file.name}
            fill
            className="object-contain p-1.5"
            sizes="(max-width: 640px) 50vw, 25vw"
            loading="lazy"
            unoptimized
          />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/30" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100">
          <Check className="size-5 text-primary" />
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-medium">{file.name}</p>
      </div>
    </button>
  );
}

function RecentMediaItem({
  url,
  filename,
  onSelect,
}: {
  url: string;
  filename: string;
  onSelect: () => void;
}) {
  const isImage = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(filename);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/10"
    >
      <div className="relative flex h-24 items-center justify-center bg-muted/50">
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={filename}
            className="size-full object-contain p-1.5"
          />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/30" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100">
          <Check className="size-5 text-primary" />
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-medium">{filename}</p>
      </div>
    </button>
  );
}

function UploadTab({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: (url: string) => void;
}) {
  const uploadMedia = useAction(api.media.upload);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const bytes = await file.arrayBuffer();
        const result = await uploadMedia({
          projectId: projectId as Id<"projects">,
          bytes,
          mime: file.type,
          filename: file.name,
        });
        toast.success(`Uploaded ${file.name}`);
        onUploaded(result.url);
      } catch (err) {
        const data = (err as { data?: { message?: string } })?.data;
        toast.error(
          data?.message ??
            (err instanceof Error ? err.message : "Failed to upload image"),
        );
      } finally {
        setIsUploading(false);
      }
    },
    [uploadMedia, projectId, onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        void handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFileUpload(file);
    },
    [handleFileUpload],
  );

  return (
    <div className="pt-2">
      <button
        type="button"
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">
          {isUploading
            ? "Uploading..."
            : "Drop an image here or click to browse"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </button>
    </div>
  );
}
