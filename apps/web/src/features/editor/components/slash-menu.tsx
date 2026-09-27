"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
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
import { useSlashMenu } from "../hooks/use-slash-menu";
import {
  ANIMATION_COMMAND,
  filterCommands,
  SLASH_COMMANDS,
  type SlashCommand,
  SNIPPETS_SUBMENU,
  snippetCommands,
} from "../lib/slash/commands";
import { useEditorContext } from "./editor-context";

type SlashMenuProps = {
  blockCommandsEnabled: boolean;
  snippetsEnabled: boolean;
  hasSnippets: boolean;
  animationsEnabled: boolean;
  projectId: Id<"projects"> | null;
  aiReady: boolean;
  onAiAction: (caretIndex: number) => void;
};

const MENU_WIDTH = 240;
const MENU_MAX_HEIGHT = 300;
const SEARCH_DEBOUNCE_MS = 200;

export const SlashMenu = memo(function SlashMenu({
  blockCommandsEnabled,
  snippetsEnabled,
  hasSnippets,
  animationsEnabled,
  projectId,
  aiReady,
  onAiAction,
}: SlashMenuProps) {
  const { textareaRef, replaceRange } = useEditorContext();
  const menuActive = blockCommandsEnabled || snippetsEnabled;
  const menu = useSlashMenu(textareaRef, menuActive);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [level, setLevel] = useState<"root" | "snippets">("root");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu.open) setLevel("root");
  }, [menu.open]);

  const [term, setTerm] = useState("");
  useEffect(() => {
    const q = menu.query;
    const id = setTimeout(() => setTerm(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [menu.query]);

  const snippetDocs = useQuery(
    api.cms.snippets.search,
    level === "snippets" && snippetsEnabled && projectId
      ? { projectId, term }
      : "skip",
  );
  const snippetCmds = useMemo(
    () => snippetCommands(snippetDocs ?? []),
    [snippetDocs],
  );
  const loading = level === "snippets" && snippetDocs === undefined;

  const commands = useMemo(() => {
    if (level === "snippets") {
      return snippetCmds;
    }
    const base: SlashCommand[] = [];
    if (blockCommandsEnabled) {
      base.push(
        ...(aiReady
          ? SLASH_COMMANDS
          : SLASH_COMMANDS.filter((c) => c.kind !== "ai")),
      );
      if (animationsEnabled) {
        base.push(ANIMATION_COMMAND);
      }
    }
    if (snippetsEnabled && hasSnippets) {
      base.push(SNIPPETS_SUBMENU);
    }
    return filterCommands(base, menu.query);
  }, [
    level,
    snippetCmds,
    blockCommandsEnabled,
    aiReady,
    snippetsEnabled,
    hasSnippets,
    animationsEnabled,
    menu.query,
  ]);

  const commandsRef = useRef(commands);
  const selectedIndexRef = useRef(selectedIndex);
  const menuRef = useRef(menu);
  const levelRef = useRef(level);
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: menu.open/query/level are the triggers, not values read inside the effect
  useEffect(() => {
    setSelectedIndex(0);
  }, [menu.open, menu.query, level]);

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

  const enterSnippets = useCallback(() => {
    const m = menuRef.current;
    if (m.caretIndex > m.queryStart + 1) {
      replaceRange(m.queryStart + 1, m.caretIndex, "");
    }
    setTerm("");
    setLevel("snippets");
  }, [replaceRange]);

  const runCommand = useCallback(
    (cmd: SlashCommand) => {
      const ta = textareaRef.current;
      const m = menuRef.current;
      if (!ta || !m.open) return;
      const value = ta.value;
      if (cmd.kind === "submenu") {
        enterSnippets();
        return;
      }
      if (cmd.kind === "ai") {
        replaceRange(m.queryStart, m.caretIndex, "");
        onAiAction(m.queryStart);
      } else if (
        cmd.kind === "image" ||
        cmd.kind === "video" ||
        cmd.kind === "embed" ||
        cmd.kind === "animation"
      ) {
        replaceRange(m.queryStart, m.caretIndex, "");
        const store = useEditorStore.getState();
        if (cmd.kind === "image") store.setImageDialogOpen(true);
        else if (cmd.kind === "video") store.setVideoDialogOpen(true);
        else if (cmd.kind === "animation") store.setAnimationDialogOpen(true);
        else store.setEmbedDialogOpen(true);
      } else if (cmd.kind === "block" || cmd.kind === "snippet") {
        const needsNewline =
          m.queryStart > 0 && value[m.queryStart - 1] !== "\n";
        replaceRange(
          m.queryStart,
          m.caretIndex,
          (needsNewline ? "\n" : "") + (cmd.insert ?? ""),
        );
      } else {
        replaceRange(m.queryStart, m.caretIndex, cmd.insert ?? "");
      }
      menu.close();
    },
    [replaceRange, onAiAction, menu.close, textareaRef, enterSnippets],
  );
  const runCommandRef = useRef(runCommand);
  useEffect(() => {
    runCommandRef.current = runCommand;
  }, [runCommand]);

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
            const len = commandsRef.current.length;
            return len ? (p < len - 1 ? p + 1 : 0) : 0;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopImmediatePropagation();
          setSelectedIndex((p) => {
            const len = commandsRef.current.length;
            return len ? (p > 0 ? p - 1 : len - 1) : 0;
          });
          break;
        case "ArrowRight": {
          const cmd = commandsRef.current[selectedIndexRef.current];
          if (cmd?.kind === "submenu") {
            e.preventDefault();
            e.stopImmediatePropagation();
            runCommandRef.current(cmd);
          }
          break;
        }
        case "ArrowLeft":
          if (levelRef.current === "snippets") {
            e.preventDefault();
            e.stopImmediatePropagation();
            setLevel("root");
          }
          break;
        case "Backspace":
          if (levelRef.current === "snippets" && menuRef.current.query === "") {
            e.preventDefault();
            e.stopImmediatePropagation();
            setLevel("root");
          }
          break;
        case "Enter":
        case "Tab": {
          const cmd = commandsRef.current[selectedIndexRef.current];
          if (!cmd) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          runCommandRef.current(cmd);
          break;
        }
        case "Escape":
          e.preventDefault();
          e.stopImmediatePropagation();
          menu.close();
          break;
      }
    }

    ta.addEventListener("keydown", handleKeyDown, true);
    return () => ta.removeEventListener("keydown", handleKeyDown, true);
  }, [menu.open, menu.close, textareaRef]);

  if (!menuActive || typeof document === "undefined") return null;

  let overlay: ReactNode = null;
  if (menu.open && menu.position) {
    const { caretTop, caretLeft, caretHeight } = menu.position;
    const itemCount = commands.length || 1;
    const backRow = level === "snippets" ? 30 : 0;
    const menuHeight = Math.min(MENU_MAX_HEIGHT, itemCount * 34 + 10 + backRow);
    const belowTop = caretTop + caretHeight;
    const flipAbove = belowTop + menuHeight > window.innerHeight - 8;
    const top = flipAbove ? Math.max(8, caretTop - menuHeight) : belowTop;
    const left = Math.max(
      8,
      Math.min(caretLeft, window.innerWidth - MENU_WIDTH - 8),
    );

    overlay = (
      <motion.div
        key="slash-menu"
        ref={listRef}
        data-slash-menu
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
        className="fixed z-50 overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-popover p-1 shadow-lg slim-scrollbar"
      >
        {level === "snippets" && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLevel("root")}
            className="mb-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-muted/50"
          >
            <ChevronLeft className="size-3.5" />
            Snippets
          </button>
        )}

        {loading ? (
          <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground/60">
            <Loader2 className="size-3.5 animate-spin" />
            Searching…
          </p>
        ) : commands.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground/60">
            {level === "snippets" ? "No snippets" : "No matches"}
          </p>
        ) : (
          commands.map((cmd, index) => {
            const Icon = cmd.icon;
            const selected = index === selectedIndex;
            return (
              <button
                key={cmd.id}
                type="button"
                data-index={index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                  selected
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">
                  {cmd.label}
                </span>
                {cmd.hint && (
                  <span className="text-[10px] text-muted-foreground/50">
                    {cmd.hint}
                  </span>
                )}
              </button>
            );
          })
        )}
      </motion.div>
    );
  }

  return createPortal(
    <AnimatePresence>{overlay}</AnimatePresence>,
    document.body,
  );
});
