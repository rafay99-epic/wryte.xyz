"use client";

import { api } from "@wryte/backend/_generated/api";
import { splitShortcutKeys } from "@wryte/logic/lib/shortcuts";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useShortcutsStore } from "@wryte/logic/stores/shortcuts-store";
import { useThemeStore } from "@wryte/logic/stores/theme-store";
import { Kbd, KbdGroup } from "@wryte/ui/kbd";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileSearch,
  FileText,
  FolderOpen,
  Home,
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
import {
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getRecentDocOpens, openBoost, recordDocOpen } from "./lib/frecency";
import { scoreItem } from "./lib/fuzzy";
import {
  accountSettingsEntries,
  projectSettingsEntries,
} from "./lib/settings-index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandItem = {
  id: string;
  label: string;
  description?: string | undefined;
  /**
   * Extra invisible haystack the fuzzy matcher searches alongside the label
   * (slugs, tags, synonyms like "kanban" for the board). Never displayed.
   */
  keywords?: string | undefined;
  icon: React.ElementType;
  /** When true, pass fill="currentColor" (e.g. favorite star). */
  iconFilled?: boolean | undefined;
  shortcutId?: string | undefined;
  category: "action" | "project" | "article" | "navigation" | "setting";
  /** 0..1 freshness for articles — small ranking boost, newest wins ties. */
  recency?: number | undefined;
  /** Position in the recently-opened list (0 = last opened), if present. */
  openRank?: number | undefined;
  onSelect: () => void;
};

/** A command item plus the matched label indices for highlighting. */
type RenderItem = CommandItem & { labelPositions?: number[] | undefined };

type Section = { label: string; items: RenderItem[] };

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Category = CommandItem["category"];

/**
 * Display order of category sections when the query is empty. Settings panes
 * are searchable but not listed at rest — 21 rows of them would bury the
 * projects and recent articles the idle view exists to surface.
 */
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
  setting: "Settings",
};

/** Articles shown in the idle (empty-query) state. */
const IDLE_ARTICLE_COUNT = 10;

/** Result rows kept after ranking — beyond this nobody scrolls. */
const MAX_RESULTS = 50;

/**
 * Debounce before a body search reaches the server. Matches the `[[` link
 * menu, and keeps "performance" at one query instead of eleven.
 */
const CONTENT_SEARCH_DEBOUNCE_MS = 200;

/**
 * Minimum query length for a body search. Below this the index returns noise
 * and the client-side tiers already answer instantly. Mirrored server-side in
 * `cms/documents.searchContent`.
 */
