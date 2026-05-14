"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { smoothTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type Suggestion = {
  title?: string;
  description?: string;
  tags?: string[];
  keywords?: string;
  excerpt?: string;
};

type FrontmatterAiDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentContent: string;
  currentFrontmatter: string;
  /** Merge accepted suggestions into the frontmatter values. */
  onAccept: (values: Record<string, string>) => void;
};

const SUGGESTION_FIELDS = [
  { key: "title", label: "Title", icon: "T" },
  { key: "description", label: "Description", icon: "D" },
  { key: "tags", label: "Tags", icon: "#" },
  { key: "keywords", label: "Keywords", icon: "K" },
  { key: "excerpt", label: "Excerpt", icon: "E" },
] as const;

/**
 * Drawer that uses AI to analyse document content and suggest
 * SEO-optimised frontmatter fields (title, description, tags, keywords,
 * excerpt). The user can accept individual suggestions or all at once.
 */
export function FrontmatterAiDrawer({
  open,
  onOpenChange,
  projectId,
  documentContent,
  currentFrontmatter,
  onAccept,
}: FrontmatterAiDrawerProps) {
  const createStream = useMutation(api.ai.enhance.createFrontmatterStream);

  const [streamId, setStreamId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const streamBody = useQuery(
    api.ai.enhance.getStreamBody,
    streamId ? { streamId } : "skip",
  );

  const isStreaming =
    streamBody !== undefined &&
    streamBody !== null &&
    streamBody.status !== "done" &&
    streamBody.status !== "error";
  const isDone = streamBody?.status === "done";
  const isError = streamBody?.status === "error";

  // Parse the streamed JSON once done
  const suggestions: Suggestion | null = useMemo(() => {
    if (!streamBody?.text) return null;
    try {
      // Strip markdown fences if the model wrapped the JSON
      let raw = streamBody.text.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      return JSON.parse(raw) as Suggestion;
    } catch {
      return null;
    }
  }, [streamBody?.text]);

  // Reset when drawer opens
  useEffect(() => {
    if (open) {
      setStreamId(undefined);
      setError(null);
      setAccepted(new Set());
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    if (!documentContent.trim()) {
      toast.error("Write some content first so AI has something to analyse.");
      return;
    }

    setError(null);
    setAccepted(new Set());

    try {
      const result = await createStream({
        projectId: projectId as Id<"projects">,
        content: documentContent,
        currentFrontmatter,
      });
      setStreamId(result.streamId);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "Failed to start AI";
      setError(msg);
      toast.error(msg);
    }
  }, [documentContent, currentFrontmatter, createStream, projectId]);

  // Auto-generate when drawer opens
  useEffect(() => {
    if (open && !streamId && !error) {
      void handleGenerate();
    }
  }, [open, streamId, error, handleGenerate]);

  const handleAcceptField = useCallback(
    (key: string) => {
      if (!suggestions) return;
      const value = suggestions[key as keyof Suggestion];
      if (value === undefined) return;

      const strValue = Array.isArray(value) ? value.join(", ") : String(value);
      onAccept({ [key]: strValue });
      setAccepted((prev) => new Set([...prev, key]));
      toast.success(`Applied ${key}`);
    },
    [suggestions, onAccept],
  );

  const handleAcceptAll = useCallback(() => {
    if (!suggestions) return;
    const merged: Record<string, string> = {};
    for (const { key } of SUGGESTION_FIELDS) {
      const value = suggestions[key as keyof Suggestion];
      if (value !== undefined) {
        merged[key] = Array.isArray(value) ? value.join(", ") : String(value);
      }
    }
    onAccept(merged);
    setAccepted(new Set(SUGGESTION_FIELDS.map((f) => f.key)));
    toast.success("Applied all suggestions");
  }, [suggestions, onAccept]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Suggestions
          </SheetTitle>
          <SheetDescription>
            Analyse your content and get SEO-optimised frontmatter suggestions.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <AnimatePresence mode="wait">
            {/* Loading / streaming state */}
            {(isStreaming || (!streamId && !error)) && streamId && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <Loader2 className="mb-3 size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analysing your content...
                </p>
                {streamBody?.text && (
                  <p className="mt-2 max-w-full truncate px-4 font-mono text-[10px] text-muted-foreground/50">
                    {streamBody.text.slice(0, 80)}...
                  </p>
                )}
              </motion.div>
            )}

            {/* Error state */}
            {(isError || error) && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4 py-8"
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10">
                    <AlertCircle className="size-5 text-destructive" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {error ?? "Something went wrong. Please try again."}
                  </p>
                </div>
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleGenerate()}
                    className="gap-1.5"
                  >
                    <RotateCcw className="size-3" />
                    Retry
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Results */}
            {isDone && suggestions && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={smoothTransition}
                className="space-y-3"
              >
                {SUGGESTION_FIELDS.map(({ key, label }) => {
                  const value = suggestions[key as keyof Suggestion];
                  if (value === undefined) return null;
                  const isAccepted = accepted.has(key);
                  const display = Array.isArray(value)
                    ? value.join(", ")
                    : String(value);

                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        isAccepted
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-border/40 bg-card/50",
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAcceptField(key)}
                          disabled={isAccepted}
                          className={cn(
                            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                            isAccepted
                              ? "text-green-600 dark:text-green-400"
                              : "text-primary hover:bg-primary/10",
                          )}
                        >
                          {isAccepted ? (
                            <>
                              <Check className="size-3" />
                              Applied
                            </>
                          ) : (
                            <>
                              <ArrowRight className="size-3" />
                              Apply
                            </>
                          )}
                        </button>
                      </div>

                      {key === "tags" && Array.isArray(value) ? (
                        <div className="flex flex-wrap gap-1">
                          {value.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-foreground/80">{display}</p>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* Done but bad JSON */}
            {isDone && !suggestions && (
              <motion.div
                key="parse-error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 py-8 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  Couldn't parse the AI response. Try again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleGenerate()}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3" />
                  Retry
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </SheetBody>

        <SheetFooter>
          {isDone && suggestions && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleGenerate()}
                className="gap-1.5"
              >
                <RotateCcw className="size-3" />
                Regenerate
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleAcceptAll}
                disabled={accepted.size === SUGGESTION_FIELDS.length}
                className="gap-1.5"
              >
                <Check className="size-3.5" />
                Accept All
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
