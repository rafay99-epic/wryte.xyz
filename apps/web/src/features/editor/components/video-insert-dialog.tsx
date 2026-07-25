"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type MediaLibraryItem,
  useProjectMediaLibrary,
} from "@wryte/logic/hooks/use-project-media-library";
import { useUploadLimit } from "@wryte/logic/hooks/use-upload-limit";
import { formatMb } from "@wryte/logic/lib/upload-limits";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import { MediaProviderTabs } from "@wryte/ui/media-provider-tabs";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@wryte/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@wryte/ui/tabs";
import { useAction, useQuery } from "convex/react";
import { Check, Film, Loader2, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { isVideoFilename, videoEmbedMarkup } from "../lib/video";

type VideoInsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markup: string) => void;
  documentId: string;
  projectId: string;
};

const ACCEPTED_VIDEO_MIME = "video/mp4,video/webm,video/quicktime,video/ogg";

/**
 * Drawer for embedding videos into the markdown editor. Mirrors the image
 * dialog: pick from the project media library (filtered to video files),
 * paste a hosted URL (UploadThing, Cloudinary, anywhere), or upload through
 * the project's configured media provider. Inserts a raw `<video>` tag —
 * markdown has no native video syntax.
 */
export function VideoInsertDialog({
  open,
  onOpenChange,
  onInsert,
  documentId,
  projectId,
}: VideoInsertDialogProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = useQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const uploadMedia = useAction(api.media.uploads.upload);
  const { maxBytes: maxUploadBytes, formatted: maxUploadLabel } =
    useUploadLimit(projectId as Id<"projects">);
  const {
    filter,
    setFilter,
    uploadProvider,
    configuredTabs,
    items: libraryItems,
    isLoading: isLibraryLoading,
    isLoadingMore,
    errors: libraryErrors,
    hasMore,
    loadMore,
    refresh: refreshLibrary,
    getSelectionValue,
  } = useProjectMediaLibrary({
    projectId: projectId as Id<"projects">,
    project,
    enabled: open,
  });

  const filteredLibraryItems = useMemo(() => {
    const videos = libraryItems.filter((item) => isVideoFilename(item.name));
    const query = searchQuery.trim().toLowerCase();
    if (!query) return videos;
    return videos.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.externalId.toLowerCase().includes(query),
    );
  }, [libraryItems, searchQuery]);

  const canUpload = Boolean(project);
  const defaultTab = "library";

  const resetForm = useCallback(() => {
    setVideoUrl("");
    setTitle("");
    setSearchQuery("");
    setUploadError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  function closeDialog() {
    resetForm();
    onOpenChange(false);
  }

  function insertEmbed(url: string, fallbackTitle: string) {
    onInsert(videoEmbedMarkup(url, title || fallbackTitle));
    closeDialog();
  }

  function handleUrlInsert() {
    const trimmed = videoUrl.trim();
    if (!trimmed) return;
    insertEmbed(trimmed, "");
  }

  function handleLibraryInsert(item: MediaLibraryItem) {
    insertEmbed(getSelectionValue(item), item.name);
  }

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        if (file.size > maxUploadBytes) {
          setUploadError(
            `File is ${formatMb(file.size)}; exceeds the ${maxUploadLabel} limit. Host larger videos externally (e.g. UploadThing) and embed them via the URL tab.`,
          );
          setIsUploading(false);
          return;
        }
        const bytes = await file.arrayBuffer();
        const result = await uploadMedia({
          projectId: projectId as Id<"projects">,
          provider: uploadProvider,
          bytes,
          mime: file.type,
          filename: file.name,
          documentId: documentId as Id<"documents">,
        });

        toast.success(`Uploaded ${file.name}`);

        void refreshLibrary();
        onInsert(videoEmbedMarkup(result.url, title || file.name));
        resetForm();
        onOpenChange(false);
      } catch (err) {
        const data = (err as { data?: { message?: string } })?.data;
        setUploadError(
          data?.message ??
            (err instanceof Error ? err.message : "Upload failed"),
        );
      } finally {
        setIsUploading(false);
      }
    },
    [
      documentId,
      maxUploadBytes,
      maxUploadLabel,
      onInsert,
      onOpenChange,
      projectId,
      refreshLibrary,
      resetForm,
      title,
      uploadMedia,
      uploadProvider,
    ],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("video/")) {
      void handleFileUpload(file);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Insert Video</SheetTitle>
          <SheetDescription>
            Choose from the project media library, paste a hosted video URL, or
            upload one.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <Tabs defaultValue={defaultTab} key={defaultTab}>
            <TabsList className="w-full">
              {true && <TabsTrigger value="library">Library</TabsTrigger>}
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

            {true && (
              <TabsContent value="library">
                <div className="space-y-4">
                  <MediaProviderTabs
                    tabs={configuredTabs}
                    selected={filter}
                    onSelect={setFilter}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="video-library-title">Title</Label>
                    <Input
                      id="video-library-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Short description of the video"
                    />
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search videos..."
                      className="pl-9"
                    />
                  </div>

                  {libraryErrors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {libraryErrors
                        .map((e) => `${e.label}: ${e.message}`)
                        .join(" · ")}
                    </p>
                  )}

                  {isLibraryLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredLibraryItems.length === 0 ? (
                    <EmptyState
                      message={
                        searchQuery
                          ? "No matches found"
                          : libraryErrors.length > 0
                            ? "Couldn't load media library"
                            : "No video files found"
                      }
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
                        {filteredLibraryItems.map((item) => (
                          <LibraryVideoItem
                            key={item.externalId}
                            item={item}
                            onSelect={() => handleLibraryInsert(item)}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={isLoadingMore}
                          onClick={loadMore}
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            "Load more"
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="url">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="video-url">Video URL</Label>
                  <Input
                    id="video-url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="video-title">Title</Label>
                  <Input
                    id="video-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short description of the video"
                  />
                </div>

                {videoUrl && (
                  <div className="overflow-hidden rounded-lg border bg-muted/50">
                    {/* biome-ignore lint/a11y/useMediaCaption: previewing a user-supplied URL; no caption track exists. */}
                    <video
                      src={videoUrl}
                      controls
                      preload="metadata"
                      className="max-h-48 w-full bg-black object-contain"
                      onError={(e) => {
                        (e.target as HTMLVideoElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="upload">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="video-upload-title">Title</Label>
                  <Input
                    id="video-upload-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short description of the video"
                  />
                </div>

                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-transparent p-8 text-center transition-colors hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-60"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canUpload || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="size-8 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isUploading
                      ? "Uploading..."
                      : "Drop a video here or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Max {maxUploadLabel} — host larger videos externally and use
                    the URL tab
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_VIDEO_MIME}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </button>

                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button onClick={handleUrlInsert} disabled={!videoUrl || isUploading}>
            Insert URL
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Film className="mb-3 size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function LibraryVideoItem({
  item,
  onSelect,
}: {
  item: MediaLibraryItem;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-primary/40 hover:ring-2 hover:ring-primary/10"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-muted/50">
        <Film className="size-8 text-muted-foreground/30" />
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
