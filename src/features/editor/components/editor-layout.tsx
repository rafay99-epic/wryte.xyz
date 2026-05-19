"use client";

import { useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { DraftTabBar } from "./draft-tab-bar";
import { EditorProvider } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { FrontmatterEditor } from "./frontmatter-editor";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownPreview } from "./markdown-preview";
import { ResearchPanel } from "./research-panel";

type EditorLayoutProps = {
  documentId: string;
  projectId: string;
  onRequestSave: () => Promise<void>;
  onSynthesisOpen: () => void;
};

export function EditorLayout({
  documentId,
  projectId,
  onRequestSave,
  onSynthesisOpen,
}: EditorLayoutProps) {
  const viewMode = useEditorStore((state) => state.viewMode);
  const focusMode = useEditorStore((state) => state.focusMode);
  const activeDraftId = useEditorStore((state) => state.activeDraftId);
  const researchPanelOpen = useEditorStore((state) => state.researchPanelOpen);
  const toggleResearchPanel = useEditorStore(
    (state) => state.toggleResearchPanel,
  );
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
        {!focusMode && (
          <EditorToolbar documentId={documentId} projectId={projectId} />
        )}
        {!focusMode && (
          <DraftTabBar
            documentId={documentId}
            onRequestSave={onRequestSave}
            onSynthesisOpen={onSynthesisOpen}
          />
        )}
        {!focusMode && activeDraftId === null && (
          <FrontmatterEditor documentId={documentId} projectId={projectId} />
        )}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {viewMode === "edit" && (
              <div
                key="edit"
                className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
              >
                <MarkdownEditor />
              </div>
            )}

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

            {viewMode === "split" && (
              <div key="split" className="editor-pane-enter flex h-full w-full">
                <div
                  data-editor-pane
                  className="h-full w-1/2 overflow-y-auto hide-scrollbar"
                  onScroll={handleEditorScroll}
                >
                  <MarkdownEditor />
                </div>
                <div className="split-divider" />
                <div
                  ref={previewRef}
                  className="h-full w-1/2 overflow-y-auto hide-scrollbar bg-muted/10"
                  onScroll={handlePreviewScroll}
                >
                  <div className="mx-auto max-w-[640px]">
                    <MarkdownPreview />
                  </div>
                </div>
              </div>
            )}
          </div>

          <ResearchPanel
            documentId={documentId}
            open={researchPanelOpen}
            onClose={toggleResearchPanel}
          />
        </div>
      </div>
    </EditorProvider>
  );
}
