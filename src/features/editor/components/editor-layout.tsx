"use client";

import { useQuery } from "convex/react";
import { useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DraftTabBar } from "./draft-tab-bar";
import { EditorProvider } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { FrontmatterEditor } from "./frontmatter-editor";
import { MarkdownEditor } from "./markdown-editor";
import { MarkdownPreview } from "./markdown-preview";
import { MdxPreview } from "./mdx-preview";
import { ReadabilityPanel } from "./readability-panel";
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
  const project = useQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const isMdx = project?.contentFormat === "mdx";
  // Per-project editor feature toggles (default off). Read from the
  // already-fetched project doc — no extra query.
  const readabilityEnabled = project?.readabilityLensEnabled ?? false;
  const slashEnabled = project?.slashCommandsEnabled ?? false;

  const viewMode = useEditorStore((state) => state.viewMode);
  const focusMode = useEditorStore((state) => state.focusMode);
  const activeDraftId = useEditorStore((state) => state.activeDraftId);
  const researchPanelOpen = useEditorStore((state) => state.researchPanelOpen);
  const toggleResearchPanel = useEditorStore(
    (state) => state.toggleResearchPanel,
  );
  const readabilityPanelOpen = useEditorStore(
    (state) => state.readabilityPanelOpen,
  );
  const toggleReadabilityPanel = useEditorStore(
    (state) => state.toggleReadabilityPanel,
  );
  const previewRef = useRef<HTMLDivElement>(null);
  // Ref to the editor pane so the preview→editor sync doesn't have to call
  // querySelector on every scroll event (which fires at the refresh rate of
  // the user's input device, easily thousands of times per second on a
  // momentum scroll).
  const editorPaneRef = useRef<HTMLDivElement>(null);
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
      const editorPane = editorPaneRef.current;
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
          <EditorToolbar
            documentId={documentId}
            projectId={projectId}
            readabilityEnabled={readabilityEnabled}
          />
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
                <MarkdownEditor slashEnabled={slashEnabled} />
              </div>
            )}

            {viewMode === "preview" && (
              <div
                key="preview"
                className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
              >
                <div className="mx-auto max-w-[820px]">
                  {isMdx ? <MdxPreview /> : <MarkdownPreview />}
                </div>
              </div>
            )}

            {viewMode === "split" && (
              <div key="split" className="editor-pane-enter flex h-full w-full">
                <div
                  ref={editorPaneRef}
                  data-editor-pane
                  className="h-full w-1/2 overflow-y-auto hide-scrollbar"
                  onScroll={handleEditorScroll}
                >
                  <MarkdownEditor slashEnabled={slashEnabled} />
                </div>
                <div className="split-divider" />
                <div
                  ref={previewRef}
                  className="h-full w-1/2 overflow-y-auto hide-scrollbar bg-muted/10"
                  onScroll={handlePreviewScroll}
                >
                  <div className="mx-auto max-w-[640px]">
                    {isMdx ? <MdxPreview /> : <MarkdownPreview />}
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

          {readabilityEnabled && (
            <ReadabilityPanel
              open={readabilityPanelOpen}
              onClose={toggleReadabilityPanel}
            />
          )}
        </div>
      </div>
    </EditorProvider>
  );
}
