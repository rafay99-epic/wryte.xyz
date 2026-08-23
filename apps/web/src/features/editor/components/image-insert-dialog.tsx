"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type MediaLibraryItem,
  useProjectMediaLibrary,
} from "@wryte/logic/hooks/use-project-media-library";
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
import { useQuery } from "convex/react";
import { Check, ImageIcon, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BatchImageUpload } from "@/components/media/batch-image-upload";
import { MediaImage } from "@/features/media-library/components/media-image";

type ImageInsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markdown: string) => void;
  documentId: string;
  projectId: string;
};

type ImageTab = "library" | "url" | "upload";

function isImageTab(value: string): value is ImageTab {
  return value === "library" || value === "url" || value === "upload";
}

function escapeMarkdownAlt(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("]", "\\]");
}

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
  const [activeTab, setActiveTab] = useState<ImageTab>("library");
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const project = useQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const {
    filter,
    setFilter,
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

  const resetForm = useCallback(() => {
    setImageUrl("");
    setAltText("");
    setSearchQuery("");
    setActiveTab("library");
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  function closeDialog() {
    if (isBatchRunning) return;
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

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || !isBatchRunning) onOpenChange(nextOpen);
      }}
    >
      <SheetContent showCloseButton={!isBatchRunning}>
        <SheetHeader>
          <SheetTitle>Insert Image</SheetTitle>
          <SheetDescription>
            Choose from the library, paste a URL, or upload up to 10 images.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (isImageTab(value)) setActiveTab(value);
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

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
              <BatchImageUpload
                projectId={projectId as Id<"projects">}
                documentId={documentId as Id<"documents">}
                providers={configuredTabs.map((tab) => tab.provider)}
                editAltText
                onCancel={closeDialog}
                onRunningChange={setIsBatchRunning}
                onComplete={(files) => {
                  const markdown = files
                    .map((file) => {
                      const alt = escapeMarkdownAlt(
                        file.altText || file.filename,
                      );
                      return `![${alt}](${file.url})`;
                    })
                    .join("\n\n");
                  void refreshLibrary();
                  onInsert(markdown);
                  resetForm();
                  onOpenChange(false);
                }}
              />
            </TabsContent>
          </Tabs>
        </SheetBody>

        {activeTab !== "upload" && (
          <SheetFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            {activeTab === "url" && (
              <Button onClick={handleUrlInsert} disabled={!imageUrl.trim()}>
                Insert URL
              </Button>
            )}
          </SheetFooter>
        )}
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
