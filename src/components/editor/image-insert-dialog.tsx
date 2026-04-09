"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const mediaGenerateUploadUrl = (api as any).media.generateUploadUrl;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const mediaSaveMedia = (api as any).media.saveMedia;

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

  const project = useQuery(projectsGet, {
    projectId: projectId as Id<"projects">,
  });
  const generateUploadUrl = useMutation(mediaGenerateUploadUrl);
  const saveMedia = useMutation(mediaSaveMedia);

  const isGithubStorage = project?.mediaStorageMode === "github";

  /** Build the markdown image syntax from the URL tab inputs and close the drawer. */
  function handleUrlInsert() {
    if (!imageUrl) return;
    const alt = altText || "image";
    onInsert(`![${alt}](${imageUrl})`);
    resetForm();
    onOpenChange(false);
  }

  /**
   * Upload an image file to Convex storage (temporary staging).
   * Images are NOT pushed to GitHub until publish time, preventing
   * draft images from polluting the repo.
   */
  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        // Step 1: Get a short-lived upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Step 2: POST the file binary directly to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        const { storageId } = (await uploadResponse.json()) as {
          storageId: string;
        };

        // Step 3: Save the media record and get back a serving URL
        const { url } = await saveMedia({
          projectId: projectId as Id<"projects">,
          storageId: storageId as Id<"_storage">,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        });

        const alt = altText || file.name;
        onInsert(`![${alt}](${url})`);
        setImageUrl("");
        setAltText("");
        setUploadError(null);
        onOpenChange(false);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [altText, generateUploadUrl, onInsert, onOpenChange, projectId, saveMedia],
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

                {isGithubStorage ? (
                  <button
                    type="button"
                    className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-transparent p-8 text-center transition-colors hover:border-muted-foreground/50"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
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
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="img-external-url">External image URL</Label>
                    <Input
                      id="img-external-url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste URL from Cloudinary, etc."
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload your image to an external service and paste the URL
                      here.
                    </p>
                  </div>
                )}

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
          {isGithubStorage ? (
            <Button disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload & Insert"
              )}
            </Button>
          ) : (
            <Button onClick={handleUrlInsert} disabled={!imageUrl}>
              Insert
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
