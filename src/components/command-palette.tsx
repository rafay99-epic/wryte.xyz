"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  FolderOpen,
  Home,
  Keyboard,
  Layout,
  Moon,
  Palette,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KbdGroup } from "@/components/ui/kbd";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { useThemeStore } from "@/stores/theme-store";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string;
  label: string;
  description?: string | undefined;
  icon: React.ElementType;
  /** When true, pass fill="currentColor" (e.g. favorite star). */
  iconFilled?: boolean | undefined;
  shortcutId?: string | undefined;
  category: "action" | "project" | "article" | "navigation";
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Track whether navigation is via keyboard — suppresses mouse hover interference
  const isKeyboardNav = useRef(false);

  const getKeys = useShortcutsStore((s) => s.getKeys);
  const activeProjectId = useEditorStore((s) => s.activeProjectId);

  // ---------------------------------------------------------------------------
  // Data sources
  // ---------------------------------------------------------------------------

  const projects = useQuery(api.projects.list);
  const recentDocs = useQuery(api.documents.listRecent, { limit: 20 });

  // ---------------------------------------------------------------------------
  // Build command items
  // ---------------------------------------------------------------------------

  const commandItems = useMemo(() => {
    const items: CommandItem[] = [];
    const close = () => onOpenChange(false);

    // Quick actions
    items.push({
      id: "action-new-article",
      label: "New Article",
      description: activeProjectId
        ? "Create in current project"
        : "Select a project first",
      icon: Plus,
      shortcutId: "newArticle",
      category: "action",
      onSelect: () => {
        close();
        if (activeProjectId) {
          router.push(`/projects/${activeProjectId}/documents/new`);
        }
      },
    });

    items.push({
      id: "action-dashboard",
      label: "Go to Dashboard",
      icon: Home,
      shortcutId: "goToDashboard",
      category: "navigation",
      onSelect: () => {
        close();
        router.push("/dashboard");
      },
    });

    items.push({
      id: "action-settings",
      label: "Settings",
      icon: Settings,
      shortcutId: "goToSettings",
      category: "navigation",
      onSelect: () => {
        close();
        router.push("/settings");
      },
    });

    items.push({
      id: "action-toggle-sidebar",
      label: "Toggle Sidebar",
      icon: PanelLeft,
      shortcutId: "toggleSidebar",
      category: "action",
      onSelect: () => {
        close();
        useEditorStore.getState().toggleSidebar();
      },
    });

    items.push({
      id: "action-switch-layout",
      label: "Switch Layout (Table / Board)",
      icon: Layout,
      shortcutId: "switchLayout",
      category: "action",
      onSelect: () => {
        close();
        window.dispatchEvent(new CustomEvent("wryte:switch-layout"));
      },
    });

    items.push({
      id: "action-toggle-theme-light",
      label: "Switch to Light Theme",
      icon: Sun,
      category: "action",
      onSelect: () => {
        close();
        useThemeStore.getState().setMode("light");
      },
    });

    items.push({
      id: "action-toggle-theme-dark",
      label: "Switch to Dark Theme",
      icon: Moon,
      category: "action",
      onSelect: () => {
        close();
        useThemeStore.getState().setMode("dark");
      },
    });

    items.push({
      id: "action-toggle-theme-system",
      label: "Switch to System Theme",
      icon: Palette,
      category: "action",
      onSelect: () => {
        close();
        useThemeStore.getState().setMode("system");
      },
    });

    items.push({
      id: "action-keyboard-shortcuts",
      label: "Keyboard Shortcuts",
      description: "View and customize shortcuts",
      icon: Keyboard,
      category: "navigation",
      onSelect: () => {
        close();
        router.push("/settings#shortcuts");
      },
    });

    // Projects
    if (projects) {
      for (const project of projects) {
        items.push({
          id: `project-${project._id}`,
          label: project.name,
          description: project.githubRepo ?? "Local project",
          icon: project.isFavorite ? Star : FolderOpen,
          iconFilled: project.isFavorite,
          category: "project",
          onSelect: () => {
            close();
            useEditorStore.getState().setActiveProjectId(project._id);
            router.push(`/projects/${project._id}`);
          },
        });
      }
    }

    // Recent articles
    if (recentDocs) {
      for (const doc of recentDocs) {
        items.push({
          id: `article-${doc._id}`,
          label: doc.title || "Untitled",
          description: doc.status,
          icon: FileText,
          category: "article",
          onSelect: () => {
            close();
            router.push(`/editor/${doc._id}`);
          },
        });
      }
    }

    return items;
  }, [projects, recentDocs, activeProjectId, router, onOpenChange]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    if (!query.trim()) return commandItems;
    const lower = query.toLowerCase();
    return commandItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.description?.toLowerCase().includes(lower),
    );
  }, [commandItems, query]);

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  // Refs for native keydown handler (can't close over React state)
  const filteredItemsRef = useRef(filteredItems);
  useEffect(() => {
    filteredItemsRef.current = filteredItems;
  }, [filteredItems]);

  const handleSelect = useCallback(
    (index: number) => {
      const item = filteredItems[index];
      if (item) {
        item.onSelect();
      }
    },
    [filteredItems],
  );

  // Stable ref for handleSelect so the native listener always calls the latest
  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const handleSelectRef = useRef(() => handleSelect(selectedIndexRef.current));
  useEffect(() => {
    handleSelectRef.current = () => handleSelect(selectedIndexRef.current);
  }, [handleSelect]);

  // Attach a native keydown listener on the wrapper div so we can call
  // stopImmediatePropagation — this prevents TanStack hotkeys (which
  // listens on document) from also receiving arrow/enter/escape events.
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopImmediatePropagation();
          isKeyboardNav.current = true;
          setSelectedIndex((prev) => {
            const len = filteredItemsRef.current.length;
            return prev < len - 1 ? prev + 1 : 0;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopImmediatePropagation();
          isKeyboardNav.current = true;
          setSelectedIndex((prev) => {
            const len = filteredItemsRef.current.length;
            return prev > 0 ? prev - 1 : len - 1;
          });
          break;
        case "Enter":
          e.preventDefault();
          e.stopImmediatePropagation();
          handleSelectRef.current();
          break;
        case "Escape":
          e.preventDefault();
          e.stopImmediatePropagation();
          onOpenChange(false);
          break;
      }
    }

    // Use capture phase to intercept before anything else
    wrapper.addEventListener("keydown", handleKeyDown, true);
    return () => {
      wrapper.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onOpenChange]);

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Focus input after animation
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Group filtered items by category for display
  // ---------------------------------------------------------------------------

  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { items: CommandItem[]; startIndex: number }
    >();
    let idx = 0;
    for (const item of filteredItems) {
      const cat = item.category;
      if (!groups.has(cat)) {
        groups.set(cat, { items: [], startIndex: idx });
      }
      groups.get(cat)?.items.push(item);
      idx++;
    }
    return groups;
  }, [filteredItems]);

  const categoryLabels: Record<string, string> = {
    action: "Actions",
    navigation: "Navigation",
    project: "Projects",
    article: "Recent Articles",
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-1/2 top-[15%] z-50 w-full max-w-2xl -translate-x-1/2"
          >
            <div
              ref={wrapperRef}
              className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Esc
                </kbd>
              </div>

              {/* Results list */}
              <div
                ref={listRef}
                className="max-h-[400px] overflow-y-auto overscroll-contain p-1.5"
                onMouseMove={() => {
                  isKeyboardNav.current = false;
                }}
              >
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  Array.from(grouped.entries()).map(
                    ([category, { items, startIndex }]) => (
                      <div key={category}>
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          {categoryLabels[category] ?? category}
                        </p>
                        {items.map((item, i) => {
                          const globalIndex = startIndex + i;
                          const isSelected = globalIndex === selectedIndex;
                          const Icon = item.icon;
                          const shortcutKeys = item.shortcutId
                            ? splitShortcutKeys(getKeys(item.shortcutId))
                            : [];

                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-selected={isSelected}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                isSelected
                                  ? "bg-primary/10 text-foreground"
                                  : "text-foreground/80 hover:bg-muted/50",
                              )}
                              onClick={() => handleSelect(globalIndex)}
                              onMouseEnter={() => {
                                if (!isKeyboardNav.current) {
                                  setSelectedIndex(globalIndex);
                                }
                              }}
                            >
                              <Icon
                                className={cn(
                                  "size-4 shrink-0",
                                  isSelected
                                    ? "text-primary"
                                    : item.iconFilled
                                      ? "text-amber-400"
                                      : "text-muted-foreground",
                                )}
                                fill={
                                  item.iconFilled ? "currentColor" : undefined
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                              {shortcutKeys.length > 0 && (
                                <KbdGroup
                                  keys={shortcutKeys}
                                  className="shrink-0"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                  )
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center justify-between border-t border-border/30 px-4 py-2 text-[10px] text-muted-foreground/50">
                <span>
                  <kbd className="rounded border border-border/40 px-1 py-px text-[9px]">
                    ↑↓
                  </kbd>{" "}
                  Navigate{" "}
                  <kbd className="ml-1 rounded border border-border/40 px-1 py-px text-[9px]">
                    ↵
                  </kbd>{" "}
                  Select
                </span>
                <span>
                  {filteredItems.length} result
                  {filteredItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
