import { useQuery } from "@tanstack/react-query";
import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { configKeys } from "@wryte/logic/lib/query-keys";
import { useAction } from "convex/react";

export function useConfigFileList(projectId: Id<"projects">, root: string) {
  const listFiles = useAction(api.integrations.githubConfig.listFiles);
  return useQuery({
    queryKey: configKeys.files(projectId, root),
    queryFn: () => listFiles(root === "" ? { projectId } : { projectId, root }),
    staleTime: 60 * 1000,
    retry: false,
  });
}
