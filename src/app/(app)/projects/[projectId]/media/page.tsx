"use client";

import { useAction, useQuery } from "convex/react";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  ImageIcon,
  Loader2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export default function MediaPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const project = useQuery(api.projects.get, { projectId });

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; url: string }>
  >([]);

  const isGithubMode = project?.mediaStorageMode !== "external";

  if (project === undefined) {
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-7 w-24" />
        <Skeleton className="mb-2 h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage images and media files for your project.
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
          <Upload className="size-4" />
          Upload
        </Button>
      </div>

      {uploadedFiles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {uploadedFiles.map((file) => (
            <MediaCard key={file.url} name={file.name} url={file.url} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <ImageIcon className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-lg font-semibold">No media uploaded yet</h2>
          <p className="mb-2 max-w-sm text-center text-sm text-muted-foreground">
            Upload images to use in your documents. Files will be stored in your
            configured media directory.
          </p>
          <p className="mb-6 text-center text-xs text-muted-foreground italic">
            Media listing from GitHub is coming soon. Uploaded files in this
            session are shown below.
          </p>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="size-4" />
            Upload Media
          </Button>
        </div>
      )}

      {isGithubMode ? (
        <GitHubUploadDialog
          projectId={projectId}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploaded={(name, url) =>
            setUploadedFiles((prev) => [...prev, { name, url }])
          }
        />
      ) : (
        <ExternalUrlDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onAdded={(name, url) =>
            setUploadedFiles((prev) => [...prev, { name, url }])
          }
        />
      )}
    </div>
  );
}

function MediaCard({ name, url }: { name: string; url: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(
      () => toast.success("URL copied to clipboard"),
      () => toast.error("Failed to copy URL"),
    );
  }, [url]);

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex h-32 items-center justify-center rounded-md bg-muted">
          <ImageIcon className="size-8 text-muted-foreground/50" />
        </div>
        <p className="truncate text-sm font-medium">{name}</p>
        <div className="flex items-center gap-1">
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
            {url}
          </code>
          <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
            <Copy className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GitHubUploadDialog({
  projectId,
  open,
  onOpenChange,
  onUploaded,
}: {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (name: string, url: string) => void;
}) {
  const uploadMedia = useAction(api["github"]["uploadMediaToGithub"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleUpload = useCallback(async () => {
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

      const url = await uploadMedia({
        projectId,
        fileName: selectedFile.name,
        base64Content: base64,
        contentType: selectedFile.type,
      });

      toast.success("File uploaded to GitHub");
      onUploaded(selectedFile.name, url);
      onOpenChange(false);
      setSelectedFile(null);
      setAltText("");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, projectId, uploadMedia, onUploaded, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>
            Upload an image or file to your GitHub repository.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mb-2 size-8 text-muted-foreground" />
            {selectedFile ? (
              <p className="text-sm font-medium">{selectedFile.name}</p>
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
          <div className="space-y-2">
            <Label htmlFor="alt-text">Alt Text</Label>
            <Input
              id="alt-text"
              placeholder="Describe this image..."
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading && <Loader2 className="size-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExternalUrlDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (name: string, url: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!trimmedUrl) {
      toast.error("URL is required");
      return;
    }
    onAdded(trimmedName, trimmedUrl);
    onOpenChange(false);
    setName("");
    setUrl("");
    toast.success("External media reference added");
  }, [name, url, onAdded, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add External Media</DialogTitle>
          <DialogDescription>
            Add a reference to an externally hosted image.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ext-name">Name</Label>
            <Input
              id="ext-name"
              placeholder="hero-image.png"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="ext-url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              {url && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(url).then(
                      () => toast.success("URL copied"),
                      () => toast.error("Failed to copy"),
                    );
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAdd}>
            <ExternalLink className="size-4" />
            Add Reference
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
