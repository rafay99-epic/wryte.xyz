"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationInfo } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewPreferences } from "@/hooks/use-view-preferences";
import { fadeIn, smoothTransition } from "@/lib/motion";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import type { BoardColumnDef } from "@/types/board";
import { BoardView } from "./board-view";
import { ContentEmptyState, type ViewFilter } from "./content-empty-state";
import type { ContentItem } from "./content-table-row";
import { TableView } from "./table-view";
import { TagFilterBar } from "./tag-filter-bar";
import { ViewModeSwitcher } from "./view-mode-switcher";

const PAGE_SIZE = 10;

interface ContentDashboardProps {
  /** All content items (already filtered by viewFilter + search). */
  items: ContentItem[];
  /** Unfiltered items for computing tab counts. */
  allItems: ContentItem[];
  /** Dynamic board columns from project config. */
  columns: BoardColumnDef[];
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
  onBatchImport: (paths: string[]) => Promise<void>;
  isBatchImporting: boolean;
  batchImportProgress: { done: number; total: number } | null;
  projectId: string;
  frontmatterMap: Map<string, ParsedFrontmatter>;
}

export function ContentDashboard({
  items,
  allItems,
  columns,
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
  isBatchImporting,
  batchImportProgress,
  projectId,
  frontmatterMap,
}: ContentDashboardProps) {
  const { viewMode, setViewMode } = useViewPreferences(projectId);
  const activeTagFilters = useBoardStore((s) => s.activeTagFilters);
  const setSettingsDialogOpen = useBoardStore((s) => s.setSettingsDialogOpen);

  // --- Multi-select state for remote items ---
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Clear selection when filter/search changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally clear selection when filter/search props change
  useEffect(() => {
    setSelectedPaths(new Set());
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

  const handleBatchImport = useCallback(async () => {
    const paths = Array.from(selectedPaths);
    if (paths.length === 0) return;
    await onBatchImport(paths);
    setSelectedPaths(new Set());
  }, [selectedPaths, onBatchImport]);

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

  // Compute all unique tags across items (for tag filter bar)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of allItems) {
      for (const tag of item.tags ?? []) {
        tagSet.add(tag);
      }
      // Also check frontmatter map
      if (item.id) {
        const fm = frontmatterMap.get(item.id);
        if (fm?.tags) {
          for (const tag of fm.tags) {
            tagSet.add(tag);
          }
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allItems, frontmatterMap]);

  // Tab counts
  const localCount = allItems.filter((i) => i.kind === "local").length;
  const remoteCount = allItems.filter((i) => i.kind === "remote").length;

  return (
    <div>
      {/* Search + Refresh + View Mode */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, slug, or path..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
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
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
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
        {selectedPaths.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-xl border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
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
                disabled={isBatchImporting}
              >
                {isBatchImporting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {batchImportProgress
                      ? `Importing ${batchImportProgress.done}/${batchImportProgress.total}...`
                      : "Importing..."}
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    Import to Convex
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSelectedPaths(new Set())}
                disabled={isBatchImporting}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