const MIN_CONTENT_TERM = 3;

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
  // Data sources — lazy: nothing is subscribed until the palette first opens,
  // then the subscriptions stay warm for instant reopens. The document
  // catalog is one metadata-only query; every keystroke after that is
  // matched client-side and costs zero Convex calls.
  //
  // Body search is the one exception: article bodies live in a separate table
  // so hot queries never read them, so they can only be searched server-side.
  // That query is therefore debounced, length-gated, and capped — see
  // `cms/documents.searchContent`.
  // ---------------------------------------------------------------------------

  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (open) setActivated(true);
  }, [open]);

  const projects = useQuery(api.cms.projects.list, activated ? {} : "skip");
  const documents = useQuery(
    api.cms.documents.listPalette,
    activated ? {} : "skip",
  );

  // Debounced mirror of `query` — each distinct value is a distinct Convex
  // subscription, so this is what keeps a fast typist from opening a dozen.
  const [contentTerm, setContentTerm] = useState("");
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CONTENT_TERM) {
      setContentTerm("");
      return;
    }
    const id = setTimeout(
      () => setContentTerm(trimmed),
      CONTENT_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [query]);

  // Unscoped on purpose: the palette searches every project the user owns.
  const contentHits = useQuery(
    api.cms.documents.searchContent,
    activated && contentTerm ? { term: contentTerm } : "skip",
  );
  /** True while a body search is in flight for the current query. */
  const contentPending = Boolean(contentTerm) && contentHits === undefined;

  const projectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects ?? []) map.set(p._id, p.name);
    return map;
  }, [projects]);

  // Palette-open history (localStorage) — re-read each time the palette
  // opens so this session's jumps affect this session's ranking.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `open` is the refresh trigger
  const openRanks = useMemo(() => {
    const map = new Map<string, number>();
    getRecentDocOpens().forEach((id, index) => {
      map.set(id, index);
    });
    return map;
  }, [open]);

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
      keywords: "create write post draft document",
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
      keywords: "home overview projects",
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
      keywords: "preferences config account profile",
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
      keywords: "hide show collapse expand panel navigation",
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
      keywords: "kanban view columns list grid calendar",
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
      keywords: "appearance day mode color",
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
      keywords: "appearance night mode color",
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
      keywords: "appearance auto mode color",
      icon: Palette,
      category: "action",
      onSelect: () => {
        close();
        useThemeStore.getState().setMode("system");
      },
    });

    // Settings panes — every account pane, plus the active project's panes.
    // Derived from the arrays the settings shells themselves render from, so
    // "api key", "watermark", or "delete account" all land on a real pane.
    const settingsEntries = [
      ...accountSettingsEntries(),
      ...(activeProjectId
        ? projectSettingsEntries(
            activeProjectId,
            projectNames.get(activeProjectId) ?? "project",
          )
        : []),
    ];
    for (const entry of settingsEntries) {
      items.push({
        id: entry.id,
        label: entry.label,
        description: entry.group,
        keywords: entry.keywords,
        icon: entry.icon,
        category: "setting",
        onSelect: () => {
          close();
          router.push(entry.href);
        },
      });
    }

    // Projects
    if (projects) {
      for (const project of projects) {
        items.push({
          id: `project-${project._id}`,
          label: project.name,
          description: project.githubRepo ?? "Local project",
          keywords: `${project.slug} project switch open`,
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

    // Articles — the full catalog, every project. The idle view slices the
    // most recent few; searching ranks across all of them.
    if (documents) {
      const newest = documents[0]?.updatedAt ?? 0;
      const oldest = documents[documents.length - 1]?.updatedAt ?? 0;
      const span = Math.max(1, newest - oldest);
      for (const doc of documents) {
        const projectName = projectNames.get(doc.projectId);
        items.push({
          id: `article-${doc._id}`,
          label: doc.title || "Untitled",
          description: [projectName, doc.status].filter(Boolean).join(" · "),
          keywords: `${doc.slug} ${(doc.tags ?? []).join(" ")} ${projectName ?? ""}`,
          icon: FileText,
          category: "article",
          recency: (doc.updatedAt - oldest) / span,
          openRank: openRanks.get(doc._id),
          onSelect: () => {
            recordDocOpen(doc._id);
            close();
            router.push(`/editor/${doc._id}`);
          },
        });
      }
    }

    return items;
  }, [
    projects,
    documents,
    projectNames,
    openRanks,
    activeProjectId,
    router,
    onOpenChange,
  ]);

  // ---------------------------------------------------------------------------
  // Filtering & ranking
  // ---------------------------------------------------------------------------

  const { sections, flatItems } = useMemo(() => {
    const trimmed = query.trim();
    let sections: Section[];

    if (!trimmed) {
      // Idle: grouped by category. Articles show palette-opened docs first
      // (the ones you keep jumping to), then the rest by recency of edit.
      sections = CATEGORY_ORDER.flatMap((cat) => {
        let catItems = commandItems.filter((i) => i.category === cat);
        if (cat === "article") {
          catItems = [...catItems]
            .sort(
              (a, b) =>
                (a.openRank ?? Number.MAX_SAFE_INTEGER) -
                (b.openRank ?? Number.MAX_SAFE_INTEGER),
            )
            .slice(0, IDLE_ARTICLE_COUNT);
        }
        return catItems.length
          ? [{ label: CATEGORY_LABELS[cat], items: catItems }]
          : [];
      });
    } else {
      // Searching: one flat list ranked across every category — Raycast
      // style. Articles get a small freshness boost to break score ties.
      const scored: { item: RenderItem; score: number }[] = [];
      for (const item of commandItems) {
        const haystack = [item.keywords, item.description]
          .filter(Boolean)
          .join(" ");
        const match = scoreItem(trimmed, item.label, haystack);
        if (!match) continue;
        scored.push({
          item: { ...item, labelPositions: match.labelPositions },
          score:
            match.score + (item.recency ?? 0) * 6 + openBoost(item.openRank),
        });
      }
      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, MAX_RESULTS).map((s) => s.item);

      sections = results.length ? [{ label: "Results", items: results }] : [];

      // Body matches, as their own section below the client-ranked list. The
      // two orderings are deliberately NOT merged: BM25 relevance and the
      // fuzzy score aren't comparable numbers, and blending them would make
      // the top row jump around as the debounced query lands.
      const alreadyRanked = new Set(results.map((item) => item.id));
      const contentItems: RenderItem[] = (contentHits ?? [])
        .filter((hit) => !alreadyRanked.has(`article-${hit.documentId}`))
        .map((hit) => ({
          id: `content-${hit.documentId}`,
          label: hit.title,
          description: hit.snippet,
          icon: FileSearch,
          category: "article" as const,
          onSelect: () => {
            recordDocOpen(hit.documentId);
            onOpenChange(false);
            router.push(`/editor/${hit.documentId}`);
          },
        }));

      if (contentItems.length) {
        sections.push({ label: "In content", items: contentItems });
      }
    }

    return { sections, flatItems: sections.flatMap((s) => s.items) };
  }, [commandItems, query, contentHits, router, onOpenChange]);

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  // Mirror reactive state into refs so the native keydown listener (attached
  // once when the palette opens) always sees the latest values without
  // needing to be detached and re-attached on every render.
  const flatItemsRef = useRef(flatItems);
  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => {
    flatItemsRef.current = flatItems;
  }, [flatItems]);
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
            const len = flatItemsRef.current.length;
            if (len === 0) return 0;
            return prev < len - 1 ? prev + 1 : 0;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopImmediatePropagation();
          isKeyboardNav.current = true;
          setSelectedIndex((prev) => {
            const len = flatItemsRef.current.length;
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
          setSelectedIndex(Math.max(0, flatItemsRef.current.length - 1));
          break;
        case "Enter": {
          e.preventDefault();
          e.stopImmediatePropagation();
          const item = flatItemsRef.current[selectedIndexRef.current];
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
      if (flatItems.length === 0) return 0;
      return Math.min(prev, flatItems.length - 1);
    });
  }, [flatItems.length]);

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
  // Render
  // ---------------------------------------------------------------------------

  let runningIndex = 0;

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
              data-testid="command-palette"
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
                  placeholder="Search articles, projects, commands..."
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
                {flatItems.length === 0 && !contentPending ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground/70">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  sections.map((section) => (
                    <div key={section.label}>
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                        {section.label}
                      </p>
                      {section.items.map((item) => {
                        const globalIndex = runningIndex++;
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
                              const target = flatItems[globalIndex];
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
                                <HighlightedText
                                  text={item.label}
                                  positions={item.labelPositions}
                                />
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
                  ))
                )}

                {/* Body search lands after the client-side rows. Announce it
                    rather than letting results appear to pop in at random —
                    deliberately outside `flatItems`, so arrow keys and Enter
                    can never land on a row that isn't there yet. */}
                {contentPending && (
                  <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/60">
                    <FileSearch className="size-4 shrink-0 animate-pulse" />
                    <span>Searching content…</span>
                  </div>
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
                  {flatItems.length} result
                  {flatItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Match highlighting
// ---------------------------------------------------------------------------

/** Renders `text` with the fuzzy-matched characters emphasized. */
function HighlightedText({
  text,
  positions,
}: {
  text: string;
  positions?: number[] | undefined;
}) {
  if (!positions || positions.length === 0) return <>{text}</>;

  const matched = new Set(positions);
  const nodes: ReactNode[] = [];
  let start = 0;
  let inMatch = matched.has(0);

  const flush = (end: number) => {
    if (end === start) return;
    const chunk = text.slice(start, end);
    nodes.push(
      inMatch ? (
        <span key={start} className="text-primary">
          {chunk}
        </span>
      ) : (
        <Fragment key={start}>{chunk}</Fragment>
      ),
    );
    start = end;
  };

  for (let i = 1; i < text.length; i++) {
    const m = matched.has(i);
    if (m !== inMatch) {
      flush(i);
      inMatch = m;
    }
  }
  flush(text.length);

  return <>{nodes}</>;
}
