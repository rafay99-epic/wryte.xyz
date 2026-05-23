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
import { extractStreamError } from "@/lib/stream-error";
import { cn, humanizeFieldName } from "@/lib/utils";
import type { FrontmatterFieldType } from "@/types/frontmatter";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Field types the AI is never asked to fill — mirrored from
 * `convex/ai/enhanceActions.ts` so the drawer hides them too. The hero
 * image is uploaded; dates come from publish/schedule; slug is derived
 * from the title.
 */
const AI_EXCLUDED_TYPES = new Set<FrontmatterFieldType>([
  "image",
  "date",
  "datetime",
  "slug",
]);
const AI_EXCLUDED_NAMES = new Set([
  "draft",
  "pubDate",
  "publishDate",
  "date",
  "slug",
  "publishedAt",
  "updatedAt",
]);

/** Eligibility check the drawer uses to know what fields to expect. */
export function isAiEligibleField(field: {
  name: string;
  type: FrontmatterFieldType;
  hidden?: boolean | undefined;
}): boolean {
  if (field.hidden) return false;
  if (AI_EXCLUDED_TYPES.has(field.type)) return false;
  if (AI_EXCLUDED_NAMES.has(field.name)) return false;
  return true;
}

type EligibleField = {
  name: string;
  type: FrontmatterFieldType;
  label?: string;
};

type FrontmatterAiDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentContent: string;
  currentFrontmatter: string;
  /**
   * Fields the AI is allowed to propose values for. Computed by the
   * caller from the project schema using `isAiEligibleField`.
   */
  eligibleFields: EligibleField[];
  /**
   * Merge accepted suggestions into the frontmatter values. Booleans are
   * passed through as `boolean`; tags/list/multiselect arrive as
   * comma-joined strings so they round-trip through the TagChipsInput.
   */
  onAccept: (values: Record<string, string | boolean>) => void;
};

type SuggestionMap = Record<string, unknown>;

/**
 * Coerces a single field's AI-suggested value into the storage shape the
 * frontmatter editor expects: strings for text-y types, comma-joined
 * strings for collections, real booleans for toggles, strings for numbers
 * (the field's input is text and parses on submit). Returns null when the
 * value doesn't look reasonable for the field's type.
 */
function coerceForStorage(
  type: FrontmatterFieldType,
  raw: unknown,
): string | boolean | null {
  if (raw == null) return null;
  if (type === "boolean") {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "string") {
      if (/^true$/i.test(raw)) return true;
      if (/^false$/i.test(raw)) return false;
    }
    return null;
  }
  if (type === "tags" || type === "list" || type === "multiselect") {
    if (Array.isArray(raw)) {
      return raw
        .map((v) => String(v).trim())
        .filter(Boolean)
        .join(", ");
    }
    if (typeof raw === "string") return raw.trim();
    return null;
  }
  if (type === "number") {
    if (typeof raw === "number") return String(raw);
    if (
      typeof raw === "string" &&
      raw.trim() !== "" &&
      !Number.isNaN(Number(raw))
    ) {
      return raw.trim();
    }
    return null;
  }
  // string | text | url | color | select | json
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return null;
}

/**
 * Drawer that asks the project's configured LLM to suggest values for
 * every AI-eligible frontmatter field in the schema. Streams JSON,
 * renders each suggestion with the right preview (chip pills for tags,
 * toggle preview for booleans, multi-line text for descriptions), and
 * lets the author accept fields one at a time or in bulk.
 */
