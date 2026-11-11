"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { configFormatFromPath } from "@wryte/backend/_lib/configFiles";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { fileName, folderOf, relativeTo } from "@wryte/logic/lib/config/tree";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useConfigFileList } from "../hooks/use-config-file-list";
import { ConfigEditor } from "./config-editor";

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

  const files = list.data?.files;
  const edited = useMemo(
    () => new Set((drafts ?? []).map((draft) => draft.path)),
    [drafts],
  );
  const selected =
    files?.find((file) => file.path === requested) ?? files?.[0] ?? null;
  const format = selected ? configFormatFromPath(selected.path) : null;

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col border-b border-border md:max-h-none md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          <span
            className="min-w-0 flex-1 truncate font-mono text-xs"
            title={root}
          >
            {root}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Refresh file list"
            disabled={list.isFetching}
            onClick={() => void list.refetch()}
          >
            <RefreshCw />
          </Button>
          <Button variant="ghost" size="xs" onClick={onChangeFolder}>
            Change
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2 slim-scrollbar">
          {list.isPending ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
            </div>
          ) : list.error ? (
            <p className="p-1 text-xs text-destructive">
              {list.error.message || "Couldn't list files from GitHub."}
            </p>
          ) : files?.length === 0 ? (
            <p className="p-1 text-xs text-muted-foreground">
              No JSON, YAML or TOML files in this folder.
            </p>
          ) : (
            <ul>
              {files?.map((file) => {
                const folder = folderOf(relativeTo(root, file.path));
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      aria-current={selected?.path === file.path}
                      onClick={() =>
                        router.replace(
                          `${pathname}?file=${encodeURIComponent(file.path)}`,
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted",
                        selected?.path === file.path && "bg-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {folder !== "" && (
                          <span className="text-muted-foreground">
                            {`${folder}/`}
                          </span>
                        )}
                        {fileName(file.path)}
                      </span>
                      {edited.has(file.path) && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          edited
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <div className="min-h-0 min-w-0 flex-1">
        {selected && format && (
          <ConfigEditor
            key={selected.path}
            projectId={projectId}
            path={selected.path}
            format={format}
          />
        )}
      </div>
    </div>
  );
}
