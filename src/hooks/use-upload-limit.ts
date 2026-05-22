"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  formatMb,
  resolveMaxUploadBytes,
} from "@/lib/upload-limits";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type UseUploadLimitResult = {
  /** Effective per-project max upload size in bytes (post-compression). */
  maxBytes: number;
  /** Pre-formatted "1.0 MB" string for use in UI labels and toasts. */
  formatted: string;
};

/**
 * Subscribes to the project's `maxUploadBytes` setting and exposes the
 * resolved limit. Shared by every image upload entry point so the value
 * stays consistent and updates in real time when changed in settings.
 */
export function useUploadLimit(
  projectId: Id<"projects"> | undefined,
): UseUploadLimitResult {
  const project = useQuery(
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
