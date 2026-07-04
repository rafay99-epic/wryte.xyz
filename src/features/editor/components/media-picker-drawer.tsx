"use client";

import { useAction, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImageIcon, Loader2, Search, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CompressionOverrideDisclosure } from "@/components/forms/compression-override-disclosure";
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
import { MediaImage } from "@/features/media-library/components/media-image";
import { useImageCompression } from "@/hooks/use-image-compression";
import {
  type MediaLibraryItem,
  useProjectMediaLibrary,
} from "@/hooks/use-project-media-library";
import { useUploadLimit } from "@/hooks/use-upload-limit";
import {
  type CompressionSettings,
  describeSavings,
} from "@/lib/image-compression";
import { formatMb } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type MediaPickerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Called with the selected image URL/path. */
  onSelect: (url: string) => void;
};

/**
 * Reusable media browser drawer.
 *
 * Library tab lists from the project's active media provider (GitHub,
 * UploadThing, or Cloudinary). Recent, Upload, and URL tabs supplement
 * browsing for quick picks and new assets.
 */
export function MediaPickerDrawer({
  open,
  onOpenChange,
  projectId,
  onSelect,
}: MediaPickerDrawerProps) {
  const project = useQuery(
    api.cms.projects.get,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const {
    showLibrary,
    items: libraryItems,
    isLoading: isLibraryLoading,
    isLoadingMore,
    error: libraryError,
    hasMore,
    loadMore,
    refresh: refreshLibrary,
    getSelectionValue,
  } = useProjectMediaLibrary({
    projectId: projectId as Id<"projects">,
    project,
    enabled: open,
  });

  // Project-scoped media records (any provider). These are the rows we wrote
  // when the editor uploaded an image — the source of truth for "Recent".
  const projectMedia =
    useQuery(
      api.media.uploadsDb.listForProject,
      projectId
        ? { projectId: projectId as Id<"projects">, pageSize: 50 }
        : "skip",
    )?.items ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  const filteredLibraryItems = useMemo(() => {
    if (!searchQuery.trim()) return libraryItems;
    const q = searchQuery.toLowerCase();
    return libraryItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.externalId.toLowerCase().includes(q),
    );
  }, [libraryItems, searchQuery]);

  const filteredProjectMedia = useMemo(() => {
    if (!searchQuery.trim()) return projectMedia;
    const q = searchQuery.toLowerCase();
    return projectMedia.filter((item) =>
      (item.filename ?? "").toLowerCase().includes(q),
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

  const defaultTab =
    showLibrary && libraryItems.length > 0
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
            Choose from your media library or upload a new image.
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

          <Tabs defaultValue={defaultTab} key={defaultTab} className="min-h-0">
            <TabsList className="w-full">
              {showLibrary && (
                <TabsTrigger value="library">Library</TabsTrigger>
              )}
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>

            {showLibrary && (
              <TabsContent value="library">
                {libraryError && (
                  <p className="mb-3 text-xs text-destructive">
                    {libraryError}
                  </p>
                )}
                {isLibraryLoading ? (
                  <PickerGridSkeleton />
                ) : filteredLibraryItems.length === 0 ? (
                  <EmptyState
                    message={
                      searchQuery
                        ? "No matches found"
                        : libraryError
                          ? "Couldn't load media library"
                          : "No media files found"
                    }
                  />
                ) : (
                  <>
                    <MediaGrid>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {filteredLibraryItems.map((item) => (
                          <PickerGridItem key={item.externalId}>
                            <LibraryMediaItem
                              item={item}
                              onSelect={() =>
                                handleSelect(getSelectionValue(item))
                              }
                            />
                          </PickerGridItem>
                        ))}
                      </AnimatePresence>
                    </MediaGrid>
                    {!isLibraryLoading && hasMore && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        disabled={isLoadingMore}
                        onClick={loadMore}
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Loading…
                          </>
                        ) : (
                          "Load more"
                        )}
                      </Button>
                    )}
                  </>
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
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredProjectMedia.map((item) => {
                      const url = item.url ?? "";
                      const filename = item.filename ?? "image";
                      return (
                        <PickerGridItem key={item._id}>
                          <RecentMediaItem
                            url={url}
                            filename={filename}
                            onSelect={() => handleSelect(url)}
                          />
                        </PickerGridItem>
                      );
                    })}
                  </AnimatePresence>
                </MediaGrid>
              )}
            </TabsContent>

            {/* Upload */}
            <TabsContent value="upload">
              <UploadTab
                projectId={projectId}
                onUploaded={(url) => {
                  void refreshLibrary();
                  handleSelect(url);
                }}
              />
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

const PICKER_ITEM_TRANSITION = {
  layout: { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] as const },
  opacity: { duration: 0.18 },
  scale: { duration: 0.18 },
  y: { duration: 0.18 },
};

function PickerGridItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={PICKER_ITEM_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

function PickerGridSkeleton() {
  return (
    <MediaGrid>
      {Array.from({ length: 6 }, (_, index) => (
        <motion.div
          key={`picker-skeleton-${index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: index * 0.04 }}
          className="w-full overflow-hidden rounded-lg border bg-card"
        >
          <div className="relative aspect-[4/3] media-shimmer" />
          <div className="mx-2 my-1.5 h-3 w-2/3 rounded media-shimmer" />
        </motion.div>
      ))}
    </MediaGrid>
  );
}

function MediaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 pt-2">
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <ImageIcon className="mb-3 size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function LibraryMediaItem({
  item,
  onSelect,
}: {
  item: MediaLibraryItem;
  onSelect: () => void;
}) {
  const isImage =
    /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(item.name) &&
    item.url.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/10"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted/50">
        {isImage ? (
          <MediaImage
            src={item.url}
            alt={item.name}
            sizes="(max-width: 640px) 50vw, 8rem"
            className="p-1.5"
          />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/30" />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100">
          <Check className="size-5 text-primary" />
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-medium">{item.name}</p>
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
      className="group w-full overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/10"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted/50">
        {isImage && url ? (
          <MediaImage
            src={url}
            alt={filename}
            sizes="(max-width: 640px) 50vw, 8rem"
            className="p-1.5"
          />
        ) : (
          <ImageIcon className="size-8 text-muted-foreground/30" />
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100">
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
  const uploadMedia = useAction(api.media.uploads.upload);
  const { compress, isCompressing, resolvedSettings } = useImageCompression(
    projectId as Id<"projects">,
  );
  const { maxBytes: maxUploadBytes, formatted: maxUploadLabel } =
    useUploadLimit(projectId as Id<"projects">);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [override, setOverride] = useState<CompressionSettings | null>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const compressed = await compress(file, override ?? undefined);
        const toUpload = compressed.file;
        if (toUpload.size > maxUploadBytes) {
          toast.error("File too large", {
            description: `${formatMb(toUpload.size)} exceeds the ${maxUploadLabel} limit (even after compression). Try a smaller image, increase compression, or raise the limit in project settings.`,
          });
          setIsUploading(false);
          return;
        }
        const bytes = await toUpload.arrayBuffer();
        const result = await uploadMedia({
          projectId: projectId as Id<"projects">,
          bytes,
          mime: toUpload.type,
          filename: toUpload.name,
        });
        const savings = describeSavings(compressed);
        toast.success(`Uploaded ${toUpload.name}`, {
          description: savings || undefined,
        });
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
    [
      compress,
      override,
      maxUploadBytes,
      maxUploadLabel,
      uploadMedia,
      projectId,
      onUploaded,
    ],
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
    <div className="space-y-3 pt-2">
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
        {isUploading || isCompressing ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">
          {isCompressing
            ? "Compressing..."
            : isUploading
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

      <CompressionOverrideDisclosure
        resolvedSettings={resolvedSettings}
        override={override}
        onOverrideChange={setOverride}
      />
    </div>
  );
}
