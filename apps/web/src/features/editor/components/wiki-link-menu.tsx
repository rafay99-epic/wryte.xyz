"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { usePaginatedQuery, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2 } from "lucide-react";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTriggerMenu } from "../hooks/use-slash-menu";
import { detectWikiTrigger } from "../lib/wiki-link";
import { useEditorContext } from "./editor-context";

type WikiLinkMenuProps = {
  projectId: Id<"projects"> | null;
  /** Current document — excluded from suggestions. */
  documentId: string;
};

const MENU_WIDTH = 280;
/** Rows fetched per page — more stream in as the list is scrolled. */
const PAGE_SIZE = 6;
const ITEM_HEIGHT = 48;
/** Visible height ≈ 6 rows; everything beyond scrolls (and lazy-loads). */
const MENU_MAX_HEIGHT = PAGE_SIZE * ITEM_HEIGHT + 10;
/** Debounce for the server-side title search. */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * `[[` internal-link menu: type `[[` to browse or search the project's
 * documents and insert a markdown link to one.
 *
 * Data flow is deliberately incremental: browsing pulls lean
 * id/title/slug pages of {@link PAGE_SIZE} rows and loads more as the
 * list scrolls toward the bottom; typing switches to the `search_title`
 * index (debounced). Both queries are gated on the menu being open, so
 * normal typing fires zero Convex calls.
 */
