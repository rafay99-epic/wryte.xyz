"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  Braces,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Strikethrough,
  Type,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { AiEnhanceButton } from "./ai-enhance-button";
import { useEditorContext } from "./editor-context";
import { ImageInsertDialog } from "./image-insert-dialog";

interface EditorToolbarProps {
  projectId: string;
}

type ViewMode = "edit" | "split" | "preview";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "edit", label: "Write" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Read" },
];

/**
 * Redesigned floating editor toolbar with grouped formatting controls,
 * an animated view mode switcher with a sliding pill indicator,
 * word/char count, and an AI button with shimmer effect.
 */
export function EditorToolbar({ projectId }: EditorToolbarProps) {
  const { viewMode, setViewMode, content } = useEditorStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      content: state.content,
    })),
  );
  const { insertAtCursor, wrapSelection } = useEditorContext();

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Word & character count
  const stats = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return { words: 0, chars: 0, readTime: 0 };
    const words = trimmed.split(/\s+/).length;
    return {
      words,
      chars: trimmed.length,
      readTime: Math.max(1, Math.ceil(words / 238)),
    };
  }, [content]);

  function handleBold() {
    wrapSelection("**", "**");
  }
  function handleItalic() {
    wrapSelection("*", "*");
  }
  function handleStrikethrough() {
    wrapSelection("~~", "~~");
  }
  function handleHighlight() {
    wrapSelection("==", "==");
  }
  function handleLink() {
    wrapSelection("[", "](url)");
  }
  function handleInlineCode() {
    wrapSelection("`", "`");
  }
  function handleCodeBlock() {
    insertAtCursor("\n```\n\n```\n");
  }
  function handleList() {
    insertAtCursor("\n- ");
  }
  function handleOrderedList() {
    insertAtCursor("\n1. ");
  }
  function handleBlockquote() {
    insertAtCursor("\n> ");
  }
  function handleDivider() {
    insertAtCursor("\n---\n");
  }
  function handleImageInsert(markdown: string) {
    insertAtCursor(markdown);
  }

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2">
        {/* ── Left: Formatting tools ── */}
        <TooltipProvider>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-background/90 px-1.5 py-1 shadow-sm backdrop-blur-md"
          >
            {/* Text formatting group */}
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                icon={Bold}
                tooltip="Bold (Ctrl+B)"
                onClick={handleBold}
              />
              <ToolbarButton
                icon={Italic}
                tooltip="Italic (Ctrl+I)"
                onClick={handleItalic}
              />
              <ToolbarButton
                icon={Strikethrough}
                tooltip="Strikethrough"
                onClick={handleStrikethrough}
              />
              <ToolbarButton
                icon={Highlighter}
                tooltip="Highlight"
                onClick={handleHighlight}
              />
            </div>

            <ToolbarDivider />

            {/* Structure group */}
            <div className="flex items-center gap-0.5">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                          />
                        }
                      >
                        <Type className="size-3.5" />
                      </DropdownMenuTrigger>
                    }
                  />
                  <TooltipContent>Heading</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <DropdownMenuItem onClick={() => insertAtCursor("\n# ")}>
                    <Heading1 className="size-4 mr-2" />
                    <span className="font-semibold">Heading 1</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertAtCursor("\n## ")}>
                    <Heading2 className="size-4 mr-2" />
                    <span className="font-semibold text-[0.95em]">
                      Heading 2
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertAtCursor("\n### ")}>
                    <Heading3 className="size-4 mr-2" />
                    <span className="font-semibold text-[0.9em]">
                      Heading 3
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ToolbarButton
                icon={Link}
                tooltip="Link (Ctrl+K)"
                onClick={handleLink}
              />
              <ToolbarButton
                icon={ImagePlus}
                tooltip="Image"
                onClick={() => setImageDialogOpen(true)}
              />
            </div>

            <ToolbarDivider />

            {/* Block group */}
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                icon={Code}
                tooltip="Inline code"
                onClick={handleInlineCode}
              />
              <ToolbarButton
                icon={Braces}
                tooltip="Code block (Ctrl+Shift+K)"
                onClick={handleCodeBlock}
              />
              <ToolbarButton
                icon={List}
                tooltip="Bullet list"
                onClick={handleList}
              />
              <ToolbarButton
                icon={ListOrdered}
                tooltip="Numbered list"
                onClick={handleOrderedList}
              />
              <ToolbarButton
                icon={Quote}
                tooltip="Blockquote"
                onClick={handleBlockquote}
              />
              <ToolbarButton
                icon={Minus}
                tooltip="Divider"
                onClick={handleDivider}
              />
            </div>

            <ToolbarDivider />

            {/* AI button */}
            <button
              type="button"
              onClick={() => setAiDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-primary/10 active:scale-95"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span className="ai-shimmer font-semibold">AI</span>
            </button>
          </motion.div>
        </TooltipProvider>

        {/* ── Right: View mode + Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.25,
            delay: 0.05,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          className="flex items-center gap-3"
        >
          {/* Word count */}
          <AnimatePresence mode="wait">
            {stats.words > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex"
              >
                <span>{stats.words.toLocaleString()} words</span>
                <span className="text-border">·</span>
                <span>{stats.readTime} min read</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View mode switcher with sliding indicator */}
          <div className="relative flex items-center rounded-xl border border-border/60 bg-muted/50 p-0.5 backdrop-blur-md">
            {/* Animated background indicator */}
            <motion.div
              className="absolute inset-y-0.5 rounded-[10px] bg-background shadow-sm border border-border/40"
              layoutId="viewModeIndicator"
              style={{
                width: `${100 / VIEW_MODES.length}%`,
                left: `${(VIEW_MODES.findIndex((m) => m.value === viewMode) / VIEW_MODES.length) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setViewMode(mode.value)}
                className={cn(
                  "relative z-10 rounded-[10px] px-3 py-1 text-xs font-medium transition-colors duration-200",
                  viewMode === mode.value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <ImageInsertDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={handleImageInsert}
        projectId={projectId}
      />

      <AiEnhanceButton open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function ToolbarButton({
  icon: Icon,
  tooltip,
  onClick,
}: {
  icon: React.ElementType;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            className="text-muted-foreground hover:text-foreground active:scale-90 transition-all"
          />
        }
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-4 w-px bg-border/60" />;
}
