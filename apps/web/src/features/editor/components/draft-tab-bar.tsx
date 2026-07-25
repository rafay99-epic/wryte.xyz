"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wryte/ui/dropdown-menu";
import { Input } from "@wryte/ui/input";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowUpToLine,
  GitCompare,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  MAIN_TAB,
  useDraftSwitching,
} from "@/features/editor/hooks/use-draft-switching";
import { DraftCompareSheet } from "./draft-compare-sheet";

type DraftTabBarProps = {
  documentId: string;
  projectId: string;
  /** Main doc from the editor page's subscription — no own body query here. */
  mainDocument: { title: string; content: string } | null | undefined;
  onRequestSave: () => Promise<void>;
  onSynthesisOpen: () => void;
};

export function DraftTabBar({
  documentId,
  projectId,
  mainDocument,
  onRequestSave,
  onSynthesisOpen,
}: DraftTabBarProps) {
  const { activeDraftId, switchTarget } = useEditorStore(
    useShallow((s) => ({
      activeDraftId: s.activeDraftId,
      switchTarget: s.switchTarget,
    })),
  );

  const drafts = useQuery(api.cms.documentDrafts.list, {
    documentId: documentId as Id<"documents">,
  });
  const createDraft = useMutation(api.cms.documentDrafts.create);
  const removeDraft = useMutation(api.cms.documentDrafts.remove);
  const promoteDraft = useMutation(api.cms.documentDrafts.promoteToMain);
  const updateDraftMeta = useMutation(api.cms.documentDrafts.update);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Draft the compare sheet was opened from (null = sheet closed). Seeds the
  // sheet's right-hand side; left defaults to Main.
  const [compareDraftId, setCompareDraftId] =
    useState<Id<"document_drafts"> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Cached, race-safe switching state machine (per-session content cache,
  // TTL-bounded revalidation, supersede-on-newer-switch).
  const { switchToDraft, evictDraft, seedDraft, applyPromotedMain } =
    useDraftSwitching({
      projectId,
      document: mainDocument,
      drafts,
      onRequestSave,
    });

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeDraftId triggers scroll-into-view when the active tab changes
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeTabRef.current;
      const left = tab.offsetLeft - container.offsetLeft;
      const right = left + tab.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const visible = container.clientWidth;

      if (left < scrollLeft) {
        container.scrollTo({ left: left - 8, behavior: "smooth" });
      } else if (right > scrollLeft + visible) {
        container.scrollTo({
          left: right - visible + 8,
          behavior: "smooth",
        });
      }
    }
  }, [activeDraftId]);

  const handleNewDraft = useCallback(async () => {
    try {
      const id = await createDraft({
        documentId: documentId as Id<"documents">,
        copyFromMain: false,
      });
      // A blank draft's server content is exactly "" / "" — seed the cache
      // as verified so the switch below is instant and never fetches.
      seedDraft(id, { title: "", content: "" }, true);
      await switchToDraft(id);
      toast.success("New draft created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create draft",
      );
    }
  }, [createDraft, documentId, switchToDraft, seedDraft]);

  const handleNewDraftFromMain = useCallback(async () => {
    try {
      const id = await createDraft({
        documentId: documentId as Id<"documents">,
        copyFromMain: true,
      });
      // Seed from the editor page's live Main subscription (threaded down
      // as a prop — this bar deliberately has no body query of its own) so
      // the switch is instant; unverified (one background check) in case
      // the prop lagged the server's copy by a beat.
      if (mainDocument) {
        seedDraft(
          id,
          { title: mainDocument.title, content: mainDocument.content },
          false,
        );
      }
      await switchToDraft(id);
      toast.success("Draft created from current content");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create draft",
      );
    }
  }, [createDraft, documentId, switchToDraft, seedDraft, mainDocument]);

  const handleDelete = useCallback(
    async (draftId: string) => {
      if (activeDraftId === draftId) {
        // Move off the draft first; abort the delete if that failed so we
        // never delete the version the editor is still pointed at.
        const switched = await switchToDraft(null);
        if (!switched) return;
      }
      try {
        await removeDraft({ draftId: draftId as Id<"document_drafts"> });
        evictDraft(draftId);
        toast.success("Draft deleted");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete draft",
        );
      }
    },
    [activeDraftId, removeDraft, switchToDraft, evictDraft],
  );

  const handlePromote = useCallback(
    async (draftId: string): Promise<boolean> => {
      try {
        // Persist whatever tab is being edited first: promoting reads the
        // draft server-side, and the post-promote apply below replaces the
        // store — without this flush, unsaved edits would be silently lost.
        await onRequestSave();
        const result = await promoteDraft({
          draftId: draftId as Id<"document_drafts">,
        });
        applyPromotedMain({ title: result.title, content: result.content });
        toast.success("Draft promoted to main article");
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to promote draft",
        );
        return false;
      }
    },
    [promoteDraft, applyPromotedMain, onRequestSave],
  );

  const handleCompare = useCallback(
    async (draftId: string) => {
      // Flush pending keystrokes first so the diff reflects the latest edits
      // (the active tab's content is only persisted on save).
      await onRequestSave();
      setCompareDraftId(draftId as Id<"document_drafts">);
    },
    [onRequestSave],
  );

  const startRename = useCallback((draftId: string, currentLabel: string) => {
    setRenamingId(draftId);
    setRenameValue(currentLabel);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await updateDraftMeta({
        draftId: renamingId as Id<"document_drafts">,
        label: renameValue.trim(),
      });
    } catch {
      toast.error("Failed to rename draft");
    }
    setRenamingId(null);
  }, [renamingId, renameValue, updateDraftMeta]);

  const hasDrafts = drafts && drafts.length > 0;

  return (
    <div className="flex items-center border-b border-border/40 bg-muted/20">
      {/* Scrollable tab area */}
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2 py-1 hide-scrollbar"
      >
        <div
          ref={activeDraftId === null ? activeTabRef : undefined}
          className="shrink-0"
        >
          <button
            type="button"
            onClick={() => void switchToDraft(null)}
            className={cn(
              "relative flex items-center rounded-md px-3 py-1 text-xs font-medium transition-colors",
              activeDraftId === null
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            {activeDraftId === null && (
              <motion.div
                layoutId="draft-tab-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border/50"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {switchTarget === MAIN_TAB && (
                <span className="switch-spinner">
                  <Loader2 className="size-3 animate-spin" />
                </span>
              )}
              Main
            </span>
          </button>
        </div>

        {drafts?.map((draft) => (
          <div
            key={draft._id}
            ref={activeDraftId === draft._id ? activeTabRef : undefined}
            className="group relative flex shrink-0 items-center"
          >
            {renamingId === draft._id ? (
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="h-6 w-28 rounded-md px-2 text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => void switchToDraft(draft._id)}
                className={cn(
                  "relative flex items-center rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  activeDraftId === draft._id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {activeDraftId === draft._id && (
                  <motion.div
                    layoutId="draft-tab-indicator"
                    className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border/50"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex max-w-32 items-center gap-1.5">
                  {switchTarget === draft._id && (
                    <span className="switch-spinner shrink-0">
                      <Loader2 className="size-3 animate-spin" />
                    </span>
                  )}
                  <span className="truncate">{draft.label}</span>
                </span>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Draft options: ${draft.label}`}
                    className="relative z-10 -ml-1 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  />
                }
              >
                <MoreHorizontal className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start">
                <DropdownMenuItem
                  onClick={() => startRename(draft._id, draft.label)}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleCompare(draft._id)}>
                  <GitCompare className="mr-2 size-3.5" />
                  Compare versions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handlePromote(draft._id)}>
                  <ArrowUpToLine className="mr-2 size-3.5" />
                  Promote to Main
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDelete(draft._id)}>
                  <Trash2 className="mr-2 size-3.5 text-destructive" />
                  <span className="text-destructive">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Pinned actions — always visible */}
      <div className="flex shrink-0 items-center gap-1 border-l border-border/30 px-2 py-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="New draft"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              />
            }
          >
            <Plus className="size-3" />
            <span>Draft</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem onClick={() => void handleNewDraft()}>
              <Plus className="mr-2 size-3.5" />
              Blank draft
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleNewDraftFromMain()}>
              <ArrowUpToLine className="mr-2 size-3.5 rotate-180" />
              Copy from Main
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasDrafts && (
          <button
            type="button"
            onClick={onSynthesisOpen}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Sparkles className="size-3" />
            <span className="hidden sm:inline">Synthesize</span>
          </button>
        )}
      </div>

      <DraftCompareSheet
        open={compareDraftId !== null}
        onOpenChange={(open) => {
          if (!open) setCompareDraftId(null);
        }}
        documentId={documentId as Id<"documents">}
        drafts={drafts ?? []}
        initialDraftId={compareDraftId}
        onPromote={handlePromote}
      />
    </div>
  );
}