export const WikiLinkMenu = memo(function WikiLinkMenu({
  projectId,
  documentId,
}: WikiLinkMenuProps) {
  const { textareaRef, replaceRange } = useEditorContext();
  const menu = useTriggerMenu(
    textareaRef,
    projectId !== null,
    detectWikiTrigger,
    "[data-wiki-menu]",
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search term so the server query doesn't fire per keystroke.
  const [term, setTerm] = useState("");
  useEffect(() => {
    if (!menu.open) {
      setTerm("");
      return;
    }
    const id = setTimeout(() => setTerm(menu.query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [menu.open, menu.query]);

  const searching = term.length > 0;

  const browse = usePaginatedQuery(
    api.cms.documents.listForLink,
    menu.open && projectId && !searching ? { projectId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const searchDocs = useQuery(
    api.cms.documents.searchForLink,
    menu.open && projectId && searching ? { projectId, term } : "skip",
  );

  const results = useMemo(() => {
    // While the debounce is pending, filter the already-loaded rows so
    // typing feels instant; the server search replaces them right after.
    const liveQuery = menu.query.trim().toLowerCase();
    const source = searching
      ? (searchDocs ?? [])
      : browse.results.filter(
          (doc) =>
            !liveQuery ||
            doc.title.toLowerCase().includes(liveQuery) ||
            doc.slug.toLowerCase().includes(liveQuery),
        );
    return source.filter((doc) => doc._id !== documentId);
  }, [searching, searchDocs, browse.results, menu.query, documentId]);

  const isLoading = searching
    ? searchDocs === undefined
    : browse.status === "LoadingFirstPage";
  const isLoadingMore = !searching && browse.status === "LoadingMore";

  // Infinite scroll: pull the next page when the list nears its bottom.
  // Programmatic scrolls from keyboard navigation land here too, so
  // arrowing past the last loaded row also fetches more.
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (searching || browse.status !== "CanLoadMore") return;
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - ITEM_HEIGHT) {
        browse.loadMore(PAGE_SIZE);
      }
    },
    [searching, browse.status, browse.loadMore],
  );

  const insertLink = useCallback(
    (doc: { title: string; slug: string }) => {
      const m = menuRef.current;
      if (!m.open) return;
      replaceRange(m.queryStart, m.caretIndex, `[${doc.title}](/${doc.slug})`);
      menu.close();
    },
    [replaceRange, menu.close],
  );

  // Refs for the once-per-open keydown listener (same pattern as slash menu).
  const resultsRef = useRef(results);
  const selectedIndexRef = useRef(selectedIndex);
  const menuRef = useRef(menu);
  const insertLinkRef = useRef(insertLink);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);
  useEffect(() => {
    insertLinkRef.current = insertLink;
  }, [insertLink]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: menu.open/query are the reset triggers, not values read inside
  useEffect(() => {
    setSelectedIndex(0);
  }, [menu.open, menu.query]);

  // Keep the highlighted item visible when arrowing through the list —
  // scroll the menu container directly (same approach as the slash menu).
  useEffect(() => {
    const container = listRef.current;
    const el = container?.querySelector<HTMLElement>(
      `[data-index='${selectedIndex}']`,
    );
    if (!container || !el) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (elTop < viewTop) {
      container.scrollTo({ top: elTop - 4, behavior: "smooth" });
    } else if (elBottom > viewBottom) {
      container.scrollTo({
        top: elBottom - container.clientHeight + 4,
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!menu.open) return;
    const ta = textareaRef.current;
    if (!ta) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopImmediatePropagation();
          setSelectedIndex((p) => {
            const len = resultsRef.current.length;
            return len ? (p < len - 1 ? p + 1 : 0) : 0;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopImmediatePropagation();
          setSelectedIndex((p) => {
            const len = resultsRef.current.length;
            return len ? (p > 0 ? p - 1 : len - 1) : 0;
          });
          break;
        case "Enter":
        case "Tab": {
          const doc = resultsRef.current[selectedIndexRef.current];
          if (!doc) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          insertLinkRef.current(doc);
          break;
        }
        case "Escape":
          e.preventDefault();
          e.stopImmediatePropagation();
          menuRef.current.close();
          break;
      }
    }

    ta.addEventListener("keydown", handleKeyDown, true);
    return () => ta.removeEventListener("keydown", handleKeyDown, true);
  }, [menu.open, textareaRef]);

  if (typeof document === "undefined") return null;

  let overlay: ReactNode = null;
  if (menu.open && menu.position) {
    const { caretTop, caretLeft, caretHeight } = menu.position;
    const itemCount = Math.max(results.length, 1);
    const menuHeight = Math.min(MENU_MAX_HEIGHT, itemCount * ITEM_HEIGHT + 10);
    const belowTop = caretTop + caretHeight;
    const flipAbove = belowTop + menuHeight > window.innerHeight - 8;
    const top = flipAbove ? Math.max(8, caretTop - menuHeight) : belowTop;
    const left = Math.max(
      8,
      Math.min(caretLeft, window.innerWidth - MENU_WIDTH - 8),
    );

    overlay = (
      <motion.div
        key="wiki-link-menu"
        ref={listRef}
        data-wiki-menu
        initial={{ opacity: 0, y: -4, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.97 }}
        transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
        style={{
          top,
          left,
          width: MENU_WIDTH,
          maxHeight: MENU_MAX_HEIGHT,
          transformOrigin: flipAbove ? "bottom center" : "top center",
        }}
        onScroll={handleScroll}
        className="fixed z-50 overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-popover p-1 shadow-lg slim-scrollbar"
      >
        {isLoading ? (
          <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground/60">
            <Loader2 className="size-3.5 animate-spin" />
            {searching ? "Searching…" : "Loading documents…"}
          </p>
        ) : results.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground/60">
            No matching documents
          </p>
        ) : (
          results.map((doc, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={doc._id}
                type="button"
                data-index={index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertLink(doc)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                  selected ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-foreground">
                    {doc.title || "Untitled"}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground/60">
                    /{doc.slug}
                  </span>
                </span>
              </button>
            );
          })
        )}
        {isLoadingMore && (
          <p className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] text-muted-foreground/50">
            <Loader2 className="size-3 animate-spin" />
            Loading more…
          </p>
        )}
      </motion.div>
    );
  }

  return createPortal(
    <AnimatePresence>{overlay}</AnimatePresence>,
    document.body,
  );
});
