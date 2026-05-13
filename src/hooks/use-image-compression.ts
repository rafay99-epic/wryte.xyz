"use client";

import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import {
  type CompressionResult,
  type CompressionSettings,
  compressImageFile,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@/lib/image-compression";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface UseImageCompressionResult {
  /**
   * Compress one File. `override` field-merges on top of the resolved
   * settings (per-upload override → project → user → built-in defaults).
   */
  compress: (
    file: File,
    override?: Partial<CompressionSettings>,
  ) => Promise<CompressionResult>;
  isCompressing: boolean;
  /** The settings the hook will use unless a per-call override is passed. */
  resolvedSettings: CompressionSettings;
}

/**
 * Resolves the active compression preferences for a project (per-project
 * override → user default → built-in defaults) and exposes a `compress`
 * function plus an `isCompressing` flag for UI affordances.
 *
 * Subscribes to `api.account.users.get` and `api.cms.projects.get`, so settings updates
 * propagate to upload dialogs in real time.
 */
export function useImageCompression(
  projectId: Id<"projects">,
): UseImageCompressionResult {
  const user = useQuery(api.account.users.get);
  const project = useQuery(api.cms.projects.get, { projectId });
  const [isCompressing, setIsCompressing] = useState(false);

  const resolvedSettings = useMemo<CompressionSettings>(
    () => ({
      ...DEFAULT_COMPRESSION_SETTINGS,
      ...(user?.defaultCompressionSettings ?? {}),
      ...(project?.compressionSettings ?? {}),
    }),
    [user?.defaultCompressionSettings, project?.compressionSettings],
  );

  const compress = useCallback(
    async (
      file: File,
      override?: Partial<CompressionSettings>,
    ): Promise<CompressionResult> => {
      const settings: CompressionSettings = {
        ...resolvedSettings,
        ...(override ?? {}),
      };
      setIsCompressing(true);
      try {
        return await compressImageFile(file, settings);
      } finally {
        setIsCompressing(false);
      }
    },
    [resolvedSettings],
  );

  return { compress, isCompressing, resolvedSettings };
}
