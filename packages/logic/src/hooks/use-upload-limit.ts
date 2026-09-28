"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  formatMb,
  resolveMaxUploadBytes,
} from "@wryte/logic/lib/upload-limits";
import { useMemo } from "react";

type UseUploadLimitResult = {
  maxBytes: number;
  formatted: string;
};

export function useUploadLimit(
  projectId: Id<"projects"> | undefined,
): UseUploadLimitResult {
  const project = useAuthedQuery(
    api.cms.projects.get,
    projectId ? { projectId } : "skip",
  );

  return useMemo(() => {
    const maxBytes = projectId
      ? resolveMaxUploadBytes(project)
      : DEFAULT_MAX_UPLOAD_BYTES;
    return { maxBytes, formatted: formatMb(maxBytes) };
  }, [project, projectId]);
}
