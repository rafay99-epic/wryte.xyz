"use client";

import { useAction, useQuery } from "convex/react";
import { Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const uploadMediaAction = (api as any).github.uploadMediaToGithub;

interface ImageInsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markdown: string) => void;
  projectId: string;
}

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
  const uploadMedia = useAction(uploadMediaAction);

  const isGithubStorage = project?.mediaStorageMode === "github";

  function handleUrlInsert() {
    if (!imageUrl) return;
    const alt = altText || "image";
    onInsert(`![${alt}](${imageUrl})`);
    resetForm();
    onOpenChange(false);
  }

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URL prefix to get raw base64
            const base64Data = result.split(",")[1];
            if (base64Data) {
              resolve(base64Data);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        const url = await uploadMedia({
          projectId: projectId as Id<"projects">,
          fileName: file.name,
          base64Content: base64,
          contentType: file.type,
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
    [altText, onInsert, onOpenChange, projectId, uploadMedia],
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

  function resetForm() {
    setImageUrl("");
    setAltText("");
    setUploadError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Image</DialogTitle>
          <DialogDescription>
            Add an image from a URL or upload one.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList>
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <div className="space-y-3">
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

              <DialogFooter>
                <Button onClick={handleUrlInsert} disabled={!imageUrl}>
                  Insert
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <div className="space-y-3">
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

              <DialogFooter>
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
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