export function FrontmatterAiDrawer({
  open,
  onOpenChange,
  projectId,
  documentContent,
  currentFrontmatter,
  eligibleFields,
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

  useEffect(() => {
    if (isError && streamBody?.text) {
      const result = extractStreamError(streamBody.text);
      if (result?.error) setError(result.error);
    }
  }, [isError, streamBody?.text]);

  // Only attempt to parse once the stream has finished. Re-running JSON.parse
  // on every chunk is wasted work — JSON is invalid for almost the entire
  // duration of streaming — and causes the suggestions UI to flash empty as
  // the parser flips between null (mid-stream) and the final object.
  const suggestions: SuggestionMap | null = useMemo(() => {
    if (!isDone || !streamBody?.text) return null;
    try {
      let raw = streamBody.text.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as SuggestionMap;
      }
      return null;
    } catch {
      return null;
    }
  }, [isDone, streamBody?.text]);

  /**
   * Field metadata the drawer renders for. Only fields that the AI
   * actually returned a value for (and that match the eligibility list)
   * make it into this list, so the UI doesn't show empty cards.
   */
  const populatedFields = useMemo(() => {
    if (!suggestions) return [] as EligibleField[];
    return eligibleFields.filter(
      (f) => suggestions[f.name] !== undefined && suggestions[f.name] !== "",
    );
  }, [eligibleFields, suggestions]);

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
    if (eligibleFields.length === 0) {
      toast.error(
        "No fields available for AI suggestions in this project's schema.",
      );
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
  }, [
    documentContent,
    currentFrontmatter,
    createStream,
    projectId,
    eligibleFields.length,
  ]);

  useEffect(() => {
    if (open && !streamId && !error) {
      void handleGenerate();
    }
  }, [open, streamId, error, handleGenerate]);

  const handleAcceptField = useCallback(
    (field: EligibleField) => {
      if (!suggestions) return;
      const coerced = coerceForStorage(field.type, suggestions[field.name]);
      if (coerced === null) return;
      onAccept({ [field.name]: coerced });
      setAccepted((prev) => new Set([...prev, field.name]));
    },
    [suggestions, onAccept],
  );

  const handleAcceptAll = useCallback(() => {
    if (!suggestions) return;
    const merged: Record<string, string | boolean> = {};
    const acceptedNames: string[] = [];
    for (const field of populatedFields) {
      const coerced = coerceForStorage(field.type, suggestions[field.name]);
      if (coerced !== null) {
        merged[field.name] = coerced;
        acceptedNames.push(field.name);
      }
    }
    if (acceptedNames.length === 0) {
      toast.error("Nothing to apply yet.");
      return;
    }
    onAccept(merged);
    setAccepted(new Set(acceptedNames));
    toast.success(
      `Applied ${acceptedNames.length} field${acceptedNames.length === 1 ? "" : "s"}`,
    );
  }, [suggestions, populatedFields, onAccept]);

  const allAccepted =
    populatedFields.length > 0 &&
    populatedFields.every((f) => accepted.has(f.name));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Suggestions
          </SheetTitle>
          <SheetDescription>
            One-shot frontmatter from your post's body — pick which to apply.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <AnimatePresence mode="wait">
            {/* Streaming — show a skeleton list matching the eligible-field
                count so the surface settles instead of swapping a spinner
                for a full list at the end. */}
            {(isStreaming || (!streamId && !error)) && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Reading your post and drafting metadata…</span>
                </div>
                {eligibleFields.slice(0, 6).map((f, i) => (
                  <SuggestionSkeleton key={f.name} index={i} field={f} />
                ))}
              </motion.div>
            )}

            {/* Error */}
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
            {isDone && suggestions && populatedFields.length > 0 && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={smoothTransition}
                className="space-y-2.5"
              >
                {populatedFields.map((field, index) => {
                  const raw = suggestions[field.name];
                  const isAccepted = accepted.has(field.name);
                  return (
                    <SuggestionCard
                      key={field.name}
                      index={index}
                      field={field}
                      raw={raw}
                      isAccepted={isAccepted}
                      onApply={() => handleAcceptField(field)}
                    />
                  );
                })}
              </motion.div>
            )}

            {/* Empty suggestion set (e.g., article too thin) */}
            {isDone && suggestions && populatedFields.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 py-12 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  AI didn't find enough signal in this post to suggest anything
                  useful yet. Write a bit more and try again.
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
          {isDone && suggestions && populatedFields.length > 0 && (
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
                disabled={allAccepted}
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

function SuggestionSkeleton({
  index,
  field,
}: {
  index: number;
  field: EligibleField;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="space-y-2 rounded-xl border border-border/40 bg-card/30 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          {field.label ?? humanizeFieldName(field.name)}
        </span>
        <span className="h-4 w-12 animate-pulse rounded bg-muted/60" />
      </div>
      <span className="block h-3 w-full animate-pulse rounded bg-muted/40" />
      <span className="block h-3 w-4/5 animate-pulse rounded bg-muted/30" />
    </motion.div>
  );
}

function SuggestionCard({
  index,
  field,
  raw,
  isAccepted,
  onApply,
}: {
  index: number;
  field: EligibleField;
  raw: unknown;
  isAccepted: boolean;
  onApply: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className={cn(
        "rounded-xl border p-3 transition-colors",
        isAccepted
          ? "border-green-500/40 bg-green-500/5"
          : "border-border/40 bg-card/50 hover:border-border/70",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {field.label ?? humanizeFieldName(field.name)}
        </span>
        <button
          type="button"
          onClick={onApply}
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
      <SuggestionPreview field={field} raw={raw} />
    </motion.div>
  );
}

function SuggestionPreview({
  field,
  raw,
}: {
  field: EligibleField;
  raw: unknown;
}) {
  // Collections render as chip pills, matching the editor's TagChipsInput
  // so the preview looks like the destination control will once applied.
  if (
    (field.type === "tags" ||
      field.type === "list" ||
      field.type === "multiselect") &&
    Array.isArray(raw)
  ) {
    const items = raw.map(String).filter(Boolean);
    if (items.length === 0) {
      return (
        <p className="text-[11px] text-muted-foreground/60 italic">no items</p>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="rounded-md text-[10px]"
          >
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  if (field.type === "boolean") {
    const yes =
      raw === true || (typeof raw === "string" && /^true$/i.test(raw));
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
            yes ? "justify-end bg-primary/60" : "justify-start bg-muted",
          )}
        >
          <span className="size-3 rounded-full bg-background" />
        </span>
        <span className="text-foreground/80">{yes ? "On" : "Off"}</span>
      </div>
    );
  }

  if (field.type === "color" && typeof raw === "string") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="size-4 rounded border border-border/60"
          style={{ backgroundColor: raw }}
        />
        <span className="font-mono text-xs text-foreground/80">{raw}</span>
      </div>
    );
  }

  if (
    field.type === "number" &&
    (typeof raw === "number" || typeof raw === "string")
  ) {
    return (
      <p className="font-mono text-sm text-foreground/80">{String(raw)}</p>
    );
  }

  const text =
    typeof raw === "string"
      ? raw
      : raw == null
        ? ""
        : Array.isArray(raw)
          ? raw.join(", ")
          : JSON.stringify(raw);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
      {text}
    </p>
  );
}
