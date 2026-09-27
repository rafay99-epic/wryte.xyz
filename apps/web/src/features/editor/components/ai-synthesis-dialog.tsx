"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { getStreamErrorMessage } from "@wryte/logic/lib/stream-error";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Button } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

type AiSynthesisDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  projectId: string;
  /** Flushes the active tab's unsaved edits before "Apply to Main" replaces it. */
  onRequestSave: () => Promise<void>;
};

export function AiSynthesisDialog({
  open,
  onOpenChange,
  documentId,
  projectId,
  onRequestSave,
}: AiSynthesisDialogProps) {
  // Actions only: the editor body/title are read via getState() in the
  // handlers so a closed dialog doesn't re-render on every keystroke.
  const { initDocument, setActiveDraftId, setContent } = useEditorStore(
    useShallow((s) => ({
      initDocument: s.initDocument,
      setActiveDraftId: s.setActiveDraftId,
      setContent: s.setContent,
    })),
  );

  // Subscriptions stay live from open until the close animation finishes,
  // so the body doesn't empty out while fading away.
  const [isClosing, setIsClosing] = useState(false);
  const docArgs =
    open || isClosing ? { documentId: documentId as Id<"documents"> } : "skip";
  const document = useQuery(api.cms.documents.get, docArgs);
  const drafts = useQuery(api.cms.documentDrafts.list, docArgs);
  const research = useQuery(api.cms.documentResearch.list, docArgs);

  const createFinalDraftStream = useMutation(
    api.ai.enhance.createFinalDraftStream,
  );
  const createDraftSnapshot = useMutation(
    api.cms.documentDrafts.createSnapshot,
  );
  const templates = useQuery(
    api.ai.promptTemplates.getTemplates,
    open || isClosing ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [streamId, setStreamId] = useState<string | undefined>(undefined);
  const [isStarting, setIsStarting] = useState(false);

  // Each open starts fresh: clear any previous stream and, once the drafts
  // list is available, preselect every draft. Later list changes while open
  // must not clobber the user's checkbox choices.
  const [prevOpen, setPrevOpen] = useState(open);
  const [selectionPending, setSelectionPending] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStreamId(undefined);
      setSelectionPending(true);
      setIsClosing(false);
    } else {
      setIsClosing(true);
    }
  }
  if (selectionPending && drafts !== undefined) {
    setSelectionPending(false);
    setSelectedDraftIds(new Set(drafts.map((d) => d._id)));
  }

  const finalStreamBody = useQuery(
    api.ai.enhance.getStreamBody,
    streamId ? { streamId } : "skip",
  );
  const finalStatus = finalStreamBody?.status ?? "pending";
  const finalText = finalStreamBody?.text ?? "";
  const isGenerating = finalStatus === "pending" || finalStatus === "streaming";
  const isDone = finalStatus === "done" && finalText.trim().length > 0;
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((isGenerating || finalText) && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [isGenerating, finalText]);

  const selectedResearchIds = useMemo(
    () =>
      (research ?? []).filter((item) => item.selectedForAi).map((i) => i._id),
    [research],
  );

  const finalDraftPrompt = templates?.find(
    (t) => t.id === "final-draft",
  )?.prompt;

  const handleGenerate = useCallback(async () => {
    setIsStarting(true);
    const { title, content } = useEditorStore.getState();
    try {
      const result = await createFinalDraftStream({
        projectId: projectId as Id<"projects">,
        documentId: documentId as Id<"documents">,
        title: document?.title ?? title,
        content: document?.content ?? content,
        draftIds: Array.from(selectedDraftIds).map(
          (id) => id as Id<"document_drafts">,
        ),
        researchIds: selectedResearchIds,
        ...(finalDraftPrompt ? { systemPrompt: finalDraftPrompt } : {}),
      });
      setStreamId(result.streamId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start synthesis",
      );
    } finally {
      setIsStarting(false);
    }
  }, [
    createFinalDraftStream,
    projectId,
    documentId,
    document,
    selectedDraftIds,
    selectedResearchIds,
    finalDraftPrompt,
  ]);

  // Replaces Main's body with the synthesis as an unsaved edit, so autosave
  // persists it (initDocument alone would mark it clean and the page's
  // server resync would immediately revert it).
  const handleApplyToMain = useCallback(async () => {
    if (!finalText.trim() || !document) return;
    try {
      await onRequestSave();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
      return;
    }
    if (useEditorStore.getState().activeDraftId !== null) {
      initDocument(
        document.title,
        document.content,
        document.projectId as string,
      );
      setActiveDraftId(null);
    }
    setContent(finalText);
    onOpenChange(false);
    toast.success("Synthesis applied to main article");
  }, [
    finalText,
    document,
    onRequestSave,
    initDocument,
    setActiveDraftId,
    setContent,
    onOpenChange,
  ]);

  const handleSaveAsDraft = useCallback(async () => {
    if (!finalText.trim()) return;
    try {
      await createDraftSnapshot({
        documentId: documentId as Id<"documents">,
        label: "AI Synthesis",
        title: document?.title ?? useEditorStore.getState().title,
        content: finalText,
        ...(document?.frontmatter !== undefined
          ? { frontmatter: document.frontmatter }
          : {}),
        summary: `Synthesized from ${selectedDraftIds.size} drafts and ${selectedResearchIds.length} research items.`,
      });
      onOpenChange(false);
      toast.success("Synthesis saved as new draft");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save draft",
      );
    }
  }, [
    createDraftSnapshot,
    documentId,
    document,
    finalText,
    selectedDraftIds.size,
    selectedResearchIds.length,
    onOpenChange,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setIsClosing(false);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Synthesize Drafts
          </DialogTitle>
          <DialogDescription>
            AI will merge your selected drafts and research into a polished
            article.
          </DialogDescription>
        </DialogHeader>

        {!streamId && (
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">
                Include drafts:
              </p>
              <div className="space-y-1">
                {drafts?.map((draft) => {
                  const selected = selectedDraftIds.has(draft._id);
                  return (
                    <label
                      key={draft._id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors",
                        selected
                          ? "bg-primary/5 text-foreground"
                          : "text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          setSelectedDraftIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(draft._id);
                            else next.delete(draft._id);
                            return next;
                          });
                        }}
                        className="rounded"
                      />
                      <span className="font-medium">{draft.label}</span>
                      <span className="text-muted-foreground/60">
                        {draft.wordCount} words
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {selectedResearchIds.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                + {selectedResearchIds.length} research items marked for AI
                context
              </p>
            )}
          </div>
        )}

        {streamId && (
          <div
            ref={streamRef}
            className="max-h-[40vh] overflow-y-auto rounded-lg border bg-background p-4 slim-scrollbar"
          >
            {isGenerating && !finalText ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Synthesizing drafts...
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7">
                {finalText}
              </p>
            )}
          </div>
        )}

        {finalStatus === "error" && (
          <p className="text-xs text-destructive">
            {getStreamErrorMessage(finalText, "Synthesis failed. Try again.")}
          </p>
        )}

        <DialogFooter>
          {!streamId ? (
            <Button
              onClick={() => void handleGenerate()}
              disabled={isStarting || selectedDraftIds.size === 0}
            >
              {isStarting ? (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-3.5" />
              )}
              Generate
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={!isDone}
                onClick={() => void handleSaveAsDraft()}
              >
                Save as Draft
              </Button>
              <Button
                disabled={!isDone}
                onClick={() => void handleApplyToMain()}
              >
                <Check className="mr-2 size-3.5" />
                Apply to Main
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
