"use client";

import { api } from "@wryte/backend/_generated/api";
import { useImageCompression } from "@wryte/logic/hooks/use-image-compression";
import { useUploadLimit } from "@wryte/logic/hooks/use-upload-limit";
import { useWatermarkRemoval } from "@wryte/logic/hooks/use-watermark-removal";
import type { EditorTarget } from "@wryte/logic/lib/editor/target";
import { describeSavings } from "@wryte/logic/lib/image-compression/index";
import { useAction } from "convex/react";
import { useCallback } from "react";

export type MediaUploadOutcome =
  | { kind: "uploaded"; url: string; savings: string }
  | { kind: "too-large"; size: number };

const WATERMARK_REMOVED = "Gemini watermark removed";

export function useMediaUpload(target: EditorTarget) {
  const projectId = target.kind === "document" ? target.projectId : undefined;
  const uploadToProject = useAction(api.media.uploads.upload);
  const uploadToNote = useAction(api.media.uploads.uploadToNote);
  const { compress } = useImageCompression(projectId);
  const { removeWatermark } = useWatermarkRemoval(projectId);
  const { maxBytes, formatted } = useUploadLimit(projectId);

  const upload = useCallback(
    async (file: File): Promise<MediaUploadOutcome> => {
      let prepared = file;
      let savings = "";
      if (file.type.startsWith("image/")) {
        const compressed = await compress(file);
        prepared = compressed.file;
        savings = describeSavings(compressed);
        const cleaned = await removeWatermark(prepared);
        if (cleaned.wasApplied) {
          prepared = cleaned.file;
          savings = savings
            ? `${savings} · ${WATERMARK_REMOVED}`
            : WATERMARK_REMOVED;
        }
      }
      if (prepared.size > maxBytes) {
        return { kind: "too-large", size: prepared.size };
      }

      const payload = {
        bytes: await prepared.arrayBuffer(),
        mime: prepared.type,
        filename: prepared.name,
      };
      const result =
        target.kind === "document"
          ? await uploadToProject({
              ...payload,
              projectId: target.projectId,
              documentId: target.documentId,
            })
          : await uploadToNote({ ...payload, noteId: target.noteId });
      return { kind: "uploaded", url: result.url, savings };
    },
    [
      compress,
      maxBytes,
      removeWatermark,
      target,
      uploadToNote,
      uploadToProject,
    ],
  );

  return { upload, maxUploadLabel: formatted };
}
