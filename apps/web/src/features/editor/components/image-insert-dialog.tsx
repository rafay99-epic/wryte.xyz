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
import { UploadProgress } from "@wryte/ui/upload-progress";
import { useAction, useQuery } from "convex/react";
import { Check, ImageIcon, Loader2, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CompressionOverrideDisclosure } from "@/components/forms/compression-override-disclosure";
import { MediaImage } from "@/features/media-library/components/media-image";

type ImageInsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markdown: string) => void;
  documentId: string;
  projectId: string;
};

/**
 * Drawer for inserting images into the markdown editor.
 *
 * Library and upload both use the project's configured media provider:
 * GitHub writes to `mediaPath`, Cloudinary uses that folder prefix, and
 * UploadThing routes through the project's saved UploadThing credential.
 */
export function ImageInsertDialog({
  open,
  onOpenChange,
  onInsert,
  documentId,
  projectId,
}: ImageInsertDialogProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadSteps = [
    { id: "compress", label: "Compressing image" },
    { id: "watermark", label: "Checking for Gemini watermark" },
    { id: "upload", label: "Uploading to provider" },
  ];

  const project = useQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const uploadMedia = useAction(api.media.uploads.upload);
  const { compress, isCompressing, resolvedSettings } = useImageCompression(
    projectId as Id<"projects">,
  );
  const { removeWatermark } = useWatermarkRemoval(projectId as Id<"projects">);
  const { maxBytes: maxUploadBytes, formatted: maxUploadLabel } =
    useUploadLimit(projectId as Id<"projects">);
  const [compressionOverride, setCompressionOverride] =
    useState<CompressionSettings | null>(null);
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
    const query = searchQuery.trim().toLowerCase();
    if (!query) return libraryItems;
    return libraryItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.externalId.toLowerCase().includes(query),
    );
  }, [libraryItems, searchQuery]);

  const canUpload = Boolean(project);
  const defaultTab = "library";

  const resetForm = useCallback(() => {
    setImageUrl("");
    setAltText("");
    setSearchQuery("");
    setUploadError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      setCompressionOverride(null);
    }
  }, [open, resetForm]);

  function closeDialog() {
    resetForm();
    onOpenChange(false);
  }

  function insertMarkdown(url: string, fallbackAlt: string) {
    const alt = altText || fallbackAlt;
    onInsert(`![${alt}](${url})`);
    closeDialog();
  }

  function handleUrlInsert() {
    const trimmed = imageUrl.trim();
    if (!trimmed) return;
    insertMarkdown(trimmed, "image");
  }

  function handleLibraryInsert(item: MediaLibraryItem) {
    insertMarkdown(getSelectionValue(item), item.name);
  }

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        setProgressStep("compress");
        const compressed = await compress(
          file,
          compressionOverride ?? undefined,
        );
        let toUpload = compressed.file;
        let savings = describeSavings(compressed);

        setProgressStep("watermark");
        const cleaned = await removeWatermark(toUpload);
        if (cleaned.wasApplied) {
          savings = savings
            ? `${savings} · Gemini watermark removed`
            : "Gemini watermark removed";
          toUpload = cleaned.file;
        }

        if (toUpload.size > maxUploadBytes) {
          setUploadError(
            `File is ${formatMb(toUpload.size)}; exceeds the ${maxUploadLabel} limit. Try a smaller image, increase compression, or raise the limit in project settings.`,
          );
          setIsUploading(false);
          return;
        }
        const bytes = await toUpload.arrayBuffer();
        setProgressStep("upload");
        const result = await uploadMedia({
          projectId: projectId as Id<"projects">,
          provider: uploadProvider,
          bytes,
          mime: toUpload.type,
          filename: toUpload.name,
          documentId: documentId as Id<"documents">,
        });

        toast.success(`Uploaded ${toUpload.name}`, {
          description: savings || undefined,
        });

        void refreshLibrary();
        const alt = altText || toUpload.name;
        onInsert(`![${alt}](${result.url})`);
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
        setProgressStep(null);
      }
    },
    [
      altText,
      compress,
      compressionOverride,
      documentId,
      maxUploadBytes,
      maxUploadLabel,
      onInsert,
      onOpenChange,
      projectId,
      refreshLibrary,
      resetForm,
      uploadMedia,
      removeWatermark,
      uploadProvider,
    ],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
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
          <SheetTitle>Insert Image</SheetTitle>
          <SheetDescription>
            Choose from the project media library, paste a URL, or upload one.
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
                    <Label htmlFor="img-library-alt">Alt text</Label>
                    <Input
                      id="img-library-alt"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Description of the image"
                    />
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search images..."
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
                            : "No media files found"
                      }
                    />
                  ) : (
                    <>
                      <MediaGrid>
                        {filteredLibraryItems.map((item) => (
                          <LibraryMediaItem
                            key={item.externalId}
                            item={item}
                            onSelect={() => handleLibraryInsert(item)}
                          />
                        ))}
                      </MediaGrid>
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
                  <Label htmlFor="img-url">Image URL</Label>
                  <Input
                    id="img-url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="img-alt">Alt text</Label>
                  <Input
                    id="img-alt"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Description of the image"
                  />
                </div>

                {imageUrl && (
                  <div className="overflow-hidden rounded-lg border bg-muted/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={altText || "preview"}
                      className="max-h-48 w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="upload">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="img-upload-alt">Alt text</Label>
                  <Input
                    id="img-upload-alt"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Description of the image"
                  />
                </div>

                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-transparent p-8 text-center transition-colors hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-60"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canUpload || isUploading || isCompressing}
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
                  override={compressionOverride}
                  onOverrideChange={setCompressionOverride}
                />

                {progressStep && (
                  <UploadProgress
                    steps={uploadSteps}
                    currentStep={progressStep}
                  />
                )}

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
          <Button onClick={handleUrlInsert} disabled={!imageUrl || isUploading}>
            Insert URL
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MediaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3">
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
