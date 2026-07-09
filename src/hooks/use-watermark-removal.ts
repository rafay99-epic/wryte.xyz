"use client";

import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { removeWatermark, type WatermarkResult } from "@/lib/watermark-removal";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type UseWatermarkRemovalResult = {
  /**
   * Remove the Gemini watermark from an image file. Skips processing
   * when the project setting is disabled. Returns the original file
   * unchanged when no watermark is detected.
   */
  removeWatermark: (file: File) => Promise<WatermarkResult>;
  /** True while the watermark detection/removal is running. */
  isRemoving: boolean;
  /** Whether watermark removal is enabled for this project. */
  enabled: boolean;
};

/**
 * Resolves the per-project `autoWatermarkRemoval` setting (default: enabled)
 * and exposes a `removeWatermark` convenience that short-circuits when the
 * feature is disabled.
 */
export function useWatermarkRemoval(
  projectId: Id<"projects">,
): UseWatermarkRemovalResult {
  const project = useQuery(api.cms.projects.get, { projectId });
  const [isRemoving, setIsRemoving] = useState(false);

  const enabled = project?.autoWatermarkRemoval ?? true;

  const remove = useCallback(
    async (file: File): Promise<WatermarkResult> => {
      if (!enabled) return { file, wasApplied: false };
      setIsRemoving(true);
      try {
        return await removeWatermark(file);
      } finally {
        setIsRemoving(false);
      }
    },
    [enabled],
  );

  return { removeWatermark: remove, isRemoving, enabled };
}
