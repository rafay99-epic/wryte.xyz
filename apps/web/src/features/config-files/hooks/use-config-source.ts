import { useQuery } from "@tanstack/react-query";
import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { configKeys } from "@wryte/logic/lib/query-keys";
import { useAction } from "convex/react";
import { useState } from "react";

export type ConfigSource = {
  remote: { content: string; sha: string };
  draft: { content: string; baseSha: string } | null;
};

export function useConfigSource(projectId: Id<"projects">, path: string) {
  const readFile = useAction(api.integrations.githubConfig.readFile);
  const draft = useAuthedQuery(api.cms.configFiles.getDraft, {
    projectId,
    path,
  });
  const remote = useQuery({
    queryKey: configKeys.file(projectId, path),
    queryFn: () => readFile({ projectId, path }),
    gcTime: 0,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [source, setSource] = useState<ConfigSource | null>(null);
  if (source === null && draft !== undefined && remote.data) {
    setSource({
      remote: remote.data,
      draft: draft && { content: draft.content, baseSha: draft.baseSha },
    });
  }

  return { source, error: remote.error };
}
