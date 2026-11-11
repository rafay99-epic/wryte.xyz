"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { configFormatFromPath } from "@wryte/backend/_lib/configFiles";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { Skeleton } from "@wryte/ui/skeleton";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useConfigFileList } from "../hooks/use-config-file-list";
import { ConfigEditor, ConfigToolbar } from "./config-editor";
import { ConfigFileSwitcher } from "./config-file-switcher";

export function ConfigWorkspace({
  projectId,
  root,
  onChangeFolder,
}: {
  projectId: Id<"projects">;
  root: string;
  onChangeFolder: () => void;
}) {
  const list = useConfigFileList(projectId, root);
  const drafts = useAuthedQuery(api.cms.configFiles.listDrafts, { projectId });
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("file");

  const files = list.data?.files ?? [];
  const edited = useMemo(
    () => new Set((drafts ?? []).map((draft) => draft.path)),
    [drafts],
  );
  const selected =
    files.find((file) => file.path === requested) ?? files[0] ?? null;
  const format = selected ? configFormatFromPath(selected.path) : null;

  const switcher = (
    <ConfigFileSwitcher
      root={root}
      files={files}
      selectedPath={selected?.path ?? null}
      edited={edited}
      onSelect={(path) =>
        router.replace(`${pathname}?file=${encodeURIComponent(path)}`)
      }
      onRefresh={() => void list.refetch()}
      onChangeFolder={onChangeFolder}
    />
  );

  if (selected && format) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ConfigEditor
          key={selected.path}
          switcher={switcher}
          projectId={projectId}
          path={selected.path}
          format={format}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConfigToolbar switcher={switcher} />
      {list.isPending ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
      ) : list.error ? (
        <p className="p-4 text-sm text-destructive">
          {list.error.message || "Couldn't list files from GitHub."}
        </p>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          No JSON, YAML or TOML files in this folder.
        </p>
      )}
    </div>
  );
}
