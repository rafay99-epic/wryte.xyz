"use client";

import { useAction, useQuery } from "convex/react";
import { Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CompressionOverrideDisclosure } from "@/components/media/compression-override-disclosure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImageCompression } from "@/hooks/use-image-compression";
import {
  type CompressionSettings,
  describeSavings,
} from "@/lib/image-compression";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface ImageInsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markdown: string) => void;
  projectId: string;
}

/**
 * Drawer for inserting images into the markdown editor.
 * Offers two tabs:
 *  - URL tab:    Paste an external image URL and preview it before inserting `![alt](url)`.
 *  - Upload tab: Drag-and-drop or file-pick an image to upload to Convex storage (staged),
 *                then insert the serving URL as markdown.
 */
export function ImageInsertDialog({
  open,
  onOpenChange,
  onInsert,
  projectId,
}: ImageInsertDialogProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = useQuery(api.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const uploadMedia = useAction(api.media.upload);
  const { compress, isCompressing, resolvedSettings } = useImageCompression(
    projectId as Id<"projects">,
  );
  const [compressionOverride, setCompressionOverride] =
    useState<CompressionSettings | null>(null);

  // Reset override when the dialog closes so the next session inherits cleanly.
  useEffect(() => {
    if (!open) setCompressionOverride(null);
  }, [open]);

  // Every provider now accepts direct uploads — gating by storage mode is gone.
  const canUpload = Boolean(project);

  /** Build the markdown image syntax from the URL tab inputs and close the drawer. */
  function handleUrlInsert() {
    if (!imageUrl) return;
    const alt = altText || "image";
    onInsert(`![${alt}](${imageUrl})`);
    resetForm();
    onOpenChange(false);
  }

  /**
   * Upload an image file directly to the project's configured media provider
   * (GitHub repo, UploadThing, or Cloudinary). The Convex action runs the
   * full pipeline server-side: vault lookup → provider call → media record.
   */
  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const compressed = await compress(
          file,
          compressionOverride ?? undefined,
        );
        const toUpload = compressed.file;
        const bytes = await toUpload.arrayBuffer();
        const result = await uploadMedia({
          projectId: projectId as Id<"projects">,
          bytes,
          mime: toUpload.type,
          filename: toUpload.name,
        });

        const savings = describeSavings(compressed);
        if (savings) {
          toast.success(`Uploaded ${toUpload.name}`, { description: savings });
        }

        const alt = altText || toUpload.name;
        onInsert(`![${alt}](${result.url})`);
        setImageUrl("");
        setAltText("");
        setUploadError(null);
        onOpenChange(false);
      } catch (err) {
        // ConvexError carries our MediaErrorCode in `data.message`.
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
      altText,
      compress,
      compressionOverride,
      onInsert,
      onOpenChange,
      projectId,
      uploadMedia,
    ],
  );

  /** Handle drag-and-drop; only accepts image/* MIME types. */
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

  function resetForm() {
    setImageUrl("");
    setAltText("");
    setUploadError(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Insert Image</SheetTitle>
          <SheetDescription>
            Add an image from a URL or upload one.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <Tabs defaultValue="url">
            <TabsList>
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

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

                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleUrlInsert} disabled={!imageUrl || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              "Insert URL"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
