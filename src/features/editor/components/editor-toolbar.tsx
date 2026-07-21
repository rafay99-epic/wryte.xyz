"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  Braces,
  Clapperboard,
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
  ListTree,
  MessageCircle,
  Minus,
  Plus,
  Quote,
  Redo2,
  ScrollText,
  Sparkles,
  Strikethrough,
  TextSearch,
  Type,
  Undo2,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { countWords } from "@/lib/word-count";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AiEnhanceButton } from "./ai-enhance-button";
import { useEditorContext } from "./editor-context";
import { SprintControl } from "./sprint-control";

type EditorToolbarProps = {
  projectId: string;
  readabilityEnabled?: boolean;
  /** MDX project with an animationsPath configured — shows "Animation…" in Insert. */
  animationsEnabled?: boolean;
};

type ViewMode = "edit" | "split" | "preview";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "edit", label: "Write" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Read" },
];

/**
 * Editor toolbar, kept deliberately sparse:
 * Left: undo/redo, block-type dropdown, core formatting, one Insert menu
 *       (lists, blocks, link, media), find & replace.
 * Right: word count, view switcher, icon-only panel toggles, AI Assistant.
 * Everything that used to be a dedicated button still exists — lists,
 * quote, divider, code, link, image, video all live in the Insert menu
 * (and most have slash-command equivalents).
 */
