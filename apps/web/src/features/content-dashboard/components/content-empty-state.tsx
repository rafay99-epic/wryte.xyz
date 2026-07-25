"use client";

import { Button } from "@wryte/ui/button";
import { FileText, Plus, Search } from "lucide-react";

/**
 * Filter for the content dashboard.
 * "all", "local", "remote" are special built-in values.
 * Any other string maps to a board column ID.
 */
export type ViewFilter = string;

type ContentEmptyStateProps = {
  viewFilter: ViewFilter;
  searchQuery: string;
  onCreateClick: () => void;
};

export function ContentEmptyState({
  viewFilter,
  searchQuery,
  onCreateClick,
}: ContentEmptyStateProps) {
  if (searchQuery.trim()) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <Search className="mb-3 size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No results for &ldquo;{searchQuery}&rdquo;
        </p>
      </div>
    );
  }

  const builtInMessages: Record<string, string> = {
    all: "No documents yet. Create your first one to get started.",
    local: "No local documents. Import from GitHub or create a new one.",
    remote: "No remote files found in the content directory.",
  };

  const messages = builtInMessages;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
      <FileText className="mb-3 size-10 text-muted-foreground/50" />
      <p className="mb-4 text-sm text-muted-foreground">
        {messages[viewFilter] ?? `No documents in this column.`}
      </p>
      {(viewFilter === "all" || viewFilter === "local") && (
        <Button size="sm" onClick={onCreateClick}>
          <Plus className="size-4" />
          New Document
        </Button>
      )}
    </div>
  );
}
