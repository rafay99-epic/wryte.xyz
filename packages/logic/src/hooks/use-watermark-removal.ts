"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  removeWatermark,
  type WatermarkResult,
} from "@wryte/logic/lib/watermark-removal/index";
import { useCallback, useState } from "react";

type UseWatermarkRemovalResult = {
  removeWatermark: (file: File) => Promise<WatermarkResult>;
  isRemoving: boolean;
  enabled: boolean;
};

export function useWatermarkRemoval(
  projectId: Id<"projects"> | undefined,
): UseWatermarkRemovalResult {
  const project = useAuthedQuery(
    api.cms.projects.get,
    projectId ? { projectId } : "skip",
  );
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
