"use client";

import { useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { EditorProvider } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { FrontmatterEditor } from "./frontmatter-editor";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownPreview } from "./markdown-preview";

interface EditorLayoutProps {
  documentId: string;
  projectId: string;
}

/**
 * Editor layout with CSS-only fade-in transitions between view modes.
 *
 * Uses a pure CSS animation (.editor-pane-enter) triggered by React key
 * remounts instead of Framer Motion AnimatePresence. This keeps the pane
 * in normal document flow at all times — no position:absolute during
 * exit, so the flex container never collapses and the textarea keeps
 * its full width.
 */
export function EditorLayout({ documentId, projectId }: EditorLayoutProps) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleEditorScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    const editor = e.currentTarget;
    const preview = previewRef.current;
    if (!preview) return;

    const scrollRatio =
      editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);

    isSyncingScroll.current = true;
    preview.scrollTop =
      scrollRatio * (preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, []);

  const handlePreviewScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isSyncingScroll.current) return;
      const preview = e.currentTarget;
      const editorPane = preview.parentElement?.querySelector(
        "[data-editor-pane]",
      ) as HTMLDivElement | null;
      if (!editorPane) return;

      const scrollRatio =
        preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);

      isSyncingScroll.current = true;
      editorPane.scrollTop =
        scrollRatio * (editorPane.scrollHeight - editorPane.clientHeight);
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    },
    [],
  );

  return (
    <EditorProvider>
      <div className="flex h-full flex-col">
        <EditorToolbar projectId={projectId} />
        <FrontmatterEditor documentId={documentId} projectId={projectId} />

        {/* Editor content area — min-h-0 prevents flex overflow */}
        <div className="flex min-h-0 flex-1">
          {/* ── Edit-only view ── */}
          {viewMode === "edit" && (
            <div
              key="edit"
              className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
            >
              <MarkdownEditor />
            </div>
          )}

          {/* ── Preview-only view ── */}
          {viewMode === "preview" && (
            <div
              key="preview"
              className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
            >
              <div className="mx-auto max-w-[820px]">
                <MarkdownPreview />
              </div>
            </div>
          )}

          {/* ── Split view with synced scrolling ── */}
          {viewMode === "split" && (
            <div key="split" className="editor-pane-enter flex h-full w-full">
              {/* Editor pane */}
              <div
                data-editor-pane
                className="h-full w-1/2 overflow-y-auto hide-scrollbar"
                onScroll={handleEditorScroll}
              >
                <MarkdownEditor />
              </div>

              {/* Split divider */}
              <div className="split-divider" />

              {/* Preview pane */}
              <div
                ref={previewRef}
                className="h-full w-1/2 overflow-y-auto hide-scrollbar bg-muted/20"
                onScroll={handlePreviewScroll}
              >
                <div className="mx-auto max-w-[640px]">
                  <MarkdownPreview />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </EditorProvider>
  );
}
