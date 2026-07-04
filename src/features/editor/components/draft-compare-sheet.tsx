"use client";

import { type ConvexReactClient, useConvex } from "convex/react";
import { GitCompare, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarkdownDiffViewer } from "@/components/diff/markdown-diff-viewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** Sentinel selection value for the Main (canonical) document. */
const MAIN = "main";

/** A selection is either the Main document or a specific draft id. */
type Selection = typeof MAIN | Id<"document_drafts">;

/** Minimal draft metadata the selectors need (subset of `documentDrafts.list`). */
type DraftOption = {
  _id: Id<"document_drafts">;
  label: string;
};

type SideContent = { title: string; content: string };

type DraftCompareSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: Id<"documents">;
  /** Draft metadata from the tab bar's already-subscribed `documentDrafts.list`. */
  drafts: DraftOption[];
  /** The draft the sheet was opened from — seeds the right-hand selector. */
  initialDraftId: Id<"document_drafts"> | null;
};

/** Whitespace-collapsed word count. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * One-shot fetch of a side's `{ title, content }`. Main joins its body via
 * `documents.get`; drafts resolve their body via `documentDrafts.getContent`.
 * Both are plain queries (NOT subscriptions) so opening the compare view — or
 * flipping a selector — never adds a live read to the editor's hot path.
 */
async function fetchSide(
  convex: ConvexReactClient,
  documentId: Id<"documents">,
  selection: Selection,
): Promise<SideContent | null> {
  if (selection === MAIN) {
    const doc = await convex.query(api.cms.documents.get, { documentId });
    return doc ? { title: doc.title, content: doc.content } : null;
  }
  const draft = await convex.query(api.cms.documentDrafts.getContent, {
    draftId: selection,
  });
  return draft ? { title: draft.title, content: draft.content } : null;
}

/**
 * Fetches one side's content on demand and re-fetches whenever the selection
 * (or the open state) changes. A cancellation guard drops stale responses so a
 * fast selector flip can't leave the slower request's content on screen.
 */
function useSideContent(
  open: boolean,
  documentId: Id<"documents">,
  selection: Selection,
): { data: SideContent | null; loading: boolean } {
  const convex = useConvex();
  const [state, setState] = useState<{
    data: SideContent | null;
    loading: boolean;
  }>({ data: null, loading: true });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ data: null, loading: true });
    void (async () => {
      const data = await fetchSide(convex, documentId, selection);
      if (!cancelled) setState({ data, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentId, selection, convex]);

  return state;
}

/**
 * Full-width overlay that diffs two versions of a document side by side —
 * Main against any draft, or two drafts. Content is fetched one-shot at open
 * and on every selector change (no live subscriptions), so the view is cheap
 * and reflects the latest saved keystrokes without re-billing the editor.
 */
export function DraftCompareSheet({
  open,
  onOpenChange,
  documentId,
  drafts,
  initialDraftId,
}: DraftCompareSheetProps) {
  const [left, setLeft] = useState<Selection>(MAIN);
  const [right, setRight] = useState<Selection>(initialDraftId ?? MAIN);

  // Re-seed the selectors each time the sheet is opened from a given draft, so
  // reopening from a different tab points the right side at the new draft.
  useEffect(() => {
    if (open) {
      setLeft(MAIN);
      setRight(initialDraftId ?? MAIN);
    }
  }, [open, initialDraftId]);

  const leftSide = useSideContent(open, documentId, left);
  const rightSide = useSideContent(open, documentId, right);

  const labelFor = useMemo(() => {
    const byId = new Map(drafts.map((d) => [d._id, d.label] as const));
    return (selection: Selection): string =>
      selection === MAIN ? "Main" : (byId.get(selection) ?? "Draft");
  }, [drafts]);

  const bothLoaded =
    !leftSide.loading &&
    !rightSide.loading &&
    leftSide.data !== null &&
    rightSide.data !== null;

  const identical =
    bothLoaded && leftSide.data?.content === rightSide.data?.content;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[95vw] max-w-none sm:w-[95vw] lg:w-[92vw]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitCompare className="size-4 text-primary" />
            Compare versions
          </SheetTitle>
          <SheetDescription>
            View two versions of this document side by side. Pick any draft or
            Main for either side.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-4">
          {/* Selectors + word-count titles — flat, one row, no nested cards. */}
          <div className="grid grid-cols-2 gap-4">
            <SideHeader
              ariaLabel="Left version"
              value={left}
              onChange={setLeft}
              drafts={drafts}
              side={leftSide}
              labelFor={labelFor}
            />
            <SideHeader
              ariaLabel="Right version"
              value={right}
              onChange={setRight}
              drafts={drafts}
              side={rightSide}
              labelFor={labelFor}
            />
          </div>

          {/* Diff area. */}
          <div
            data-testid="draft-compare-diff"
            className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/60"
          >
            {!bothLoaded ? (
              <DiffSkeleton />
            ) : identical ? (
              <NoDifferences />
            ) : (
              <MarkdownDiffViewer
                oldValue={leftSide.data?.content ?? ""}
                newValue={rightSide.data?.content ?? ""}
              />
            )}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal sub-components                                            */
/* ------------------------------------------------------------------ */

function SideHeader({
  ariaLabel,
  value,
  onChange,
  drafts,
  side,
  labelFor,
}: {
  ariaLabel: string;
  value: Selection;
  onChange: (value: Selection) => void;
  drafts: DraftOption[];
  side: { data: SideContent | null; loading: boolean };
  labelFor: (selection: Selection) => string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Select
        value={value as string}
        onValueChange={(next) => onChange(next as Selection)}
      >
        <SelectTrigger aria-label={ariaLabel} className="w-full">
          <SelectValue>{() => labelFor(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MAIN}>Main</SelectItem>
          {drafts.map((draft) => (
            <SelectItem key={draft._id} value={draft._id as string}>
              {draft.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="px-1 text-xs text-muted-foreground tabular-nums">
        {side.loading || side.data === null ? (
          <span className="opacity-60">Loading…</span>
        ) : (
          `${wordCount(side.data.content).toLocaleString()} words`
        )}
      </p>
    </div>
  );
}

function DiffSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function NoDifferences() {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-16 text-center",
      )}
    >
      <GitCompare className="size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">
        No differences — these two versions are identical.
      </p>
    </div>
  );
}
