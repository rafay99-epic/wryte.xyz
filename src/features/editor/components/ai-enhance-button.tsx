"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/* ------------------------------------------------------------------ */
/*  Model display names                                                */
/* ------------------------------------------------------------------ */

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-sonnet-4-20250514": "Claude Sonnet 4",
  "claude-haiku-4-20250414": "Claude Haiku 4",
  "gpt-4.1": "GPT-4.1",
  "gpt-4.1-mini": "GPT-4.1 Mini",
  "gpt-4.1-nano": "GPT-4.1 Nano",
  "google/gemma-4-26b-a4b-it:free": "Gemma 4 26B",
  "google/gemma-4-31b-it:free": "Gemma 4 31B",
  "minimax/minimax-m2.5:free": "MiniMax M2.5",
  "openai/gpt-oss-120b:free": "GPT-OSS 120B",
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

/* ------------------------------------------------------------------ */
/*  System prompt (read-only display)                                  */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are an expert writing editor. Improve the provided markdown content while preserving the author's voice, intent, and meaning.

Guidelines:
- Fix grammar, spelling, and punctuation errors
- Improve sentence structure and flow
- Enhance clarity and readability
- Maintain the original tone and style
- Preserve all markdown formatting (headings, links, lists, code blocks, etc.)
- Do not add new sections or substantially change the content's meaning
- Do not add commentary, explanations, or meta-text
- Return ONLY the improved markdown content, nothing else
- If the content is already well-written, make minimal changes`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type AiEnhancePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
};

export function AiEnhanceButton({
  open,
  onOpenChange,
  projectId,
}: AiEnhancePanelProps) {
  const { content, setContent } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      setContent: state.setContent,
    })),
  );

  const project = useQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const createEnhanceStream = useMutation(api.ai.enhance.createEnhanceStream);

  const [streamId, setStreamId] = useState<string | undefined>(undefined);
  const [originalContent, setOriginalContent] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [originalExpanded, setOriginalExpanded] = useState(false);

  // Query the stream body reactively — auto-updates as chunks arrive
  const streamBody = useQuery(
    api.ai.enhance.getStreamBody,
    streamId ? { streamId } : "skip",
  );

  const streamStatus = streamBody?.status ?? "pending";
  const streamText = streamBody?.text ?? "";

  // Auto-scroll the enhanced content as it streams in
  const enhancedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streamStatus === "streaming" && enhancedRef.current) {
      enhancedRef.current.scrollTop = enhancedRef.current.scrollHeight;
    }
  }, [streamStatus]);

  // Determine if panel has active content that would be lost on close
  const hasActiveContent = !!(
    streamId &&
    (streamText || streamStatus === "streaming" || streamStatus === "pending")
  );
  const isDone = streamStatus === "done";
  const isError = streamStatus === "error";
  const isStreaming =
    streamStatus === "streaming" || streamStatus === "pending";

  // Guard against accidental close when streaming or results are ready
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && hasActiveContent && !isError) {
        // Block accidental dismiss (backdrop click, Escape key)
        // User must explicitly Apply or Reject
        toast("Use Apply or Reject to close", {
          description: "Your AI-generated content will be lost if dismissed.",
          duration: 2500,
        });
        return;
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, hasActiveContent, isError],
  );

  // Explicit close (when user clicks X while no content, or after apply/reject)
  const handleExplicitClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Reset state when panel closes
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setStreamId(undefined);
      setOriginalContent("");
      setPromptExpanded(false);
      setOriginalExpanded(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [open]);

  const handleEnhance = useCallback(async () => {
    if (!content.trim()) {
      toast.error("No content to enhance");
      return;
    }

    setOriginalContent(content);

    try {
      const result = await createEnhanceStream({
        projectId: projectId as Id<"projects">,
        content,
      });
      setStreamId(result.streamId);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? "Failed to start enhancement");
    }
  }, [content, createEnhanceStream, projectId]);

  const handleApply = useCallback(() => {
    if (streamText) {
      setContent(streamText);
      toast.success("Changes applied — undo with Ctrl+Z");
      handleExplicitClose();
    }
  }, [streamText, setContent, handleExplicitClose]);

  const handleReject = useCallback(() => {
    setStreamId(undefined);
    setOriginalContent("");
    toast("Changes discarded");
  }, []);

  const handleRetry = useCallback(() => {
    setStreamId(undefined);
    void handleEnhance();
  }, [handleEnhance]);

  const handleCopy = useCallback(() => {
    if (streamText) {
      void navigator.clipboard.writeText(streamText);
      toast.success("Copied to clipboard");
    }
  }, [streamText]);

  const isConfigured = !!(project?.aiProvider && project?.aiModel);

  const providerName = project?.aiProvider
    ? (PROVIDER_DISPLAY_NAMES[project.aiProvider] ?? project.aiProvider)
    : "";
  const modelName = project?.aiModel
    ? (MODEL_DISPLAY_NAMES[project.aiModel] ?? project.aiModel)
    : "";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={!hasActiveContent || isError}
        className="max-w-2xl w-[min(42rem,100vw)]"
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="size-4.5 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-lg">AI Enhancement</SheetTitle>
              {isConfigured && (
                <SheetDescription className="mt-0.5 text-[13px]">
                  Using {modelName} via {providerName}
                </SheetDescription>
              )}
            </div>
            {isConfigured && (
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                {providerName}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <SheetBody className="space-y-4">
          {/* Not configured state */}
          {project && !isConfigured && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 rounded-xl border border-border/40 bg-muted/30 px-8 py-14 text-center"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10">
                <AlertCircle className="size-6 text-amber-500" />
              </div>
              <div>
                <p className="text-base font-medium">No AI model configured</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Go to Project Settings → AI to select a provider and model.
                </p>
              </div>
            </motion.div>
          )}

          {/* Configured state */}
          {isConfigured && (
            <>
              {/* System prompt (collapsible) */}
              <div className="rounded-xl border border-border/40 bg-muted/20">
                <button
                  type="button"
                  onClick={() => setPromptExpanded(!promptExpanded)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>System Prompt</span>
                  {promptExpanded ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                <AnimatePresence>
                  {promptExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/40 px-4 py-3">
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground/80">
                          {SYSTEM_PROMPT}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Pre-enhancement: Content preview ── */}
              {!streamId && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-medium text-muted-foreground">
                    Your Content
                  </p>
                  <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border/40 bg-muted/20 px-5 py-4 slim-scrollbar">
                    <div className="whitespace-pre-wrap text-sm leading-[1.75] text-foreground/85">
                      {content.length > 3000
                        ? `${content.slice(0, 3000)}…`
                        : content || "No content to enhance."}
                    </div>
                  </div>
                  <p className="text-[13px] text-muted-foreground/60">
                    The AI will improve formatting, grammar, and clarity while
                    preserving your voice. This can be undone with Ctrl+Z.
                  </p>

                  <Button
                    onClick={() => void handleEnhance()}
                    disabled={!content.trim()}
                    className="w-full mt-1"
                    size="lg"
                  >
                    <Sparkles className="size-4" />
                    Enhance Content
                  </Button>
                </motion.div>
              )}

              {/* ── Post-enhancement: Original + Enhanced ── */}
              {streamId && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3"
                >
                  {/* Original (collapsible) */}
                  <div className="rounded-xl border border-border/40 bg-muted/20">
                    <button
                      type="button"
                      onClick={() => setOriginalExpanded(!originalExpanded)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span>Original Content</span>
                      {originalExpanded ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    <AnimatePresence>
                      {originalExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="max-h-[30vh] overflow-y-auto border-t border-border/40 px-5 py-4 slim-scrollbar">
                            <div className="whitespace-pre-wrap text-sm leading-[1.75] text-muted-foreground/70">
                              {originalContent}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Enhanced version — main focus area */}
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          Enhanced Version
                        </p>
                        {isStreaming && streamText.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-1.5"
                          >
                            <div className="size-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs text-muted-foreground/60">
                              streaming…
                            </span>
                          </motion.div>
                        )}
                        {isDone && (
                          <Badge
                            variant="secondary"
                            className="text-xs text-emerald-600 bg-emerald-500/10 px-2"
                          >
                            <Check className="size-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                      </div>
                      {isDone && streamText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="text-muted-foreground hover:text-foreground h-7 px-2"
                        >
                          <Copy className="size-3.5" />
                          <span className="text-xs">Copy</span>
                        </Button>
                      )}
                    </div>

                    <div
                      ref={enhancedRef}
                      className="flex-1 max-h-[55vh] overflow-y-auto rounded-xl border border-border/40 bg-background px-5 py-4 slim-scrollbar"
                    >
                      {isStreaming && !streamText ? (
                        <div className="flex flex-col items-center gap-3 py-12">
                          <Loader2 className="size-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            Generating enhancement…
                          </span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-[15px] leading-[1.8] text-foreground/90">
                          {streamText}
                          {isStreaming && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                              }}
                              className="inline-block w-0.5 h-[18px] bg-primary ml-0.5 align-middle rounded-full"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Error state */}
                  {isError && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"
                    >
                      <AlertCircle className="size-5 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-600">
                          Enhancement failed
                        </p>
                        <p className="text-[13px] text-red-500/70 mt-0.5">
                          An error occurred while generating the enhancement.
                          Please try again.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        className="shrink-0"
                      >
                        <RotateCcw className="size-3.5" />
                        Retry
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </SheetBody>

        {/* Footer with Apply/Reject — visible when done or streaming */}
        {streamId && !isError && (
          <SheetFooter className="justify-between">
            <Button
              variant="outline"
              onClick={handleReject}
              className="gap-1.5"
            >
              <X className="size-4" />
              Reject
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isDone || !streamText}
              className="gap-1.5"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Apply Changes
                </>
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
