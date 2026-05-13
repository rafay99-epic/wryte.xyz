"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  Cloud,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationInfo } from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewPreferences } from "@/hooks/use-view-preferences";
import { fadeIn, smoothTransition } from "@/lib/motion";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { type SortOrder, useSearchStore } from "@/stores/search-store";
import type { BoardColumnDef } from "@/types/board";
import { BoardView } from "./board-view";
import {
  type BulkDeleteBatch,
  type BulkDeleteCounts,
  BulkDeleteDialog,
  type BulkDeleteMode,
} from "./bulk-delete-dialog";
import { type BulkImportBatch, BulkImportDialog } from "./bulk-import-dialog";
import { ContentEmptyState, type ViewFilter } from "./content-empty-state";
import type { ContentItem } from "./content-table-row";
import { TableView } from "./table-view";
import { TagFilterBar } from "./tag-filter-bar";
import { ViewModeSwitcher } from "./view-mode-switcher";

/** Payload the dashboard hands back to the parent when the user confirms
 *  a bulk delete. The parent resolves IDs → full records (with githubSha
 *  etc.) before calling the Convex action. */
export interface BulkDeleteSelection {
  mode: BulkDeleteMode;
  localIds: string[];
  remotePaths: string[];
}

const PAGE_SIZE = 10;

const SORT_OPTIONS: {
  value: SortOrder;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "newest",
    label: "Newest first",
    icon: <CalendarArrowDown className="size-3.5" />,
  },
  {
    value: "oldest",
    label: "Oldest first",
    icon: <CalendarArrowUp className="size-3.5" />,
  },
  {
    value: "a-z",
    label: "A \u2192 Z",
    icon: <ArrowDownAZ className="size-3.5" />,
  },
  {
    value: "z-a",
    label: "Z \u2192 A",
    icon: <ArrowUpAZ className="size-3.5" />,
  },
  {
    value: "relevance",
    label: "Relevance",
    icon: <Sparkles className="size-3.5" />,
  },
];

interface ContentDashboardProps {
  /** All content items (already filtered by viewFilter + search). */
  items: ContentItem[];
  /** Unfiltered items for computing tab counts. */
  allItems: ContentItem[];
  /** Dynamic board columns from project config. */
  columns: BoardColumnDef[];
  /** All unique tags across all items (for filter UI). */
  allTags: string[];
  viewFilter: ViewFilter;
  onViewFilterChange: (f: ViewFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  hasGithub: boolean;
  isLoadingRemote: boolean;
  hasLoadedRemote: boolean;
  onRefreshRemote: () => void;
  onOpenItem: (item: ContentItem) => void;
  onDeleteLocal: (item: ContentItem) => void;
  onDeleteRemote: (item: ContentItem) => void;
  importingPath: string | null;
  onCreateClick: (initialStatus?: string) => void;
  // ── Bulk import (reactive batch + lifecycle hooks) ─────────────
  onBatchImport: (paths: string[]) => Promise<void>;
  /** Set while the start-action is in flight (parent triggers, batch hasn't been created yet). */
  isStartingImport: boolean;
  /** Reactive import_batches row, or null if no active import. */
  importBatch: BulkImportBatch | null | undefined;
  /** Called when the user clicks Done on the completion screen — parent clears its batchId. */
  onBulkImportDone: () => void;
  // ── Bulk publish (legacy floating-toolbar flow) ────────────────
  onBulkPublish?: ((docIds: string[]) => Promise<void>) | undefined;
  isBulkPublishing?: boolean | undefined;
  bulkPublishProgress?: { done: number; total: number } | null | undefined;
  // ── Bulk delete (reactive batch + lifecycle hooks) ─────────────
  onBulkDelete?:
    | ((selection: BulkDeleteSelection) => Promise<void>)
    | undefined;
  /** Set while the delete start-action is in flight. */
  isStartingDelete?: boolean | undefined;
  /** Reactive delete_batches row, or null if no active delete. */
  deleteBatch?: BulkDeleteBatch | null | undefined;
  /** Called when the user clicks Done on the completion screen. */
  onBulkDeleteDone?: (() => void) | undefined;
  projectId: string;
  frontmatterMap: Map<string, ParsedFrontmatter>;
}

export function ContentDashboard({
  items,
  allItems,
  columns,
  allTags,
  viewFilter,
  onViewFilterChange,
  searchQuery,
  onSearchChange,
  hasGithub,
  isLoadingRemote,
  hasLoadedRemote,
  onRefreshRemote,
  onOpenItem,
  onDeleteLocal,
  onDeleteRemote,
  importingPath,
  onCreateClick,
  onBatchImport,
  isStartingImport,
  importBatch,
  onBulkImportDone,
  onBulkPublish,
  isBulkPublishing,
  bulkPublishProgress,
  onBulkDelete,
  isStartingDelete,
  deleteBatch,
  onBulkDeleteDone,
  projectId,
  frontmatterMap,
}: ContentDashboardProps) {
  const { viewMode, setViewMode } = useViewPreferences(projectId);
  const activeTagFilters = useBoardStore((s) => s.activeTagFilters);
  const setSettingsDialogOpen = useBoardStore((s) => s.setSettingsDialogOpen);

  // --- Search store ---
  const sortOrder = useSearchStore((s) => s.getSortOrder(projectId));
  const setSortOrder = useSearchStore((s) => s.setSortOrder);
  const searchTagFilters = useSearchStore((s) => s.getTagFilters(projectId));
  const toggleTagFilter = useSearchStore((s) => s.toggleTagFilter);
  const clearTagFilters = useSearchStore((s) => s.clearTagFilters);
  // --- Multi-select state for remote items ---
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  // --- Multi-select state for local items (bulk publish) ---
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Clear selection when filter/search changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally clear selection when filter/search props change
  useEffect(() => {
    setSelectedPaths(new Set());
    setSelectedDocIds(new Set());
  }, [viewFilter, searchQuery]);

  const handleToggleSelect = useCallback((path: string, checked: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const remotePaths = new Set<string>();
        for (const item of items) {
          if (item.kind === "remote") {
            remotePaths.add(item.path);
          }
        }
        setSelectedPaths(remotePaths);
      } else {
        setSelectedPaths(new Set());
      }
    },
    [items],
  );

