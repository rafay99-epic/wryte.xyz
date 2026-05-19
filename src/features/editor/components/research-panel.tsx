"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEditorContext } from "./editor-context";

type ResearchPanelProps = {
  documentId: string;
  open: boolean;
  onClose: () => void;
};

type ResearchType = "note" | "source" | "quote" | "outline" | "idea";

const TYPE_CONFIG: Record<
  ResearchType,
  { label: string; icon: React.ElementType }
> = {
  note: { label: "Note", icon: StickyNote },
  source: { label: "Source", icon: BookOpen },
  quote: { label: "Quote", icon: MessageSquareQuote },
  outline: { label: "Outline", icon: BookOpen },
  idea: { label: "Idea", icon: Lightbulb },
};

export function ResearchPanel({
  documentId,
  open,
  onClose,
}: ResearchPanelProps) {
  const { insertAtCursor } = useEditorContext();
  const research = useQuery(api.cms.documentResearch.list, {
    documentId: documentId as Id<"documents">,
  });
  const createResearch = useMutation(api.cms.documentResearch.create);
  const updateResearch = useMutation(api.cms.documentResearch.update);
  const toggleResearch = useMutation(
    api.cms.documentResearch.toggleSelectedForAi,
  );
  const removeResearch = useMutation(api.cms.documentResearch.remove);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<ResearchType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editType, setEditType] = useState<ResearchType>("note");

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setUrl("");
    setType("note");
    setShowForm(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Content is required");
      return;
    }
    try {
      await createResearch({
        documentId: documentId as Id<"documents">,
        type,
        title: title.trim() || "Untitled",
        content: content.trim(),
        ...(url.trim() ? { url: url.trim() } : {}),
        selectedForAi: true,
      });
      resetForm();
      toast.success("Research added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add research",
      );
    }
  }, [createResearch, documentId, type, title, content, url, resetForm]);

  const startEditing = useCallback(
    (item: {
      _id: string;
      type: string;
      title: string;
      content: string;
      url?: string;
    }) => {
      setEditingId(item._id);
      setEditTitle(item.title);
      setEditContent(item.content);
      setEditUrl(item.url ?? "");
      setEditType((item.type as ResearchType) ?? "note");
      setExpandedId(item._id);
    },
    [],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    try {
      await updateResearch({
        researchId: editingId as Id<"document_research">,
        type: editType,
        title: editTitle.trim() || "Untitled",
        content: editContent.trim(),
        url: editUrl.trim(),
      });
      setEditingId(null);
      toast.success("Research updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  }, [editingId, editType, editTitle, editContent, editUrl, updateResearch]);

  const handleInsert = useCallback(
    (itemContent: string, itemType: string) => {
      const formatted = itemType === "quote" ? `> ${itemContent}` : itemContent;
      insertAtCursor(`\n${formatted}\n`);
      toast.success("Inserted into editor");
    },
    [insertAtCursor],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="h-full shrink-0 overflow-hidden border-l border-border/40"
        >
          <div className="flex h-full w-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">
                Research
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto slim-scrollbar">
              {!showForm && (
                <div className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => setShowForm(true)}
                  >
                    <Plus className="size-3.5" />
                    Add Research
                  </Button>
                </div>
              )}

              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 border-b border-border/40 p-3">
                      <div className="flex gap-1">
                        {(
                          Object.entries(TYPE_CONFIG) as [
                            ResearchType,
                            (typeof TYPE_CONFIG)[ResearchType],
                          ][]
                        ).map(([key, cfg]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setType(key)}
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                              type === key
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Title (optional)"
                        className="h-7 text-xs"
                      />
                      <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Paste research, notes, quotes..."
                        className="min-h-20 resize-none text-xs"
                      />
                      <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="URL (optional)"
                        className="h-7 text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => void handleCreate()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={resetForm}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-px p-2">
                {research === undefined ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Loading...
                  </div>
                ) : research.length === 0 && !showForm ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    No research yet. Add notes, sources, and quotes to build
                    context for your article.
                  </div>
                ) : (
                  research.map((item) => {
                    const cfg =
                      TYPE_CONFIG[item.type as ResearchType] ??
                      TYPE_CONFIG.note;
                    const Icon = cfg.icon;
                    const isExpanded = expandedId === item._id;
                    const isEditing = editingId === item._id;

                    return (
                      <div
                        key={item._id}
                        className={cn(
                          "rounded-lg transition-colors",
                          isExpanded ? "bg-muted/30" : "hover:bg-muted/40",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) return;
                            setExpandedId(isExpanded ? null : item._id);
                          }}
                          className="flex w-full items-start gap-2 p-2.5 text-left"
                        >
                          <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium">
                                {item.title}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-3.5 shrink-0 px-1 text-[8px]"
                              >
                                {cfg.label}
                              </Badge>
                            </div>
                            {!isExpanded && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                {item.content}
                              </p>
                            )}
                          </div>
                          <ChevronDown
                            className={cn(
                              "mt-0.5 size-3 shrink-0 text-muted-foreground/50 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-2 px-2.5 pb-2.5">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="flex gap-1">
                                      {(
                                        Object.entries(TYPE_CONFIG) as [
                                          ResearchType,
                                          (typeof TYPE_CONFIG)[ResearchType],
                                        ][]
                                      ).map(([key, c]) => (
                                        <button
                                          key={key}
                                          type="button"
                                          onClick={() => setEditType(key)}
                                          className={cn(
                                            "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                                            editType === key
                                              ? "bg-primary/10 text-primary"
                                              : "text-muted-foreground hover:bg-muted",
                                          )}
                                        >
                                          {c.label}
                                        </button>
                                      ))}
                                    </div>
                                    <Input
                                      value={editTitle}
                                      onChange={(e) =>
                                        setEditTitle(e.target.value)
                                      }
                                      placeholder="Title"
                                      className="h-7 text-xs"
                                    />
                                    <Textarea
                                      value={editContent}
                                      onChange={(e) =>
                                        setEditContent(e.target.value)
                                      }
                                      className="min-h-24 resize-none text-xs"
                                    />
                                    <Input
                                      value={editUrl}
                                      onChange={(e) =>
                                        setEditUrl(e.target.value)
                                      }
                                      placeholder="URL (optional)"
                                      className="h-7 text-xs"
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        className="flex-1 gap-1 text-xs"
                                        onClick={() => void handleSaveEdit()}
                                      >
                                        <Check className="size-3" />
                                        Save
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => setEditingId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {item.url && (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary"
                                      >
                                        <ExternalLink className="size-2.5" />
                                        <span className="truncate">
                                          {item.url}
                                        </span>
                                      </a>
                                    )}
                                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                                      {item.content}
                                    </p>
                                    <div className="flex items-center justify-between pt-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground/60">
                                          AI context
                                        </span>
                                        <Switch
                                          checked={item.selectedForAi}
                                          onCheckedChange={(checked) =>
                                            void toggleResearch({
                                              researchId: item._id,
                                              selectedForAi: checked,
                                            })
                                          }
                                          className="scale-75"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleInsert(
                                              item.content,
                                              item.type,
                                            )
                                          }
                                          className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                                          title="Insert into editor"
                                        >
                                          <ArrowDownToLine className="size-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => startEditing(item)}
                                          className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                                          title="Edit"
                                        >
                                          <Pencil className="size-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void removeResearch({
                                              researchId: item._id,
                                            }).catch((error) =>
                                              toast.error(
                                                error instanceof Error
                                                  ? error.message
                                                  : "Failed to delete",
                                              ),
                                            )
                                          }
                                          className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-destructive"
                                          title="Delete"
                                        >
                                          <Trash2 className="size-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
