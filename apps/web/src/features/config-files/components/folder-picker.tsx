"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  filesUnder,
  listConfigFolders,
  relativeTo,
} from "@wryte/logic/lib/config/tree";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { useMutation } from "convex/react";
import { Folder, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfigFileList } from "../hooks/use-config-file-list";

export function FolderPicker({
  projectId,
  current,
  onCancel,
  onPicked,
}: {
  projectId: Id<"projects">;
  current: string | null;
  onCancel: (() => void) | null;
  onPicked: () => void;
}) {
  const list = useConfigFileList(projectId, "");
  const setFolder = useMutation(api.cms.configFiles.setFolder);
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);

  const files = list.data?.files;
  const folders = useMemo(() => listConfigFolders(files ?? []), [files]);
  const preview = useMemo(
    () => (selected && files ? filesUnder(files, selected) : []),
    [files, selected],
  );

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await setFolder({ projectId, path: selected });
      onPicked();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save the folder",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="mr-auto">
          <h1 className="text-sm font-semibold">Choose your config folder</h1>
          <p className="text-xs text-muted-foreground">
            Folders in your repo that hold JSON, YAML or TOML files. Pick one
            and check its files before confirming.
          </p>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          disabled={!selected || preview.length === 0 || saving}
          onClick={() => void confirm()}
        >
          {saving && <Loader2 className="animate-spin" />}
          Use this folder
        </Button>
      </div>

      {list.isPending ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-5 w-48" />
        </div>
      ) : list.error ? (
        <p className="p-4 text-sm text-destructive">
          {list.error.message || "Couldn't read the repository from GitHub."}
        </p>
      ) : folders.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No folders with JSON, YAML or TOML files were found in this repo.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          <ul className="min-h-0 overflow-y-auto border-border p-2 slim-scrollbar md:border-r">
            {folders.map((folder) => (
              <li key={folder.path}>
                <button
                  type="button"
                  aria-pressed={selected === folder.path}
                  onClick={() => setSelected(folder.path)}
                  style={{ paddingLeft: `${String(folder.depth * 16 + 8)}px` }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-sm hover:bg-muted",
                    selected === folder.path && "bg-muted",
                  )}
                >
                  <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {folder.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {folder.totalCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-0 overflow-y-auto p-4 slim-scrollbar">
            {selected ? (
              <>
                <p className="mb-2 font-mono text-xs">
                  {selected}
                  <span className="text-muted-foreground">
                    {` · ${String(preview.length)} ${preview.length === 1 ? "file" : "files"}`}
                  </span>
                </p>
                <ul className="space-y-0.5">
                  {preview.map((file) => (
                    <li
                      key={file.path}
                      className="truncate font-mono text-xs text-muted-foreground"
                    >
                      {relativeTo(selected, file.path)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a folder to see the files Wryte will manage.
              </p>
            )}
          </div>
        </div>
      )}
      {list.data?.truncated && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          This repo is large, so some folders may be missing from the list.
        </p>
      )}
    </div>
  );
}
