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
import { useEffect, useMemo, useRef, useState } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { useThemeStore } from "@/stores/theme-store";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandItem = {
  id: string;
  label: string;
  description?: string | undefined;
  icon: React.ElementType;
  /** When true, pass fill="currentColor" (e.g. favorite star). */
  iconFilled?: boolean | undefined;
  shortcutId?: string | undefined;
  category: "action" | "project" | "article" | "navigation";
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Category = CommandItem["category"];

/** Display order of category sections — drives both sorting and labels. */
const CATEGORY_ORDER: readonly Category[] = [
  "action",
  "navigation",
  "project",
  "article",
];

const CATEGORY_LABELS: Record<Category, string> = {
  action: "Actions",
  navigation: "Navigation",
  project: "Projects",
  article: "Recent Articles",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Input-modality refs: keep mouse hover from fighting keyboard nav.
  // - isKeyboardNav stays true until the pointer is *actually* moved.
  // - lastPointerPos filters synthetic pointermove events that fire when the
  //   list scrolls under a stationary cursor — without this guard, those
  //   events would reset the keyboard flag and let a stray mouseenter steal
  //   the selection out from under the user.
  const isKeyboardNav = useRef(true);
  const lastPointerPos = useRef<{ x: number; y: number } | null>(null);

  const getKeys = useShortcutsStore((s) => s.getKeys);
  const activeProjectId = useEditorStore((s) => s.activeProjectId);

  // ---------------------------------------------------------------------------
  // Data sources
  // ---------------------------------------------------------------------------

  const projects = useQuery(api.cms.projects.list);
  const recentDocs = useQuery(api.cms.documents.listRecent, { limit: 20 });

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
    const base = !query.trim()
      ? commandItems
      : commandItems.filter((item) => {
          const lower = query.toLowerCase();
          return (
            item.label.toLowerCase().includes(lower) ||
            item.description?.toLowerCase().includes(lower)
          );
        });
    // Sort by category so the flat-array order matches the grouped render
    // order. Without this, items rendered under one category can share a
    // globalIndex with items rendered under another (because the grouped
    // map starts a new run while filteredItems is still interleaved),
    // producing two simultaneously-highlighted rows.
    // Array.sort is stable (ES2019+), so items within the same category
    // keep their original order.
    return [...base].sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );
  }, [commandItems, query]);

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  // Mirror reactive state into refs so the native keydown listener (attached
  // once when the palette opens) always sees the latest values without
  // needing to be detached and re-attached on every render.
  const filteredItemsRef = useRef(filteredItems);
  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => {
    filteredItemsRef.current = filteredItems;
  }, [filteredItems]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Native capture-phase listener on the wrapper so we can stopImmediatePropagation
  // and prevent TanStack hotkeys (registered on document) from also firing
  // on ArrowUp/Down/Enter/Escape while the palette is open.
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
            if (len === 0) return 0;
            return prev < len - 1 ? prev + 1 : 0;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopImmediatePropagation();
          isKeyboardNav.current = true;
          setSelectedIndex((prev) => {
            const len = filteredItemsRef.current.length;
            if (len === 0) return 0;
            return prev > 0 ? prev - 1 : len - 1;
          });
          break;
        case "Home":
          e.preventDefault();
          e.stopImmediatePropagation();
          isKeyboardNav.current = true;
          setSelectedIndex(0);
          break;
        case "End":
          e.preventDefault();
          e.stopImmediatePropagation();
          isKeyboardNav.current = true;
          setSelectedIndex(Math.max(0, filteredItemsRef.current.length - 1));
          break;
        case "Enter": {
          e.preventDefault();
          e.stopImmediatePropagation();
          const item = filteredItemsRef.current[selectedIndexRef.current];
          if (item) item.onSelect();
          break;
        }
        case "Escape":
          e.preventDefault();
          e.stopImmediatePropagation();
          onOpenChange(false);
          break;
      }
    }

    wrapper.addEventListener("keydown", handleKeyDown, true);
    return () => {
      wrapper.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onOpenChange]);

  // Reset state every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      isKeyboardNav.current = true;
      lastPointerPos.current = null;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Reset selection to the top whenever the search query changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: query is the trigger here, not a value read inside the effect
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Clamp selection if filtering shrinks the list below the current index.
  // Uses a functional updater so a list that *grows* (data loads in) doesn't
  // disturb where the user has navigated.
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (filteredItems.length === 0) return 0;
      return Math.min(prev, filteredItems.length - 1);
    });
  }, [filteredItems.length]);

  // Keep the selected item in view as the user navigates. Instant (not smooth)
  // so rapid key presses feel responsive — smooth would lag behind input.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector<HTMLElement>(
      `[data-index='${String(selectedIndex)}']`,
    );
    if (!selected) return;
    selected.scrollIntoView({
      block: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [selectedIndex]);

  // ---------------------------------------------------------------------------
  // Group filtered items by category for display
  // ---------------------------------------------------------------------------

  const grouped = useMemo(() => {
    const groups = new Map<
      Category,
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
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-4 right-4 top-[18%] z-50 mx-auto max-w-2xl"
          >
            <div
              ref={wrapperRef}
              className="overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                <Search className="size-4 shrink-0 text-muted-foreground/70" />
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
                <Kbd>Esc</Kbd>
              </div>

              {/* Results list */}
              <div
                ref={listRef}
                className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain scroll-py-2 p-1.5"
                onPointerMove={(e) => {
                  // Only count *real* pointer movement. When the list scrolls
                  // under a stationary cursor, the browser may fire pointermove
                  // at identical client coords — ignore those so they don't
                  // flip us out of keyboard-nav mode.
                  const last = lastPointerPos.current;
                  if (last && last.x === e.clientX && last.y === e.clientY) {
                    return;
                  }
                  lastPointerPos.current = { x: e.clientX, y: e.clientY };
                  isKeyboardNav.current = false;
                }}
              >
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground/70">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  Array.from(grouped.entries()).map(
                    ([category, { items, startIndex }]) => (
                      <div key={category}>
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          {CATEGORY_LABELS[category]}
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
                              data-index={globalIndex}
                              data-selected={isSelected}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors duration-75",
                                isSelected
                                  ? "bg-muted text-foreground"
                                  : "text-foreground/75 hover:bg-muted/40 hover:text-foreground",
                              )}
                              onClick={() => {
                                const target = filteredItems[globalIndex];
                                if (target) target.onSelect();
                              }}
                              onPointerEnter={() => {
                                if (isKeyboardNav.current) return;
                                setSelectedIndex(globalIndex);
                              }}
                            >
                              <Icon
                                className={cn(
                                  "size-4 shrink-0",
                                  item.iconFilled
                                    ? "text-amber-400"
                                    : isSelected
                                      ? "text-foreground"
                                      : "text-muted-foreground/70",
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
                                  <span className="block truncate text-xs text-muted-foreground/70">
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
              <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground/70">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span>Navigate</span>
                  <Kbd className="ml-1">↵</Kbd>
                  <span>Select</span>
                </span>
                <span className="tabular-nums">
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
