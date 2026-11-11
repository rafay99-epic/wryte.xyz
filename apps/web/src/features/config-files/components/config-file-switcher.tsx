"use client";

import type { ConfigFileEntry } from "@wryte/logic/lib/config/tree";
import { relativeTo } from "@wryte/logic/lib/config/tree";
import { cn } from "@wryte/logic/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wryte/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export function ConfigFileSwitcher({
  root,
  files,
  selectedPath,
  edited,
  onSelect,
  onRefresh,
  onChangeFolder,
}: {
  root: string;
  files: readonly ConfigFileEntry[];
  selectedPath: string | null;
  edited: ReadonlySet<string>;
  onSelect: (path: string) => void;
  onRefresh: () => void;
  onChangeFolder: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-xs hover:bg-muted"
          />
        }
      >
        <span className="truncate">
          {selectedPath ? relativeTo(root, selectedPath) : root}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        {files.map((file) => (
          <DropdownMenuItem
            key={file.path}
            onClick={() => onSelect(file.path)}
            className={cn(
              "flex items-center gap-3 font-mono text-xs",
              file.path === selectedPath && "bg-muted",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {relativeTo(root, file.path)}
            </span>
            {edited.has(file.path) && (
              <span className="font-sans text-muted-foreground">edited</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onClick={onRefresh}>
          Refresh file list
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs" onClick={onChangeFolder}>
          Change folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
