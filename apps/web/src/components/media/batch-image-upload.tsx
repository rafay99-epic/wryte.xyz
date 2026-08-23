"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type BatchUploadSuccess,
  useBatchImageUpload,
} from "@wryte/logic/hooks/use-batch-image-upload";
import {
  type BatchImageItem,
  type BatchSelectionIssue,
  MAX_BATCH_IMAGES,
} from "@wryte/logic/lib/batch-image-upload";
import type { CompressionSettings } from "@wryte/logic/lib/image-compression/index";
import { cn } from "@wryte/logic/lib/utils";
import {
  isMediaProvider,
  MEDIA_PROVIDER_LABELS,
  type MediaProvider,
} from "@wryte/logic/types/media";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import { MediaProviderIcon } from "@wryte/ui/media-provider-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wryte/ui/select";
import { Check, Circle, OctagonX, RotateCcw, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CompressionOverrideDisclosure } from "@/components/forms/compression-override-disclosure";

export type InitialImageBatch = {
  id: number;
  files: File[];
};

export function BatchImageUpload({
  projectId,
  documentId,
  providers,
  initialFiles,
  editAltText = false,
  layout = "default",
  onCancel,
  onComplete,
  onRunningChange,
}: {
  projectId: Id<"projects">;
  documentId?: Id<"documents">;
  providers: MediaProvider[];
  initialFiles?: InitialImageBatch | null;
  editAltText?: boolean;
  layout?: "default" | "tray";
  onCancel: () => void;
  onComplete: (files: BatchUploadSuccess[]) => void;
  onRunningChange?: (running: boolean) => void;
}) {
  const [selectedProvider, setSelectedProvider] =
    useState<MediaProvider | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [compressionOverride, setCompressionOverride] =
    useState<CompressionSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastInitialBatchRef = useRef<number | null>(null);
  const successfulRef = useRef(new Map<string, BatchUploadSuccess>());

  const upload = useBatchImageUpload({
    projectId,
    ...(documentId === undefined ? {} : { documentId }),
    compressionOverride,
  });
  const enqueueFiles = upload.addFiles;
  const provider =
    providers.length === 1
      ? (providers[0] ?? null)
      : selectedProvider && providers.includes(selectedProvider)
        ? selectedProvider
        : null;

  function addFiles(files: Iterable<File>) {
    const issues = enqueueFiles(files);
    setSelectionError(describeSelectionIssues(issues));
  }

  useEffect(() => {
    if (!initialFiles || lastInitialBatchRef.current === initialFiles.id)
      return;
    lastInitialBatchRef.current = initialFiles.id;
    const issues = enqueueFiles(initialFiles.files);
    setSelectionError(describeSelectionIssues(issues));
  }, [enqueueFiles, initialFiles]);

  async function finishRun(
    run: () => Promise<{
      successful: BatchUploadSuccess[];
      failed: number;
      stopped: boolean;
    }>,
  ) {
    onRunningChange?.(true);
    const result = await run().finally(() => onRunningChange?.(false));
    for (const file of result.successful) {
      successfulRef.current.set(file.id, file);
    }

    if (result.failed > 0) {
      toast.error(
        `${result.failed} image${result.failed === 1 ? "" : "s"} failed`,
        {
          description: "Successful uploads are safe. Retry only failed files.",
        },
      );
      return;
    }
    if (result.stopped) return;

    if (successfulRef.current.size === upload.summary.total) {
      const ordered = upload.items.flatMap((item) => {
        const completed = successfulRef.current.get(item.id);
        return completed ? [completed] : [];
      });
      onComplete(ordered);
    }
  }

  function handleUploadQueued() {
    if (!provider) {
      setSelectionError("Choose an upload destination first.");
      return;
    }
    setSelectionError(null);
    void finishRun(() => upload.uploadQueued(provider));
  }

  function handleRetryFailed() {
    if (!provider) {
      setSelectionError("Choose an upload destination first.");
      return;
    }
    setSelectionError(null);
    void finishRun(() => upload.retryFailed(provider));
  }

  const completed = upload.summary.successful + upload.summary.failed;
  const progress =
    upload.summary.total === 0
      ? 0
      : Math.round((completed / upload.summary.total) * 100);
  const isTray = layout === "tray";

  return (
    <div
      className={cn(
        "space-y-3",
        isTray && "flex min-h-0 flex-1 flex-col gap-3 space-y-0 px-6 py-5",
      )}
    >
      {providers.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="batch-upload-destination">Upload destination</Label>
          <Select
            value={provider}
            onValueChange={(value) => {
              if (typeof value === "string" && isMediaProvider(value)) {
                setSelectedProvider(value);
                setSelectionError(null);
              }
            }}
          >
            <SelectTrigger id="batch-upload-destination" className="w-full">
              <SelectValue>
                {provider ? (
                  <>
                    <MediaProviderIcon provider={provider} />
                    {MEDIA_PROVIDER_LABELS[provider]}
                  </>
                ) : (
                  "Choose where to upload"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {providers.map((option) => (
                <SelectItem key={option} value={option}>
                  <MediaProviderIcon provider={option} />
                  {MEDIA_PROVIDER_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!provider && (
            <p className="text-xs text-muted-foreground">
              This project has several providers. Pick one for this batch.
            </p>
          )}
        </div>
      ) : providers[0] ? (
        <div className="flex items-center gap-2 border px-3 py-2 text-sm">
          <MediaProviderIcon provider={providers[0]} className="size-4" />
          <span>{MEDIA_PROVIDER_LABELS[providers[0]]}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            Upload destination
          </span>
        </div>
      ) : (
        <p className="border border-destructive/40 p-3 text-sm text-destructive">
          Connect a media provider before uploading.
        </p>
      )}

      <button
        type="button"
        className={cn(
          "flex min-h-24 w-full flex-col items-center justify-center border border-dashed px-4 py-5 text-center transition-colors",
          isTray && "min-h-20 py-4",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/35 hover:border-muted-foreground/60",
          upload.isRunning && "pointer-events-none opacity-60",
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          const related = event.relatedTarget;
          if (
            !(related instanceof Node) ||
            !event.currentTarget.contains(related)
          ) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
        disabled={upload.isRunning || upload.summary.total >= MAX_BATCH_IMAGES}
      >
        <Upload className="mb-2 size-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          {upload.summary.total >= MAX_BATCH_IMAGES
            ? "Batch limit reached"
            : "Drop images here or click to browse"}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          {upload.summary.total} of {MAX_BATCH_IMAGES} selected · up to{" "}
          {upload.maxUploadLabel} each
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Choose images to upload"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {selectionError && (
        <p className="text-sm text-destructive" role="alert">
          {selectionError}
        </p>
      )}

      {upload.summary.total > 0 && (
        <div className={cn("border", isTray && "flex min-h-0 flex-1 flex-col")}>
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
            <div>
              <p className="text-sm font-medium">
                {upload.isRunning
                  ? `${upload.summary.successful} of ${upload.summary.total} uploaded`
                  : `${upload.summary.total} image${upload.summary.total === 1 ? "" : "s"}`}
              </p>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {describeSummary(upload.summary)}
              </p>
            </div>
            {!upload.isRunning && upload.summary.successful === 0 && (
              <Button variant="ghost" size="xs" onClick={upload.clear}>
                Clear
              </Button>
            )}
          </div>

          <div
            className="h-1 bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Batch upload progress"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            className={cn(
              "max-h-72 overflow-y-auto",
              isTray && "max-h-none min-h-0 flex-1",
            )}
          >
            {upload.items.map((item) => (
              <UploadRow
                key={item.id}
                item={item}
                editAltText={editAltText}
                disabled={upload.isRunning}
                onRemove={() => upload.remove(item.id)}
                onAltTextChange={(value) => upload.setAltText(item.id, value)}
              />
            ))}
          </div>
        </div>
      )}

      {upload.summary.total > 0 && upload.summary.successful === 0 && (
        <CompressionOverrideDisclosure
          resolvedSettings={upload.resolvedSettings}
          override={compressionOverride}
          onOverrideChange={setCompressionOverride}
        />
      )}

      <div
        className={cn(
          "flex flex-wrap justify-end gap-2 pt-1",
          isTray && "mt-auto border-t border-border/40 pt-4",
        )}
      >
        {upload.isRunning ? (
          <Button
            variant="outline"
            onClick={upload.stop}
            disabled={upload.stopRequested}
          >
            {upload.stopRequested
              ? "Stopping after current"
              : "Stop after current"}
          </Button>
        ) : (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}

        {!upload.isRunning && upload.summary.failed > 0 && (
          <Button variant="outline" onClick={handleRetryFailed}>
            <RotateCcw className="size-4" />
            Retry {upload.summary.failed} failed
          </Button>
        )}

        {!upload.isRunning && upload.summary.queued > 0 && (
          <Button
            onClick={handleUploadQueued}
            disabled={!provider || providers.length === 0}
          >
            <Upload className="size-4" />
            Upload {upload.summary.queued} to{" "}
            {provider ? MEDIA_PROVIDER_LABELS[provider] : "provider"}
          </Button>
        )}
      </div>
    </div>
  );
}

function UploadRow({
  item,
  editAltText,
  disabled,
  onRemove,
  onAltTextChange,
}: {
  item: BatchImageItem;
  editAltText: boolean;
  disabled: boolean;
  onRemove: () => void;
  onAltTextChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-3 border-b px-3 py-2.5 last:border-b-0">
      <ImagePreview file={item.file} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(item.file.size)} · {statusLabel(item)}
        </p>
        {item.status.kind === "error" && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {item.status.message}
          </p>
        )}
        {editAltText && item.status.kind !== "success" && (
          <Input
            value={item.altText}
            onChange={(event) => onAltTextChange(event.target.value)}
            placeholder="Alt text"
            aria-label={`Alt text for ${item.file.name}`}
            className="mt-2 h-7 text-xs"
            disabled={disabled}
          />
        )}
      </div>
      <div className="flex items-start gap-1">
        <StatusIcon item={item} />
        {!disabled &&
          (item.status.kind === "queued" || item.status.kind === "error") && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label={`Remove ${item.file.name}`}
            >
              <X className="size-3.5" />
            </Button>
          )}
      </div>
    </div>
  );
}

function ImagePreview({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex size-10 items-center justify-center overflow-hidden border bg-muted/40">
      {/* Blob URLs are local previews and cannot use Next Image. */}
      <img ref={imageRef} alt="" className="size-full object-cover" />
    </div>
  );
}

function StatusIcon({ item }: { item: BatchImageItem }) {
  switch (item.status.kind) {
    case "queued":
      return <Circle className="mt-1 size-4 text-muted-foreground" />;
    case "processing":
      return <Circle className="mt-1 size-4 fill-primary text-primary" />;
    case "success":
      return <Check className="mt-1 size-4 text-emerald-500" />;
    case "error":
      return <OctagonX className="mt-1 size-4 text-destructive" />;
    default: {
      const exhaustive: never = item.status;
      return exhaustive;
    }
  }
}

function statusLabel(item: BatchImageItem): string {
  switch (item.status.kind) {
    case "queued":
      return "Queued";
    case "processing":
      switch (item.status.stage) {
        case "compressing":
          return "Compressing";
        case "watermark":
          return "Checking watermark";
        case "uploading":
          return "Uploading";
        default: {
          const exhaustive: never = item.status.stage;
          return exhaustive;
        }
      }
    case "success":
      return item.status.savings
        ? `Uploaded · ${item.status.savings}`
        : "Uploaded";
    case "error":
      return "Failed";
    default: {
      const exhaustive: never = item.status;
      return exhaustive;
    }
  }
}

function describeSelectionIssues(issues: BatchSelectionIssue[]): string | null {
  if (issues.length === 0) return null;
  const unsupported = issues.filter((issue) => issue.kind === "unsupported");
  const duplicate = issues.filter((issue) => issue.kind === "duplicate");
  const limited = issues.filter((issue) => issue.kind === "limit");
  const messages: string[] = [];
  if (unsupported.length > 0) {
    messages.push(
      `${unsupported.length} unsupported file${unsupported.length === 1 ? " was" : "s were"} skipped`,
    );
  }
  if (duplicate.length > 0) {
    messages.push(
      `${duplicate.length} duplicate${duplicate.length === 1 ? " was" : "s were"} skipped`,
    );
  }
  if (limited.length > 0) {
    messages.push(`Only ${MAX_BATCH_IMAGES} images can be uploaded at once`);
  }
  return `${messages.join(". ")}.`;
}

function describeSummary(summary: {
  queued: number;
  processing: number;
  successful: number;
  failed: number;
}): string {
  const parts: string[] = [];
  if (summary.processing > 0) parts.push(`${summary.processing} active`);
  if (summary.queued > 0) parts.push(`${summary.queued} queued`);
  if (summary.successful > 0) parts.push(`${summary.successful} uploaded`);
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  return parts.join(" · ");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
