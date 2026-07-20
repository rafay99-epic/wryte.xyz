"use client";

import { useMutation } from "convex/react";
import { Columns2, Eye, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { EditorProvider } from "@/features/editor/components/editor-context";
import { MarkdownEditor } from "@/features/editor/components/markdown-editor";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MarkdownPreview = dynamic(
  () =>
    import("@/features/editor/components/markdown-preview").then(
      (m) => m.MarkdownPreview,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-sm text-muted-foreground/50">
        Loading preview…
      </div>
    ),
  },
);

/**
 * The professional writing surface, reused from the blog editor — same
 * MarkdownEditor (slash menu, selection formatting toolbar, inline AI, focus
 * mode), driven by the shared editor store. The blog-only chrome (draft tabs,
 * frontmatter, publish) is deliberately left out. The parent must have loaded
 * the newsletter body into the store via `initDocument` before mounting this.
 */
export function NewsletterEditorSurface({
  newsletterId,
  projectId,
  slashEnabled,
  snippetsEnabled,
  hasSnippets,
  selectionToolbarEnabled,
}: {
  newsletterId: Id<"newsletters">;
  projectId: string;
  slashEnabled: boolean;
  snippetsEnabled: boolean;
  hasSnippets: boolean;
  selectionToolbarEnabled: boolean;
}) {
  const update = useMutation(api.newsletter.newsletters.update);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const content = useEditorStore((s) => s.content);
  const isDirty = useEditorStore((s) => s.isDirty);

  // Debounced autosave of the body into the newsletter row.
  useEffect(() => {
    if (!isDirty) return;
    const t = setTimeout(() => {
      void update({ newsletterId, bodyMarkdown: content })
        .then(() => useEditorStore.getState().markSaved())
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [content, isDirty, newsletterId, update]);

  const editor = (
    <MarkdownEditor
      documentId={newsletterId}
      projectId={projectId}
      slashEnabled={slashEnabled}
      snippetsEnabled={snippetsEnabled}
      hasSnippets={hasSnippets}
      selectionToolbarEnabled={selectionToolbarEnabled}
    />
  );
  const preview = (
    <div className="prose prose-sm dark:prose-invert mx-auto max-w-[720px] px-8 py-8">
      <MarkdownPreview />
    </div>
  );

  return (
    <EditorProvider>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="flex items-center gap-1 border-b border-border/60 bg-muted/20 px-2 py-1.5">
          <ViewButton
            active={viewMode === "edit"}
            onClick={() => setViewMode("edit")}
            icon={Pencil}
            label="Write"
          />
          <ViewButton
            active={viewMode === "split"}
            onClick={() => setViewMode("split")}
            icon={Columns2}
            label="Split"
          />
          <ViewButton
            active={viewMode === "preview"}
            onClick={() => setViewMode("preview")}
            icon={Eye}
            label="Preview"
          />
          <span className="ml-auto pr-1 text-[11px] text-muted-foreground/50">
            {isDirty ? "Saving…" : "Saved"}
          </span>
        </div>

        <div className="h-[58vh] overflow-y-auto">
          {viewMode === "preview" ? (
            preview
          ) : viewMode === "split" ? (
            <div className="flex h-full">
              <div className="h-full w-1/2 overflow-y-auto border-r border-border/60">
                {editor}
              </div>
              <div className="h-full w-1/2 overflow-y-auto bg-muted/10">
                {preview}
              </div>
            </div>
          ) : (
            editor
          )}
        </div>
      </div>
    </EditorProvider>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
