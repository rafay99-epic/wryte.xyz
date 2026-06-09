"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  Braces,
  Code,
  Gauge,
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
  Redo2,
  ScrollText,
  Sparkles,
  Strikethrough,
  Type,
  Undo2,
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
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AiEnhanceButton } from "./ai-enhance-button";
import { useEditorContext } from "./editor-context";
import { ImageInsertDialog } from "./image-insert-dialog";

type EditorToolbarProps = {
  documentId: string;
  projectId: string;
  readabilityEnabled?: boolean;
};

type ViewMode = "edit" | "split" | "preview";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "edit", label: "Write" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Read" },
];

/**
 * Toolbar matching Seospace reference layout:
 * Left: Undo/Redo + Text dropdown + formatting buttons
 * Right: Word count + View mode switcher + AI Assistant button
 */
export function EditorToolbar({
  documentId,
  projectId,
  readabilityEnabled = false,
}: EditorToolbarProps) {
  const {
    viewMode,
    setViewMode,
    content,
    researchPanelOpen,
    toggleResearchPanel,
    readabilityPanelOpen,
    toggleReadabilityPanel,
  } = useEditorStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      content: state.content,
      researchPanelOpen: state.researchPanelOpen,
      toggleResearchPanel: state.toggleResearchPanel,
      readabilityPanelOpen: state.readabilityPanelOpen,
      toggleReadabilityPanel: state.toggleReadabilityPanel,
    })),
  );
  const { insertAtCursor, wrapSelection } = useEditorContext();

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Gate the AI Assistant pill: hide entirely until the project has a
  // provider + model + active credential. Surfaces only through the AI
  // settings tab; clicking a non-functional button is the wrong UX.
  const aiReadiness = useQuery(api.ai.enhance.isAiReady, {
    projectId: projectId as Id<"projects">,
  });
  const aiReady = aiReadiness?.ready ?? false;

  // Word count
  const stats = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return { words: 0, readTime: 0 };
    const words = trimmed.split(/\s+/).length;
    return {
      words,
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
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background px-3 py-1.5">
        {/* ── Left: Formatting tools ── */}
        <TooltipProvider>
          <div className="flex items-center gap-0.5">
            {/* Undo / Redo */}
            <ToolbarButton
              icon={Undo2}
              tooltip="Undo (Ctrl+Z)"
              onClick={() => document.execCommand("undo")}
            />
            <ToolbarButton
              icon={Redo2}
              tooltip="Redo (Ctrl+Y)"
              onClick={() => document.execCommand("redo")}
            />

            <ToolbarDivider />

            {/* Text type dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground hover:text-foreground"
                        />
                      }
                    >
                      <Type className="size-3.5" />
                      <span className="text-xs">Text</span>
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent>Block type</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => insertAtCursor("\n# ")}>
                  <Heading1 className="size-4 mr-2" />
                  <span className="font-semibold">Heading 1</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtCursor("\n## ")}>
                  <Heading2 className="size-4 mr-2" />
                  <span className="font-semibold text-[0.95em]">Heading 2</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtCursor("\n### ")}>
                  <Heading3 className="size-4 mr-2" />
                  <span className="font-semibold text-[0.9em]">Heading 3</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtCursor("")}>
                  <Type className="size-4 mr-2" />
                  <span>Paragraph</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarDivider />

            {/* Text formatting */}
            <ToolbarButton
              icon={Highlighter}
              tooltip="Highlight"
              onClick={handleHighlight}
            />
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

            <ToolbarDivider />

            {/* Lists & blocks */}
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

            <ToolbarDivider />

            {/* Insert */}
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
        </TooltipProvider>

        {/* ── Right: Stats + View mode + AI ── */}
        <div className="flex items-center gap-2">
          {/* Word count */}
          <AnimatePresence mode="wait">
            {stats.words > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden text-[11px] tabular-nums text-muted-foreground/60 lg:inline"
              >
                {stats.words.toLocaleString()} words
              </motion.span>
            )}
          </AnimatePresence>

          {/* View mode switcher */}
          <div className="relative flex items-center rounded-lg border border-border/50 bg-muted/40 p-0.5">
            <motion.div
              className="absolute inset-y-0.5 rounded-md bg-background shadow-sm border border-border/40"
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
                  "relative z-10 rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-200",
                  viewMode === mode.value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {readabilityEnabled && (
            <button
              type="button"
              onClick={toggleReadabilityPanel}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]",
                readabilityPanelOpen
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Gauge className="size-3.5" />
              <span>Readability</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleResearchPanel}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]",
              researchPanelOpen
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <ScrollText className="size-3.5" />
            <span>Research</span>
          </button>

          {aiReady && (
            <button
              type="button"
              onClick={() => setAiDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
            >
              <Sparkles className="size-3.5" />
              <span>AI Assistant</span>
            </button>
          )}
        </div>
      </div>

      <ImageInsertDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={handleImageInsert}
        documentId={documentId}
        projectId={projectId}
      />

      {aiReady && (
        <AiEnhanceButton
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          projectId={projectId}
        />
      )}
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
            className="text-muted-foreground hover:bg-muted hover:text-foreground active:scale-90 transition-all"
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
  return <div className="mx-1 h-4 w-px bg-border/50" />;
}