export function EditorToolbar({
  projectId,
  readabilityEnabled = false,
  animationsEnabled = false,
}: EditorToolbarProps) {
  const {
    viewMode,
    setViewMode,
    content,
    researchPanelOpen,
    toggleResearchPanel,
    readabilityPanelOpen,
    toggleReadabilityPanel,
    outlinePanelOpen,
    toggleOutlinePanel,
    setFindReplaceOpen,
    setImageDialogOpen,
    setVideoDialogOpen,
    setEmbedDialogOpen,
    setAnimationDialogOpen,
  } = useEditorStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
      content: state.content,
      researchPanelOpen: state.researchPanelOpen,
      toggleResearchPanel: state.toggleResearchPanel,
      readabilityPanelOpen: state.readabilityPanelOpen,
      toggleReadabilityPanel: state.toggleReadabilityPanel,
      outlinePanelOpen: state.outlinePanelOpen,
      toggleOutlinePanel: state.toggleOutlinePanel,
      setFindReplaceOpen: state.setFindReplaceOpen,
      setImageDialogOpen: state.setImageDialogOpen,
      setVideoDialogOpen: state.setVideoDialogOpen,
      setEmbedDialogOpen: state.setEmbedDialogOpen,
      setAnimationDialogOpen: state.setAnimationDialogOpen,
    })),
  );
  const { insertAtCursor, wrapSelection } = useEditorContext();

  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Gate the AI Assistant pill: hide entirely until the project has a
  // provider + model + active credential. Surfaces only through the AI
  // settings tab; clicking a non-functional button is the wrong UX.
  const aiReadiness = useQuery(api.ai.enhance.isAiReady, {
    projectId: projectId as Id<"projects">,
  });
  const aiReady = aiReadiness?.ready ?? false;

  // Today's words / streak / goal — one lean indexed read, kept fresh by
  // the same saves that update it.
  const writingStats = useQuery(api.analytics.writingStats.getEditorStats, {});
  const sessionStartWords = useEditorStore((s) => s.sessionStartWords);

  // Word count
  const stats = useMemo(() => {
    const words = countWords(content);
    if (words === 0) return { words: 0, readTime: 0 };
    return {
      words,
      readTime: Math.max(1, Math.ceil(words / 238)),
    };
  }, [content]);
  const sessionWords = Math.max(0, stats.words - sessionStartWords);

  return (
    <TooltipProvider>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background px-3 py-1.5">
        {/* ── Left: Formatting tools ── */}
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

          {/* Core text formatting — the only always-visible buttons */}
          <ToolbarButton
            icon={Bold}
            tooltip="Bold (Ctrl+B)"
            onClick={() => wrapSelection("**", "**")}
          />
          <ToolbarButton
            icon={Italic}
            tooltip="Italic (Ctrl+I)"
            onClick={() => wrapSelection("*", "*")}
          />
          <ToolbarButton
            icon={Strikethrough}
            tooltip="Strikethrough"
            onClick={() => wrapSelection("~~", "~~")}
          />
          <ToolbarButton
            icon={Highlighter}
            tooltip="Highlight"
            onClick={() => wrapSelection("==", "==")}
          />

          <ToolbarDivider />

          {/* Insert menu — lists, blocks, link, media */}
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
                    <Plus className="size-3.5" />
                    <span className="text-xs">Insert</span>
                  </DropdownMenuTrigger>
                }
              />
              <TooltipContent>Insert block or media</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              <DropdownMenuItem onClick={() => wrapSelection("[", "](url)")}>
                <Link className="size-4 mr-2" />
                <span>Link</span>
                <DropdownMenuShortcut>Ctrl+K</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImageDialogOpen(true)}>
                <ImagePlus className="size-4 mr-2" />
                <span>Image…</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVideoDialogOpen(true)}>
                <Video className="size-4 mr-2" />
                <span>Video…</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEmbedDialogOpen(true)}>
                <MessageCircle className="size-4 mr-2" />
                <span>Post embed…</span>
              </DropdownMenuItem>
              {animationsEnabled && (
                <DropdownMenuItem onClick={() => setAnimationDialogOpen(true)}>
                  <Clapperboard className="size-4 mr-2" />
                  <span>Animation…</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => insertAtCursor("\n- ")}>
                <List className="size-4 mr-2" />
                <span>Bullet list</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertAtCursor("\n1. ")}>
                <ListOrdered className="size-4 mr-2" />
                <span>Numbered list</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertAtCursor("\n> ")}>
                <Quote className="size-4 mr-2" />
                <span>Blockquote</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertAtCursor("\n---\n")}>
                <Minus className="size-4 mr-2" />
                <span>Divider</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => wrapSelection("`", "`")}>
                <Code className="size-4 mr-2" />
                <span>Inline code</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => insertAtCursor("\n```\n\n```\n")}
              >
                <Braces className="size-4 mr-2" />
                <span>Code block</span>
                <DropdownMenuShortcut>Ctrl+Shift+K</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolbarDivider />

          <ToolbarButton
            icon={TextSearch}
            tooltip="Find & replace (Ctrl+F)"
            onClick={() => setFindReplaceOpen(true)}
          />
        </div>

        {/* ── Right: Stats + View mode + Panels + AI ── */}
        <div className="flex items-center gap-2">
          {/* Word count + session stats */}
          <AnimatePresence mode="wait">
            {stats.words > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hidden cursor-default text-[11px] tabular-nums text-muted-foreground/60 lg:inline"
                    />
                  }
                >
                  {stats.words.toLocaleString()} words
                  {sessionWords > 0 && (
                    <span className="ml-1 font-medium text-emerald-600/80">
                      +{sessionWords.toLocaleString()}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <span className="tabular-nums">
                    {sessionWords.toLocaleString()} words this session
                    {writingStats && (
                      <>
                        {" · "}
                        {writingStats.wordsToday.toLocaleString()} today
                        {writingStats.dailyWordGoal !== null &&
                          ` / ${writingStats.dailyWordGoal.toLocaleString()} goal`}
                        {writingStats.currentStreak > 0 &&
                          ` · ${writingStats.currentStreak}-day streak`}
                      </>
                    )}
                  </span>
                </TooltipContent>
              </Tooltip>
            )}
          </AnimatePresence>

          {/* Writing sprint */}
          <SprintControl />

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

          {/* Side-panel toggles — icon-only to keep the bar light */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5">
            <PanelToggle
              icon={ListTree}
              tooltip="Outline"
              active={outlinePanelOpen}
              onClick={toggleOutlinePanel}
            />
            {readabilityEnabled && (
              <PanelToggle
                icon={Gauge}
                tooltip="Readability"
                active={readabilityPanelOpen}
                onClick={toggleReadabilityPanel}
              />
            )}
            <PanelToggle
              icon={ScrollText}
              tooltip="Research"
              active={researchPanelOpen}
              onClick={toggleResearchPanel}
            />
          </div>

          {aiReady && (
            <button
              type="button"
              onClick={() => setAiDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden xl:inline">AI Assistant</span>
              <span className="xl:hidden">AI</span>
            </button>
          )}
        </div>
      </div>

      {aiReady && (
        <AiEnhanceButton
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          projectId={projectId}
        />
      )}
    </TooltipProvider>
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

function PanelToggle({
  icon: Icon,
  tooltip,
  active,
  onClick,
}: {
  icon: React.ElementType;
  tooltip: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={tooltip}
            aria-pressed={active}
            className={cn(
              "rounded-md p-1.5 transition-all active:scale-[0.95]",
              active
                ? "bg-background text-primary shadow-sm border border-border/40"
                : "text-muted-foreground hover:text-foreground",
            )}
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
