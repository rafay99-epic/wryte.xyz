"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getStreamErrorMessage } from "@/lib/stream-error";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SelectionSnapshot = {
  text: string;
  start: number;
  end: number;
};

type InlineAiPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: SelectionSnapshot | null;
  onAccept: (start: number, end: number, replacement: string) => void;
  /**
   * When set, the popover runs this instruction immediately on open
   * instead of waiting for the user to type one — the path used by the
   * selection toolbar's quick actions (Improve, Shorten, …).
   */
  presetInstruction?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InlineAiPopover({
  open,
  onOpenChange,
  selection,
  onAccept,
  presetInstruction = null,
}: InlineAiPopoverProps) {
  const activeProjectId = useEditorStore((s) => s.activeProjectId);

  const [instruction, setInstruction] = useState("");
  const [streamId, setStreamId] = useState<string | undefined>(undefined);
  const [selectionSnapshot, setSelectionSnapshot] =
    useState<SelectionSnapshot | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const templates = useQuery(
    api.ai.promptTemplates.getTemplates,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );

  const createInlineStream = useMutation(
    api.ai.enhance.createInlineEnhanceStream,
  );

  // Stream body (reactive)
  const streamBody = useQuery(
    api.ai.enhance.getStreamBody,
    streamId ? { streamId } : "skip",
  );

  const streamStatus = streamBody?.status ?? "pending";
  const streamText = streamBody?.text ?? "";

  const isStreaming =
    streamStatus === "streaming" || streamStatus === "pending";
  const isDone = streamStatus === "done";
  const isError = streamStatus === "error";

  // Capture selection when popover opens
  useEffect(() => {
    if (open && selection) {
      setSelectionSnapshot(selection);
      setInstruction("");
      setStreamId(undefined);
      // Focus the input on next tick
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, selection]);

  // Auto-scroll result as it streams
  useEffect(() => {
    if (isStreaming && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [isStreaming]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setInstruction("");
      setStreamId(undefined);
      setSelectionSnapshot(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [open]);

  const inlineSystemPrompt = templates?.find(
    (t) => t.id === "inline-transform",
  )?.prompt;

  const handleSubmit = useCallback(async () => {
    if (!instruction.trim() || !selectionSnapshot || !activeProjectId) return;

    try {
      const result = await createInlineStream({
        projectId: activeProjectId as Id<"projects">,
        selectedText: selectionSnapshot.text,
        instruction: instruction.trim(),
        ...(inlineSystemPrompt ? { systemPrompt: inlineSystemPrompt } : {}),
      });
      setStreamId(result.streamId);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? "Failed to start AI transformation");
    }
  }, [
    instruction,
    selectionSnapshot,
    activeProjectId,
    createInlineStream,
    inlineSystemPrompt,
  ]);

  // Auto-run a preset instruction (selection-toolbar quick actions) once
  // per open, as soon as the selection snapshot has been captured.
  const presetFiredRef = useRef(false);
  useEffect(() => {
    if (!open) {
      presetFiredRef.current = false;
      return;
    }
    if (
      presetFiredRef.current ||
      !presetInstruction ||
      !selectionSnapshot ||
      streamId
    ) {
      return;
    }
    presetFiredRef.current = true;
    setInstruction(presetInstruction);
    void (async () => {
      try {
        const result = await createInlineStream({
          projectId: activeProjectId as Id<"projects">,
          selectedText: selectionSnapshot.text,
          instruction: presetInstruction,
          ...(inlineSystemPrompt ? { systemPrompt: inlineSystemPrompt } : {}),
        });
        setStreamId(result.streamId);
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message ?? "Failed to start AI transformation");
      }
    })();
  }, [
    open,
    presetInstruction,
    selectionSnapshot,
    streamId,
    createInlineStream,
    activeProjectId,
    inlineSystemPrompt,
  ]);

  const handleTemplateClick = useCallback(
    async (prompt: string) => {
      if (!selectionSnapshot || !activeProjectId) return;
      setInstruction(prompt);
      try {
        const result = await createInlineStream({
          projectId: activeProjectId as Id<"projects">,
          selectedText: selectionSnapshot.text,
          instruction: prompt,
          ...(inlineSystemPrompt ? { systemPrompt: inlineSystemPrompt } : {}),
        });
        setStreamId(result.streamId);
      } catch (error: unknown) {
        const err = error as { message?: string };
        toast.error(err.message ?? "Failed to start AI transformation");
      }
    },
    [
      selectionSnapshot,
      activeProjectId,
      createInlineStream,
      inlineSystemPrompt,
    ],
  );

  const handleAccept = useCallback(() => {
    if (streamText && selectionSnapshot) {
      onAccept(selectionSnapshot.start, selectionSnapshot.end, streamText);
      toast.success("Changes applied");
      onOpenChange(false);
    }
  }, [streamText, selectionSnapshot, onAccept, onOpenChange]);

  const handleReject = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleRetry = useCallback(() => {
    setStreamId(undefined);
    void handleSubmit();
  }, [handleSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !streamId) {
        e.preventDefault();
        void handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [handleSubmit, onOpenChange, streamId],
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed left-1/2 top-20 z-50 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2"
        >
          <div className="rounded-xl border border-border/60 bg-popover shadow-xl ring-1 ring-black/5">
            {/* ── Template pills ── */}
            {!streamId && templates && templates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-3 py-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void handleTemplateClick(t.prompt)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    title={t.prompt}
                  >
                    <Sparkles className="size-3" />
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {/* ── Prompt input phase ── */}
            {!streamId && (
              <div className="flex items-center gap-2 p-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What should AI do with this text?"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                />
                <Button
                  size="sm"
                  onClick={() => void handleSubmit()}
                  disabled={!instruction.trim()}
                  className="h-8 gap-1.5 rounded-lg px-3"
                >
                  <Sparkles className="size-3.5" />
                  Transform
                </Button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* ── Selected text preview (shown below input when no stream) ── */}
            {!streamId && selectionSnapshot && (
              <div className="border-t border-border/40 px-4 py-2.5">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  Selected text
                </p>
                <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground/70">
                  {selectionSnapshot.text}
                </p>
              </div>
            )}

            {/* ── Streaming / result phase ── */}
            {streamId && (
              <div className="p-3">
                {/* Header with instruction */}
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {instruction}
                  </span>
                  <div className="flex-1" />
                  {isStreaming && streamText.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[11px] text-muted-foreground/50">
                        streaming
                      </span>
                    </div>
                  )}
                  {isDone && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                      <Check className="size-3" />
                      Done
                    </span>
                  )}
                </div>

                {/* Result content */}
                <div
                  ref={resultRef}
                  className="max-h-[40vh] overflow-y-auto rounded-lg border border-border/40 bg-background px-4 py-3 slim-scrollbar"
                >
                  {isStreaming && !streamText ? (
                    <div className="flex items-center gap-2 py-6 justify-center">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Transforming…
                      </span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-[1.75] text-foreground/90">
                      {streamText}
                      {isStreaming && (
                        <motion.span
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle rounded-full"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Error state */}
                {isError && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <AlertCircle className="size-4 text-red-500 shrink-0" />
                    <p className="flex-1 text-xs text-red-600">
                      {getStreamErrorMessage(
                        streamText,
                        "Transformation failed. Please try again.",
                      )}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      className="h-7 gap-1 px-2"
                    >
                      <RotateCcw className="size-3" />
                      Retry
                    </Button>
                  </div>
                )}

                {/* Action buttons */}
                {(isDone || isError) && (
                  <div className="mt-2.5 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReject}
                      className="h-8 gap-1.5"
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                    {isDone && streamText && (
                      <Button
                        size="sm"
                        onClick={handleAccept}
                        className="h-8 gap-1.5"
                      >
                        <Check className="size-3.5" />
                        Accept
                      </Button>
                    )}
                  </div>
                )}

                {/* While streaming, show reject option */}
                {isStreaming && (
                  <div className="mt-2.5 flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReject}
                      className="h-7 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