  const handleToggleDocSelect = useCallback(
    (docId: string, checked: boolean) => {
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(docId);
        } else {
          next.delete(docId);
        }
        return next;
      });
    },
    [],
  );

  const handleToggleSelectAllLocal = useCallback(
    (checked: boolean) => {
      if (checked) {
        const localIds = new Set<string>();
        for (const item of items) {
          if (item.kind === "local" && item.id) {
            localIds.add(item.id);
          }
        }
        setSelectedDocIds(localIds);
      } else {
        setSelectedDocIds(new Set());
      }
    },
    [items],
  );

  // ── Bulk import — fires the start-action, opens the progress dialog ──
  const handleBatchImport = useCallback(async () => {
    const paths = Array.from(selectedPaths);
    if (paths.length === 0) return;
    try {
      // Parent will set its batchId + isStartingImport. We just kick it
      // off and immediately clear the selection — the dialog (driven
      // by the reactive `importBatch` prop) shows live progress from
      // here on out.
      await onBatchImport(paths);
      setSelectedPaths(new Set());
    } catch {
      // Parent toasts on start-failure; no need to clear selection so
      // the user can retry without re-picking.
    }
  }, [selectedPaths, onBatchImport]);

  const importDialogOpen = Boolean(importBatch) || isStartingImport;
  const importPhase = useMemo(() => {
    if (!importBatch) return "progress" as const;
    return importBatch.succeeded + importBatch.failed >= importBatch.total
      ? ("complete" as const)
      : ("progress" as const);
  }, [importBatch]);

  const handleImportDialogOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      // While the workpool is still chewing, refuse to close — same
      // contract the dialog enforces, mirrored here in the parent so
      // an external close (Escape pressed, backdrop click, etc.) is
      // ignored before it even reaches the dialog.
      if (importPhase === "progress") return;
      onBulkImportDone();
    },
    [importPhase, onBulkImportDone],
  );

  const handleBulkPublish = useCallback(async () => {
    const ids = Array.from(selectedDocIds);
    if (ids.length === 0 || !onBulkPublish) return;
    await onBulkPublish(ids);
    setSelectedDocIds(new Set());
  }, [selectedDocIds, onBulkPublish]);

  // ── Bulk delete — confirm dialog + reactive progress + complete ──
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  /** How many selected items are eligible for each delete mode. */
  const bulkDeleteCounts: BulkDeleteCounts = useMemo(() => {
    let local = 0;
    let github = 0;
    for (const item of items) {
      if (item.kind === "local" && item.id && selectedDocIds.has(item.id)) {
        local += 1;
        if (item.path) github += 1;
      } else if (
        item.kind === "remote" &&
        item.path &&
        selectedPaths.has(item.path)
      ) {
        github += 1;
      }
    }
    return { local, github };
  }, [items, selectedDocIds, selectedPaths]);

  const deletePhase = useMemo(() => {
    if (!deleteBatch) return "confirm" as const;
    return deleteBatch.succeeded + deleteBatch.failed >= deleteBatch.total
      ? ("complete" as const)
      : ("progress" as const);
  }, [deleteBatch]);

  // Dialog is "open" whenever the user is in any of the three phases.
  // Confirm is local state; progress + complete are driven by whether a
  // batch row exists in the parent.
  const deleteDialogOpen =
    bulkDeleteConfirmOpen || Boolean(deleteBatch) || Boolean(isStartingDelete);

  const handleBulkDeleteConfirm = useCallback(
    async (mode: BulkDeleteMode) => {
      if (!onBulkDelete) return;
      const localIds = Array.from(selectedDocIds);
      const remotePaths = Array.from(selectedPaths);
      if (localIds.length === 0 && remotePaths.length === 0) return;
      try {
        await onBulkDelete({ mode, localIds, remotePaths });
        // Batch is in flight — clear the selection (the items are
        // about to disappear) and dismiss the confirm phase. The dialog
        // stays open via `deleteBatch` and transitions to progress.
        setSelectedDocIds(new Set());
        setSelectedPaths(new Set());
        setBulkDeleteConfirmOpen(false);
      } catch {
        // Start-action failed (rate limit / not authenticated / etc).
        // Parent surfaces the toast; keep the confirm dialog open so
        // the user can retry without re-picking the selection.
      }
    },
    [onBulkDelete, selectedDocIds, selectedPaths],
  );

  const handleDeleteDialogOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      if (deletePhase === "progress") return;
      // In confirm phase, just close. In complete phase, also clear the
      // parent's batchId so the dialog doesn't immediately reopen on
      // the next reactive tick.
      setBulkDeleteConfirmOpen(false);
      if (deleteBatch && deletePhase === "complete") {
        onBulkDeleteDone?.();
      }
    },
    [deletePhase, deleteBatch, onBulkDeleteDone],
  );

  const handleBulkDeleteDone = useCallback(() => {
    setBulkDeleteConfirmOpen(false);
    onBulkDeleteDone?.();
  }, [onBulkDeleteDone]);

  const handleBulkImportDone = useCallback(() => {
    onBulkImportDone();
  }, [onBulkImportDone]);

  // Listen for keyboard shortcut layout switch event
  useEffect(() => {
    function handleSwitchLayout() {
      setViewMode(viewMode === "table" ? "board" : "table");
    }
    window.addEventListener("wryte:switch-layout", handleSwitchLayout);
    return () =>
      window.removeEventListener("wryte:switch-layout", handleSwitchLayout);
  }, [viewMode, setViewMode]);

  // Pagination state (table only)
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  // Reset page on filter/search/view changes
  useEffect(() => {
    setCurrentPage(1);
  }, []);

  // Clamp page if items shrink
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, currentPage]);

  // Apply tag filters for board view
  const tagFilteredItems = useMemo(() => {
    if (activeTagFilters.size === 0) return items;
    return items.filter((item) => {
      const itemTags = item.tags ?? [];
      return itemTags.some((tag) => activeTagFilters.has(tag));
    });
  }, [items, activeTagFilters]);

  // Tab counts
  const localCount = allItems.filter((i) => i.kind === "local").length;
  const remoteCount = allItems.filter((i) => i.kind === "remote").length;

  // Current sort option
  const currentSort =
    SORT_OPTIONS.find((o) => o.value === sortOrder) ?? SORT_OPTIONS[0];

  // Tag filter popover state
  const [tagFilterQuery, setTagFilterQuery] = useState("");
  const filteredTagOptions = useMemo(() => {
    if (!tagFilterQuery.trim()) return allTags;
    const q = tagFilterQuery.toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(q));
  }, [allTags, tagFilterQuery]);

  return (
    <div>
      {/* Search bar + controls */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, tags, content, author, path..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Tag filter popover */}
        {allTags.length > 0 && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    searchTagFilters.length > 0 &&
                      "border-primary/50 text-primary",
                  )}
                />
              }
            >
              <Tag className="size-3.5" />
              Tags
              {searchTagFilters.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0 text-[10px]"
                >
                  {searchTagFilters.length}
                </Badge>
              )}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Filter by tags
              </div>
              <Input
                placeholder="Search tags..."
                value={tagFilterQuery}
                onChange={(e) => setTagFilterQuery(e.target.value)}
                className="mb-2 h-8 text-xs"
              />
              <div className="max-h-48 overflow-y-auto slim-scrollbar">
                {filteredTagOptions.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    No tags found
                  </p>
                ) : (
                  filteredTagOptions.map((tag) => (
                    <label
                      key={tag}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={searchTagFilters.includes(tag)}
                        onChange={() => toggleTagFilter(projectId, tag)}
                        className="size-3.5 rounded accent-primary"
                      />
                      <span className="truncate">{tag}</span>
                    </label>
                  ))
                )}
              </div>
              {searchTagFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearTagFilters(projectId)}
                  className="mt-2 w-full text-xs"
                >
                  Clear tag filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            {currentSort?.icon}
            <span className="hidden sm:inline">{currentSort?.label}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setSortOrder(projectId, opt.value)}
                className={cn(
                  sortOrder === opt.value && "bg-muted font-medium",
                )}
              >
                {opt.icon}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasGithub && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshRemote}
            disabled={isLoadingRemote}
          >
            <RefreshCw
              className={cn("size-3.5", isLoadingRemote && "animate-spin")}
            />
            Sync
          </Button>
        )}
        {viewMode === "board" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="size-3.5" />
            Columns
          </Button>
        )}
        <ViewModeSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {/* Active filter chips */}
      {(searchTagFilters.length > 0 || searchQuery.trim()) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {searchQuery.trim() && (
            <Badge
              variant="secondary"
              className="gap-1 pl-2 pr-1 text-xs font-normal"
            >
              <Search className="size-3 text-muted-foreground" />
              &ldquo;{searchQuery.trim()}&rdquo;
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {searchTagFilters.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pl-2 pr-1 text-xs font-normal"
            >
              <Tag className="size-3 text-muted-foreground" />
              {tag}
              <button
                type="button"
                onClick={() => toggleTagFilter(projectId, tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {(searchTagFilters.length > 0 || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                clearTagFilters(projectId);
              }}
              className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "result" : "results"}
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <Tabs
        value={viewFilter}
        onValueChange={(v) => onViewFilterChange(v as ViewFilter)}
      >
        <TabsList variant="line">
          <TabsTrigger value="all">
            All
            <span className="ml-1 text-xs text-muted-foreground">
              {allItems.length}
            </span>
          </TabsTrigger>
          {/* Dynamic column tabs */}
          {columns.map((col) => (
            <TabsTrigger key={col.id} value={col.id}>
              {col.label}
            </TabsTrigger>
          ))}
          {hasGithub && (
            <>
              <TabsTrigger value="local">
                Local
                <span className="ml-1 text-xs text-muted-foreground">
                  {localCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="remote">
                Remote
                <span className="ml-1 text-xs text-muted-foreground">
                  {remoteCount}
                </span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Content area */}
        <div className="mt-4">
          {/* Loading indicator for remote files */}
          {isLoadingRemote && !hasLoadedRemote && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Fetching remote files from GitHub...
            </div>
          )}

          {items.length === 0 ? (
            <ContentEmptyState
              viewFilter={viewFilter}
              searchQuery={searchQuery}
              onCreateClick={() => onCreateClick()}
            />
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "table" ? (
                <motion.div
                  key="table"
                  variants={fadeIn}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={smoothTransition}
                >
                  <TableView
                    items={paginatedItems}
                    columns={columns}
                    frontmatterMap={frontmatterMap}
                    importingPath={importingPath}
                    showSelection={hasGithub}
                    selectedPaths={selectedPaths}
                    selectedDocIds={selectedDocIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onToggleDocSelect={
                      onBulkPublish ? handleToggleDocSelect : undefined
                    }
                    onToggleSelectAllLocal={
                      onBulkPublish ? handleToggleSelectAllLocal : undefined
                    }
                    onOpenItem={onOpenItem}
                    onDeleteLocal={onDeleteLocal}
                    onDeleteRemote={onDeleteRemote}
                  />

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <PaginationInfo
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={items.length}
                        pageSize={PAGE_SIZE}
                      />
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="board"
                  variants={fadeIn}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={smoothTransition}
                >
                  <TagFilterBar allTags={allTags} />
                  <BoardView
                    items={tagFilteredItems}
                    columns={columns}
                    frontmatterMap={frontmatterMap}
                    hasGithub={hasGithub}
                    projectId={projectId}
                    selectedPaths={selectedPaths}
                    onToggleSelect={handleToggleSelect}
                    onOpenItem={onOpenItem}
                    onDeleteLocal={onDeleteLocal}
                    onDeleteRemote={onDeleteRemote}
                    onCreateClick={(status) => onCreateClick(status)}
                    onSettingsClick={() => setSettingsDialogOpen(true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </Tabs>

      {/* Floating multi-select action bar */}
      <AnimatePresence>
        {(selectedPaths.size > 0 || selectedDocIds.size > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-xl border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
              {/* Remote files selected — Import action */}
              {selectedPaths.size > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Cloud className="size-4 text-blue-500" />
                    <span>
                      {selectedPaths.size}{" "}
                      {selectedPaths.size === 1 ? "file" : "files"} selected
                    </span>
                  </div>

                  <div className="h-5 w-px bg-border" />

                  <Button
                    size="sm"
                    onClick={() => void handleBatchImport()}
                    disabled={isStartingImport || importDialogOpen}
                  >
                    {isStartingImport ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Starting…
                      </>
                    ) : (
                      <>
                        <Download className="size-3.5" />
                        Import to Wryte
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Local docs selected — Bulk publish action */}
              {selectedDocIds.size > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 text-emerald-500" />
                    <span>
                      {selectedDocIds.size}{" "}
                      {selectedDocIds.size === 1 ? "article" : "articles"}{" "}
                      selected
                    </span>
                  </div>

                  {onBulkPublish && (
                    <>
                      <div className="h-5 w-px bg-border" />

                      <Button
                        size="sm"
                        onClick={() => void handleBulkPublish()}
                        disabled={isBulkPublishing}
                        className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {isBulkPublishing ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            {bulkPublishProgress
                              ? `Publishing ${bulkPublishProgress.done}/${bulkPublishProgress.total}...`
                              : "Publishing..."}
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" />
                            Publish All
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </>
              )}

              {/* Bulk delete — always available when there's any selection
                  and the parent provided a handler. The destructive bulk
                  action opens a dedicated confirm-then-progress dialog
                  so the user reads the consequences before nuking. */}
              {onBulkDelete &&
                (selectedDocIds.size > 0 || selectedPaths.size > 0) && (
                  <>
                    <div className="h-5 w-px bg-border" />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setBulkDeleteConfirmOpen(true)}
                      disabled={
                        isStartingImport ||
                        isBulkPublishing ||
                        isStartingDelete ||
                        deleteDialogOpen
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </>
                )}

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setSelectedPaths(new Set());
                  setSelectedDocIds(new Set());
                }}
                disabled={
                  isStartingImport || isBulkPublishing || isStartingDelete
                }
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk delete — confirm → progress → complete in one dialog */}
      {onBulkDelete && (
        <BulkDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={handleDeleteDialogOpenChange}
          counts={bulkDeleteCounts}
          phase={deletePhase}
          batch={deleteBatch}
          onConfirm={handleBulkDeleteConfirm}
          onDone={handleBulkDeleteDone}
          isStarting={Boolean(isStartingDelete)}
        />
      )}

      {/* Bulk import — straight into progress, no confirm step */}
      <BulkImportDialog
        open={importDialogOpen}
        onOpenChange={handleImportDialogOpenChange}
        phase={importPhase}
        batch={importBatch}
        onDone={handleBulkImportDone}
      />
    </div>
  );
}
