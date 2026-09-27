"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useImageCompression } from "@wryte/logic/hooks/use-image-compression";
import { useUploadLimit } from "@wryte/logic/hooks/use-upload-limit";
import { useWatermarkRemoval } from "@wryte/logic/hooks/use-watermark-removal";
import {
  BATCH_UPLOAD_CONCURRENCY,
  MAX_BATCH_IMAGES,
  runUploadPool,
} from "@wryte/logic/lib/batch-image-upload";
import { videoEmbedMarkup } from "@wryte/logic/lib/editor/video";
import { describeSavings } from "@wryte/logic/lib/image-compression/index";
import { formatMb } from "@wryte/logic/lib/upload-limits";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useAction } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEditorContext } from "../components/editor-context";

const URL_RE = /^https?:\/\/\S+$/i;

function isUploadableMedia(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function hasFiles(transfer: DataTransfer | null): boolean {
  return Boolean(transfer && Array.from(transfer.types).includes("Files"));
}

export function useMediaPaste({
  documentId,
  projectId,
}: {
  documentId: string;
  projectId: string;
}) {
  const { textareaRef, replaceRange } = useEditorContext();
  const uploadMedia = useAction(api.media.uploads.upload);
  const { compress } = useImageCompression(projectId as Id<"projects">);
  const { removeWatermark } = useWatermarkRemoval(projectId as Id<"projects">);
  const { maxBytes: maxUploadBytes, formatted: maxUploadLabel } =
    useUploadLimit(projectId as Id<"projects">);

  const ctxRef = useRef({
    compress,
    removeWatermark,
    maxUploadBytes,
    maxUploadLabel,
    uploadMedia,
    replaceRange,
    documentId,
    projectId,
  });
  useEffect(() => {
    ctxRef.current = {
      compress,
      removeWatermark,
      maxUploadBytes,
      maxUploadLabel,
      uploadMedia,
      replaceRange,
      documentId,
      projectId,
    };
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    function insertAtCaret(text: string) {
      if (!textarea) return;
      const { selectionStart, selectionEnd } = textarea;
      textarea.focus();
      textarea.setRangeText(text, selectionStart, selectionEnd, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function currentTarget() {
      return (
        useEditorStore.getState().activeDraftId ?? ctxRef.current.documentId
      );
    }

    function settlePlaceholder(
      placeholder: string,
      markup: string | null,
      target: string,
    ) {
      if (currentTarget() !== target) return;
      const content = useEditorStore.getState().content;
      const index = content.indexOf(placeholder);
      if (index === -1) {
        if (markup) insertAtCaret(markup);
        return;
      }
      ctxRef.current.replaceRange(
        index,
        index + placeholder.length,
        markup ?? "",
      );
    }

    async function uploadFile(file: File) {
      const ctx = ctxRef.current;
      const isImage = file.type.startsWith("image/");
      const token = Math.random().toString(36).slice(2, 9);
      const placeholder = `![Uploading ${file.name}…](uploading-${token})`;
      const target = currentTarget();
      insertAtCaret(placeholder);

      try {
        let toUpload = file;
        let savings = "";
        if (isImage) {
          const compressed = await ctx.compress(file);
          toUpload = compressed.file;
          savings = describeSavings(compressed);

          const cleaned = await ctx.removeWatermark(toUpload);
          if (cleaned.wasApplied) {
            savings = savings
              ? `${savings} · Gemini watermark removed`
              : "Gemini watermark removed";
            toUpload = cleaned.file;
          }
        }

        if (toUpload.size > ctx.maxUploadBytes) {
          settlePlaceholder(placeholder, null, target);
          toast.error(`File is ${formatMb(toUpload.size)}`, {
            description: `Exceeds the ${ctx.maxUploadLabel} limit. Host it externally and embed it by URL, or raise the limit in project settings.`,
          });
          return;
        }

        const bytes = await toUpload.arrayBuffer();
        const result = await ctx.uploadMedia({
          projectId: ctx.projectId as Id<"projects">,
          bytes,
          mime: toUpload.type,
          filename: toUpload.name,
          documentId: ctx.documentId as Id<"documents">,
        });

        const alt = file.name.replace(/\.[^.]+$/, "");
        const markup = isImage
          ? `![${alt}](${result.url})`
          : videoEmbedMarkup(result.url, alt);
        settlePlaceholder(placeholder, markup, target);
        toast.success(`Uploaded ${file.name}`, {
          description: savings || undefined,
        });
      } catch (err) {
        settlePlaceholder(placeholder, null, target);
        const data = (err as { data?: { message?: string } })?.data;
        toast.error("Upload failed", {
          description:
            data?.message ?? (err instanceof Error ? err.message : undefined),
        });
      }
    }

    function handlePaste(event: ClipboardEvent) {
      const mediaFiles = Array.from(event.clipboardData?.files ?? []).filter(
        isUploadableMedia,
      );
      if (mediaFiles.length > 0) {
        event.preventDefault();
        const batch = mediaFiles.slice(0, MAX_BATCH_IMAGES);
        if (mediaFiles.length > MAX_BATCH_IMAGES) {
          toast.error(`Only ${MAX_BATCH_IMAGES} files can upload at once`);
        }
        void runUploadPool({
          items: batch,
          worker: uploadFile,
          concurrency: BATCH_UPLOAD_CONCURRENCY,
        });
        return;
      }

      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (!URL_RE.test(text) || !textarea) return;
      const { selectionStart, selectionEnd, value } = textarea;
      if (selectionStart === selectionEnd) return;
      const selected = value.slice(selectionStart, selectionEnd);
      if (URL_RE.test(selected.trim())) return;
      event.preventDefault();
      textarea.setRangeText(
        `[${selected}](${text})`,
        selectionStart,
        selectionEnd,
        "end",
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function handleDragOver(event: DragEvent) {
      if (hasFiles(event.dataTransfer)) event.preventDefault();
    }

    function handleDrop(event: DragEvent) {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      const mediaFiles = Array.from(event.dataTransfer?.files ?? []).filter(
        isUploadableMedia,
      );
      if (mediaFiles.length === 0) {
        toast.error("Only image and video files can be dropped here");
        return;
      }
      const batch = mediaFiles.slice(0, MAX_BATCH_IMAGES);
      if (mediaFiles.length > MAX_BATCH_IMAGES) {
        toast.error(`Only ${MAX_BATCH_IMAGES} files can upload at once`);
      }
      void runUploadPool({
        items: batch,
        worker: uploadFile,
        concurrency: BATCH_UPLOAD_CONCURRENCY,
      });
    }

    textarea.addEventListener("paste", handlePaste);
    textarea.addEventListener("dragover", handleDragOver);
    textarea.addEventListener("drop", handleDrop);
    return () => {
      textarea.removeEventListener("paste", handlePaste);
      textarea.removeEventListener("dragover", handleDragOver);
      textarea.removeEventListener("drop", handleDrop);
    };
  }, [textareaRef]);
}
