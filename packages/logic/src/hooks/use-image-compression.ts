"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type CompressionResult,
  type CompressionSettings,
  compressImageFile,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@wryte/logic/lib/image-compression/index";
import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";

type UseImageCompressionResult = {
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
};

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

  // Convex reactive queries return fresh object identities on every
  // snapshot even when the underlying fields are unchanged, which makes the
  // naive `[user?.defaultCompressionSettings, project?.compressionSettings]`
  // dep array churn on every server tick — downstream callbacks and effects
  // see a new `resolvedSettings` ref each time. Key the memo off a
  // serialized snapshot so it only changes when the values actually change.
  const userKey = JSON.stringify(user?.defaultCompressionSettings ?? null);
  const projectKey = JSON.stringify(project?.compressionSettings ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: derived from the JSON keys
  const resolvedSettings = useMemo<CompressionSettings>(
    () => ({
      ...DEFAULT_COMPRESSION_SETTINGS,
      ...(user?.defaultCompressionSettings ?? {}),
      ...(project?.compressionSettings ?? {}),
    }),
    [userKey, projectKey],
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
