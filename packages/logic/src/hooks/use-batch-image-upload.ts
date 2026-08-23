"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAction } from "convex/react";
import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import { useImageCompression } from "../hooks/use-image-compression";
import { useUploadLimit } from "../hooks/use-upload-limit";
import { useWatermarkRemoval } from "../hooks/use-watermark-removal";
import {
  addBatchImages,
  BATCH_UPLOAD_CONCURRENCY,
  type BatchImageItem,
  type BatchSelectionIssue,
  batchImageReducer,
  getUploadErrorMessage,
  runUploadPool,
} from "../lib/batch-image-upload";
import {
  type CompressionSettings,
  describeSavings,
} from "../lib/image-compression/index";
import { formatMb } from "../lib/upload-limits";
import type { MediaProvider } from "../types/media";

export type BatchUploadSuccess = {
  id: string;
  filename: string;
  altText: string;
  url: string;
  savings: string;
};

export type BatchUploadRunResult = {
  successful: BatchUploadSuccess[];
  failed: number;
  stopped: boolean;
};

type UploadAttempt =
  | { kind: "success"; value: BatchUploadSuccess }
  | { kind: "error" };

export function useBatchImageUpload({
  projectId,
  documentId,
  compressionOverride,
}: {
  projectId: Id<"projects">;
  documentId?: Id<"documents">;
  compressionOverride?: CompressionSettings | null;
}) {
  const [items, dispatch] = useReducer(batchImageReducer, []);
  const [isRunning, setIsRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);

  const uploadMedia = useAction(api.media.uploads.upload);
  const { compress, resolvedSettings } = useImageCompression(projectId);
  const { removeWatermark } = useWatermarkRemoval(projectId);
  const { maxBytes, formatted: maxUploadLabel } = useUploadLimit(projectId);

  const addFiles = useCallback(
    (files: Iterable<File>): BatchSelectionIssue[] => {
      const result = addBatchImages(items, files);
      dispatch({ kind: "replace", items: result.items });
      return result.issues;
    },
    [items],
  );

  const remove = useCallback((id: string) => {
    dispatch({ kind: "remove", id });
  }, []);

  const setAltText = useCallback((id: string, altText: string) => {
    dispatch({ kind: "set-alt", id, altText });
  }, []);

  const clear = useCallback(() => {
    dispatch({ kind: "clear" });
  }, []);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    setStopRequested(true);
  }, []);

  const processItem = useCallback(
    async (
      item: BatchImageItem,
      provider: MediaProvider,
    ): Promise<UploadAttempt> => {
      try {
        dispatch({
          kind: "set-status",
          id: item.id,
          status: { kind: "processing", stage: "compressing" },
        });
        const compressed = await compress(
          item.file,
          compressionOverride ?? undefined,
        );
        let file = compressed.file;
        let savings = describeSavings(compressed);

        dispatch({
          kind: "set-status",
          id: item.id,
          status: { kind: "processing", stage: "watermark" },
        });
        const cleaned = await removeWatermark(file);
        if (cleaned.wasApplied) {
          file = cleaned.file;
          savings = savings
            ? `${savings} · Gemini watermark removed`
            : "Gemini watermark removed";
        }

        if (file.size > maxBytes) {
          throw new Error(
            `${formatMb(file.size)} exceeds the ${maxUploadLabel} limit after compression.`,
          );
        }

        dispatch({
          kind: "set-status",
          id: item.id,
          status: { kind: "processing", stage: "uploading" },
        });
        const result = await uploadMedia({
          projectId,
          provider,
          bytes: await file.arrayBuffer(),
          mime: file.type,
          filename: file.name,
          ...(documentId === undefined ? {} : { documentId }),
        });

        dispatch({
          kind: "set-status",
          id: item.id,
          status: { kind: "success", url: result.url, savings },
        });
        return {
          kind: "success",
          value: {
            id: item.id,
            filename: file.name,
            altText: item.altText,
            url: result.url,
            savings,
          },
        };
      } catch (error) {
        dispatch({
          kind: "set-status",
          id: item.id,
          status: {
            kind: "error",
            message: getUploadErrorMessage(error),
          },
        });
        return { kind: "error" };
      }
    },
    [
      compress,
      compressionOverride,
      documentId,
      maxBytes,
      maxUploadLabel,
      projectId,
      removeWatermark,
      uploadMedia,
    ],
  );

  const run = useCallback(
    async (
      provider: MediaProvider,
      candidates: BatchImageItem[],
    ): Promise<BatchUploadRunResult> => {
      if (candidates.length === 0) {
        return { successful: [], failed: 0, stopped: false };
      }

      stopRequestedRef.current = false;
      setStopRequested(false);
      setIsRunning(true);
      try {
        const attempts = await runUploadPool({
          items: candidates,
          worker: (item) => processItem(item, provider),
          concurrency: BATCH_UPLOAD_CONCURRENCY,
          shouldContinue: () => !stopRequestedRef.current,
        });
        return {
          successful: attempts.flatMap((attempt) =>
            attempt.kind === "success" ? [attempt.value] : [],
          ),
          failed: attempts.filter((attempt) => attempt.kind === "error").length,
          stopped: stopRequestedRef.current,
        };
      } finally {
        setIsRunning(false);
      }
    },
    [processItem],
  );

  const uploadQueued = useCallback(
    (provider: MediaProvider) =>
      run(
        provider,
        items.filter((item) => item.status.kind === "queued"),
      ),
    [items, run],
  );

  const retryFailed = useCallback(
    (provider: MediaProvider) => {
      const failed = items.filter((item) => item.status.kind === "error");
      dispatch({ kind: "queue-failed" });
      return run(provider, failed);
    },
    [items, run],
  );

  const summary = useMemo(() => {
    let queued = 0;
    let processing = 0;
    let successful = 0;
    let failed = 0;
    for (const item of items) {
      switch (item.status.kind) {
        case "queued":
          queued += 1;
          break;
        case "processing":
          processing += 1;
          break;
        case "success":
          successful += 1;
          break;
        case "error":
          failed += 1;
          break;
        default: {
          const exhaustive: never = item.status;
          void exhaustive;
        }
      }
    }
    return { queued, processing, successful, failed, total: items.length };
  }, [items]);

  return {
    items,
    summary,
    addFiles,
    remove,
    setAltText,
    clear,
    uploadQueued,
    retryFailed,
    stop,
    isRunning,
    stopRequested,
    resolvedSettings,
    maxUploadLabel,
  };
}
