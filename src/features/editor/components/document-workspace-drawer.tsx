"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Copy,
  FileClock,
  Loader2,
  NotebookPen,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type DocumentWorkspaceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  projectId: string;
};

type ResearchType = "note" | "source" | "quote" | "outline" | "idea";

const RESEARCH_TYPES: { value: ResearchType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "source", label: "Source" },
  { value: "quote", label: "Quote" },
  { value: "outline", label: "Outline" },
  { value: "idea", label: "Idea" },
];

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DocumentWorkspaceDrawer({
  open,
  onOpenChange,
  documentId,
  projectId,
}: DocumentWorkspaceDrawerProps) {
  const { title, content, setTitle, setContent } = useEditorStore(
    useShallow((state) => ({
      title: state.title,
      content: state.content,
      setTitle: state.setTitle,
      setContent: state.setContent,
    })),
  );

  const document = useQuery(api.cms.documents.get, {
    documentId: documentId as Id<"documents">,
  });
  const drafts = useQuery(api.cms.documentDrafts.list, {
    documentId: documentId as Id<"documents">,
  });
  const research = useQuery(api.cms.documentResearch.list, {
    documentId: documentId as Id<"documents">,
  });
  const createDraft = useMutation(api.cms.documentDrafts.createSnapshot);
  const restoreDraft = useMutation(api.cms.documentDrafts.restoreToDocument);
  const removeDraft = useMutation(api.cms.documentDrafts.remove);
  const createResearch = useMutation(api.cms.documentResearch.create);
  const toggleResearch = useMutation(
    api.cms.documentResearch.toggleSelectedForAi,
  );
  const removeResearch = useMutation(api.cms.documentResearch.remove);
  const createFinalDraftStream = useMutation(
    api.ai.enhance.createFinalDraftStream,
  );

  const [draftLabel, setDraftLabel] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [researchType, setResearchType] = useState<ResearchType>("note");
  const [researchTitle, setResearchTitle] = useState("");
  const [researchContent, setResearchContent] = useState("");
  const [researchUrl, setResearchUrl] = useState("");
  const [researchSource, setResearchSource] = useState("");
  const [streamId, setStreamId] = useState<string | undefined>(undefined);
  const [isStartingFinalDraft, setIsStartingFinalDraft] = useState(false);

  const finalStreamBody = useQuery(
    api.ai.enhance.getStreamBody,
    streamId ? { streamId } : "skip",
  );
  const finalStatus = finalStreamBody?.status ?? "pending";
  const finalText = finalStreamBody?.text ?? "";
  const isGeneratingFinal =
    finalStatus === "pending" || finalStatus === "streaming";
  const isFinalDone = finalStatus === "done" && finalText.trim().length > 0;
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((isGeneratingFinal || finalText) && finalRef.current) {
      finalRef.current.scrollTop = finalRef.current.scrollHeight;
    }
  }, [isGeneratingFinal, finalText]);

  const selectedResearchIds = useMemo(
    () =>
      (research ?? []).filter((item) => item.selectedForAi).map((i) => i._id),
    [research],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Write some content before saving a draft version");
      return;
    }
    try {
      await createDraft({
        documentId: documentId as Id<"documents">,
        label:
          draftLabel.trim() || `Draft v${String((drafts?.length ?? 0) + 1)}`,
        title,
        content,
        ...(document?.frontmatter !== undefined
          ? { frontmatter: document.frontmatter }
          : {}),
        ...(draftSummary.trim() ? { summary: draftSummary.trim() } : {}),
      });
      setDraftLabel("");
      setDraftSummary("");
      toast.success("Draft version saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save draft version",
      );
    }
  }, [
    content,
    createDraft,
    document?.frontmatter,
    documentId,
    draftLabel,
    draftSummary,
    drafts?.length,
    title,
  ]);

  const handleRestoreDraft = useCallback(
    async (draftId: string) => {
      try {
        const restored = await restoreDraft({
          draftId: draftId as Id<"document_drafts">,
        });
        setTitle(restored.title);
        setContent(restored.content);
        toast.success("Draft restored", {
          description: `Restored from ${relativeTime(restored.restoredFrom)}`,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to restore draft",
        );
      }
    },
    [restoreDraft, setContent, setTitle],
  );

  const handleCreateResearch = useCallback(async () => {
    if (!researchContent.trim()) {
      toast.error("Research content is required");
      return;
    }
    try {
      await createResearch({
        documentId: documentId as Id<"documents">,
        type: researchType,
        title: researchTitle.trim() || "Untitled research",
        content: researchContent,
        ...(researchUrl.trim() ? { url: researchUrl.trim() } : {}),
        ...(researchSource.trim() ? { sourceName: researchSource.trim() } : {}),
        selectedForAi: true,
      });
      setResearchTitle("");
      setResearchContent("");
      setResearchUrl("");
      setResearchSource("");
      toast.success("Research saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save research",
      );
    }
  }, [
    createResearch,
    documentId,
    researchContent,
    researchSource,
    researchTitle,
    researchType,
    researchUrl,
  ]);

  const handleGenerateFinalDraft = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Current article content is required");
      return;
    }
    setIsStartingFinalDraft(true);
    try {
      const result = await createFinalDraftStream({
        projectId: projectId as Id<"projects">,
        documentId: documentId as Id<"documents">,
        title,
        content,
        draftIds: Array.from(selectedDraftIds).map(
          (id) => id as Id<"document_drafts">,
        ),
        researchIds: selectedResearchIds,
      });
      setStreamId(result.streamId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start final draft generation",
      );
    } finally {
      setIsStartingFinalDraft(false);
    }
  }, [
    content,
    createFinalDraftStream,
    documentId,
    projectId,
    selectedDraftIds,
    selectedResearchIds,
    title,
  ]);

  const handleApplyFinalDraft = useCallback(() => {
    if (!finalText.trim()) return;
    setContent(finalText);
    toast.success("Final draft applied to editor");
  }, [finalText, setContent]);

  const handleSaveFinalAsVersion = useCallback(async () => {
    if (!finalText.trim()) return;
    try {
      await createDraft({
        documentId: documentId as Id<"documents">,
        label: "AI final draft",
        title,
        content: finalText,
        ...(document?.frontmatter !== undefined
          ? { frontmatter: document.frontmatter }
          : {}),
        summary: "Generated from selected drafts and research context.",
      });
      toast.success("AI final draft saved as a version");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save AI final draft",
      );
    }
  }, [createDraft, document?.frontmatter, documentId, finalText, title]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(44rem,100vw)] max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <NotebookPen className="size-4 text-primary" />
            Document Workspace
          </SheetTitle>
          <SheetDescription>
            Save draft versions, collect research, and generate a final article
            from selected context.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <Tabs defaultValue="drafts">
            <TabsList className="w-full">
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="research">Research</TabsTrigger>
              <TabsTrigger value="ai">AI Final</TabsTrigger>
            </TabsList>

            <TabsContent value="drafts" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="draft-label">Version label</Label>
                    <Input
                      id="draft-label"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      placeholder={`Draft v${String((drafts?.length ?? 0) + 1)}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="draft-summary">Summary</Label>
                    <Input
                      id="draft-summary"
                      value={draftSummary}
                      onChange={(e) => setDraftSummary(e.target.value)}
                      placeholder="What changed in this version?"
                    />
                  </div>
                </div>
                <Button className="mt-3 w-full" onClick={handleSaveDraft}>
                  <FileClock className="size-4" />
                  Save Current Version
                </Button>
              </div>

              <div className="space-y-2">
                {drafts === undefined ? (
                  <LoadingRow label="Loading draft versions..." />
                ) : drafts.length === 0 ? (
                  <EmptyState message="No draft versions saved yet." />
                ) : (
                  drafts.map((draft) => {
                    const selected = selectedDraftIds.has(draft._id);
                    return (
                      <div
                        key={draft._id}
                        className="rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-start gap-3">
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
                            className="mt-1"
                            aria-label="Use draft in AI context"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">
                                {draft.label}
                              </p>
                              <Badge variant="outline">
                                {draft.wordCount} words
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {relativeTime(draft.createdAt)}
                              </span>
                            </div>
                            {draft.summary && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {draft.summary}
                              </p>
                            )}
                            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground/80">
                              {draft.contentSnapshot}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRestoreDraft(draft._id)}
                          >
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(draft.contentSnapshot)
                                .then(() => toast.success("Draft copied"))
                            }
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void removeDraft({
                                draftId: draft._id,
                              }).catch((error) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to delete draft",
                                ),
                              )
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="research" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="research-type">Type</Label>
                    <select
                      id="research-type"
                      value={researchType}
                      onChange={(e) =>
                        setResearchType(e.target.value as ResearchType)
                      }
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                    >
                      {RESEARCH_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="research-title">Title</Label>
                    <Input
                      id="research-title"
                      value={researchTitle}
                      onChange={(e) => setResearchTitle(e.target.value)}
                      placeholder="Research note title"
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    value={researchSource}
                    onChange={(e) => setResearchSource(e.target.value)}
                    placeholder="Source name"
                  />
                  <Input
                    value={researchUrl}
                    onChange={(e) => setResearchUrl(e.target.value)}
                    placeholder="https://source.example/article"
                  />
                </div>
                <Textarea
                  value={researchContent}
                  onChange={(e) => setResearchContent(e.target.value)}
                  placeholder="Paste research, quotes, outline, or notes..."
                  className="mt-3 min-h-32"
                />
                <Button className="mt-3 w-full" onClick={handleCreateResearch}>
                  Save Research
                </Button>
              </div>

              <div className="space-y-2">
                {research === undefined ? (
                  <LoadingRow label="Loading research..." />
                ) : research.length === 0 ? (
                  <EmptyState message="No research attached to this article yet." />
                ) : (
                  research.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{item.type}</Badge>
                            <p className="truncate text-sm font-medium">
                              {item.title}
                            </p>
                          </div>
                          {(item.sourceName || item.url) && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {[item.sourceName, item.url]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={item.selectedForAi}
                          onCheckedChange={(checked) =>
                            void toggleResearch({
                              researchId: item._id,
                              selectedForAi: checked,
                            })
                          }
                          aria-label="Use research in AI context"
                        />
                      </div>
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground/80">
                        {item.content}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void removeResearch({ researchId: item._id }).catch(
                              (error) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Failed to delete research",
                                ),
                            )
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Final draft context</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses current editor content, {selectedDraftIds.size}{" "}
                      selected draft versions, and {selectedResearchIds.length}{" "}
                      selected research items.
                    </p>
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={() => void handleGenerateFinalDraft()}
                  disabled={isStartingFinalDraft || isGeneratingFinal}
                >
                  {isStartingFinalDraft || isGeneratingFinal ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Generate Final Draft
                </Button>
              </div>

              {streamId && (
                <div className="space-y-3">
                  <div
                    ref={finalRef}
                    className="max-h-[48vh] overflow-y-auto rounded-lg border bg-background p-4 slim-scrollbar"
                  >
                    {isGeneratingFinal && !finalText ? (
                      <LoadingRow label="Generating final draft..." />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-7">
                        {finalText}
                      </p>
                    )}
                  </div>
                  {finalStatus === "error" && (
                    <p className="text-sm text-destructive">
                      Final draft generation failed. Try again.
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={!isFinalDone}
                      onClick={handleSaveFinalAsVersion}
                    >
                      Save as Version
                    </Button>
                    <Button
                      disabled={!isFinalDone}
                      onClick={handleApplyFinalDraft}
                    >
                      <Check className="size-4" />
                      Apply to Editor
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetBody>

        <SheetFooter>
          <p className="text-xs text-muted-foreground">
            Draft versions are snapshots. Research marked on is included in AI
            context.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
