"use client";

import { useAction } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useImageCompression } from "@/hooks/use-image-compression";
import { useUploadLimit } from "@/hooks/use-upload-limit";
import { describeSavings } from "@/lib/image-compression";
import { formatMb } from "@/lib/upload-limits";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEditorContext } from "../components/editor-context";
import { videoEmbedMarkup } from "../lib/video";

const URL_RE = /^https?:\/\/\S+$/i;

function isUploadableMedia(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function hasFiles(transfer: DataTransfer | null): boolean {
  return Boolean(transfer && Array.from(transfer.types).includes("Files"));
}

/**
 * Clipboard & drag-drop niceties for the markdown textarea:
 *
 * - Pasting or dropping an image/video uploads it through the project's
 *   configured media provider (same pipeline as the insert dialogs) and
 *   inserts the markdown/`<video>` markup at the cursor. While the upload
 *   runs, a unique placeholder holds the spot; it resolves to the final
 *   markup or is removed on failure.
 * - Pasting a URL while text is selected wraps the selection as
 *   `[selection](url)` instead of replacing it.
 *
 * Images go through the project's compression settings; videos upload
 * as-is. Both respect the project upload limit.
 */
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
  const { maxBytes: maxUploadBytes, formatted: maxUploadLabel } =
    useUploadLimit(projectId as Id<"projects">);

  // Latest-value refs so the (once-per-textarea) event listeners never go
  // stale — same pattern as use-keyboard-shortcuts.
  const ctxRef = useRef({
    compress,
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

    /**
     * The placeholder may have moved (or been deleted) by the time the
     * upload settles, so it's located by content search rather than by the
     * insertion offset. The token in the URL slot makes it unique.
     */
    function settlePlaceholder(placeholder: string, markup: string | null) {
      const content = useEditorStore.getState().content;
      const index = content.indexOf(placeholder);
      if (index === -1) {
        // User deleted the placeholder mid-upload. Drop failed uploads
        // silently; insert successful ones at the caret so work isn't lost.
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
      insertAtCaret(placeholder);

      try {
        let toUpload = file;
        let savings = "";
        if (isImage) {
          const compressed = await ctx.compress(file);
          toUpload = compressed.file;
          savings = describeSavings(compressed);
        }

        if (toUpload.size > ctx.maxUploadBytes) {
          settlePlaceholder(placeholder, null);
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
        settlePlaceholder(placeholder, markup);
        toast.success(`Uploaded ${file.name}`, {
          description: savings || undefined,
        });
      } catch (err) {
        settlePlaceholder(placeholder, null);
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
        for (const file of mediaFiles) void uploadFile(file);
        return;
      }

      // URL over a selection → markdown link around the selected text.
      const text = event.clipboardData?.getData("text/plain").trim() ?? "";
      if (!URL_RE.test(text) || !textarea) return;
      const { selectionStart, selectionEnd, value } = textarea;
      if (selectionStart === selectionEnd) return;
      const selected = value.slice(selectionStart, selectionEnd);
      // Pasting a URL over a URL should replace it, not nest a link.
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

    // Only claim drag events that carry files — text drag-and-drop inside
    // the textarea keeps its native behavior.
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
      for (const file of mediaFiles) void uploadFile(file);
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
