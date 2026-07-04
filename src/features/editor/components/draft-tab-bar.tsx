"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowUpToLine,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type DraftTabBarProps = {
  documentId: string;
  onRequestSave: () => Promise<void>;
  onSynthesisOpen: () => void;
};

export function DraftTabBar({
  documentId,
  onRequestSave,
  onSynthesisOpen,
}: DraftTabBarProps) {
  const { activeDraftId, setActiveDraftId, initDocument } = useEditorStore(
    useShallow((s) => ({
      activeDraftId: s.activeDraftId,
      setActiveDraftId: s.setActiveDraftId,
      initDocument: s.initDocument,
    })),
  );

  const convex = useConvex();
  const document = useQuery(api.cms.documents.get, {
    documentId: documentId as Id<"documents">,
  });
  const drafts = useQuery(api.cms.documentDrafts.list, {
    documentId: documentId as Id<"documents">,
  });
  const createDraft = useMutation(api.cms.documentDrafts.create);
  const removeDraft = useMutation(api.cms.documentDrafts.remove);
  const promoteDraft = useMutation(api.cms.documentDrafts.promoteToMain);
  const updateDraftMeta = useMutation(api.cms.documentDrafts.update);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

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

  const switchToDraft = useCallback(
    async (draftId: string | null) => {
      if (draftId === activeDraftId) return;
      await onRequestSave();

      if (draftId === null) {
        if (document) {
          initDocument(
            document.title,
            document.content,
            document.projectId as string,
          );
        }
      } else if (document) {
        // Draft bodies live in their own table — fetch on demand instead of
        // riding the always-mounted `list` subscription (which is now
        // metadata-only to keep autosave from re-billing every draft body).
        const draftContent = await convex.query(
          api.cms.documentDrafts.getContent,
          { draftId: draftId as Id<"document_drafts"> },
        );
        if (draftContent) {
          initDocument(
            draftContent.title,
            draftContent.content,
            document.projectId as string,
          );
        }
      }
      setActiveDraftId(draftId);
    },
    [
      activeDraftId,
      onRequestSave,
      document,
      convex,
      initDocument,
      setActiveDraftId,
    ],
  );

  const handleNewDraft = useCallback(async () => {
    try {
      const id = await createDraft({
        documentId: documentId as Id<"documents">,
        copyFromMain: false,
      });
      await switchToDraft(id);
      toast.success("New draft created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create draft",
      );
    }
  }, [createDraft, documentId, switchToDraft]);

  const handleNewDraftFromMain = useCallback(async () => {
    try {
      const id = await createDraft({
        documentId: documentId as Id<"documents">,
        copyFromMain: true,
      });
      await switchToDraft(id);
      toast.success("Draft created from current content");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create draft",
      );
    }
  }, [createDraft, documentId, switchToDraft]);

  const handleDelete = useCallback(
    async (draftId: string) => {
      if (activeDraftId === draftId) {
        await switchToDraft(null);
      }
      try {
        await removeDraft({ draftId: draftId as Id<"document_drafts"> });
        toast.success("Draft deleted");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete draft",
        );
      }
    },
    [activeDraftId, removeDraft, switchToDraft],
  );

  const handlePromote = useCallback(
    async (draftId: string) => {
      try {
        const result = await promoteDraft({
          draftId: draftId as Id<"document_drafts">,
        });
        initDocument(
          result.title,
          result.content,
          document?.projectId as string,
        );
        setActiveDraftId(null);
        toast.success("Draft promoted to main article");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to promote draft",
        );
      }
    },
    [promoteDraft, initDocument, document?.projectId, setActiveDraftId],
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
            <span className="relative z-10">Main</span>
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
                <span className="relative z-10 max-w-32 truncate">
                  {draft.label}
                </span>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
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
    </div>
  );
}
