"use client";

import { useMediaUpload } from "@wryte/logic/hooks/use-media-upload";
import {
  BATCH_UPLOAD_CONCURRENCY,
  MAX_BATCH_IMAGES,
  runUploadPool,
} from "@wryte/logic/lib/batch-image-upload";
import {
  type EditorTarget,
  editorTargetId,
} from "@wryte/logic/lib/editor/target";
import { videoEmbedMarkup } from "@wryte/logic/lib/editor/video";
import { formatMb } from "@wryte/logic/lib/upload-limits";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
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

export function useMediaPaste({ target }: { target: EditorTarget }) {
  const { textareaRef, replaceRange } = useEditorContext();
  const { upload, maxUploadLabel } = useMediaUpload(target);

  const ctxRef = useRef({ upload, maxUploadLabel, replaceRange, target });
  useEffect(() => {
    ctxRef.current = { upload, maxUploadLabel, replaceRange, target };
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
        useEditorStore.getState().activeDraftId ??
        editorTargetId(ctxRef.current.target)
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
        const outcome = await ctx.upload(file);
        if (outcome.kind === "too-large") {
          settlePlaceholder(placeholder, null, target);
          toast.error(`File is ${formatMb(outcome.size)}`, {
            description:
              ctx.target.kind === "document"
                ? `Exceeds the ${ctx.maxUploadLabel} limit. Host it externally and embed it by URL, or raise the limit in project settings.`
                : `Exceeds the ${ctx.maxUploadLabel} limit. Host it externally and embed it by URL.`,
          });
          return;
        }

        const alt = file.name.replace(/\.[^.]+$/, "");
        const markup = isImage
          ? `![${alt}](${outcome.url})`
          : videoEmbedMarkup(outcome.url, alt);
        settlePlaceholder(placeholder, markup, target);
        toast.success(`Uploaded ${file.name}`, {
          description: outcome.savings || undefined,
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
