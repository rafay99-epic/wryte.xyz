"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  type CompressionResult,
  type CompressionSettings,
  compressImageFile,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@wryte/logic/lib/image-compression/index";
import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";

type UseImageCompressionResult = {
  compress: (
    file: File,
    override?: Partial<CompressionSettings>,
  ) => Promise<CompressionResult>;
  isCompressing: boolean;
  resolvedSettings: CompressionSettings;
};

export function useImageCompression(
  projectId: Id<"projects"> | undefined,
): UseImageCompressionResult {
  const user = useQuery(api.account.users.get);
  const project = useAuthedQuery(
    api.cms.projects.get,
    projectId ? { projectId } : "skip",
  );
  const [isCompressing, setIsCompressing] = useState(false);

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
