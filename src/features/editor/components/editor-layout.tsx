"use client";

import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DraftTabBar } from "./draft-tab-bar";
import { EditorProvider } from "./editor-context";
import { EditorMediaDialogs } from "./editor-media-dialogs";
import { EditorToolbar } from "./editor-toolbar";
import { FindReplaceBar } from "./find-replace-bar";
import { FrontmatterEditor } from "./frontmatter-editor";
import { MarkdownEditor } from "./markdown-editor";
import { OutlinePanel } from "./outline-panel";
import { ReadabilityPanel } from "./readability-panel";
import { ResearchPanel } from "./research-panel";
import { SprintHud } from "./sprint-hud";

// The previews pull heavy libraries — react-markdown + rehype/remark (~400 KB)
// and @mdx-js/mdx (~370 KB). They only render in preview/split mode, so load
// them lazily: edit mode (the default) never pays for them.
const previewLoading = () => (
  <div className="p-8 text-sm text-muted-foreground/50">Loading preview…</div>
);
const MarkdownPreview = dynamic(
  () => import("./markdown-preview").then((m) => m.MarkdownPreview),
  { ssr: false, loading: previewLoading },
);
const MdxPreview = dynamic(
  () => import("./mdx-preview").then((m) => m.MdxPreview),
  { ssr: false, loading: previewLoading },
);

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
  const snippetsEnabled = project?.snippetsEnabled ?? false;
  // The selection toolbar is on unless explicitly disabled — it costs
  // nothing until text is actually selected.
  const selectionToolbarEnabled = project?.selectionToolbarEnabled ?? true;
  // Whether to show the "Snippets ▸" entry — decided from the denormalized
  // count on the already-fetched project doc, so the slash menu fires no query
  // at the root level.
  const hasSnippets = (project?.snippetCount ?? 0) > 0;

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
  const outlinePanelOpen = useEditorStore((state) => state.outlinePanelOpen);
  const toggleOutlinePanel = useEditorStore(
    (state) => state.toggleOutlinePanel,
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
      <EditorMediaDialogs documentId={documentId} projectId={projectId} />
      <div className="flex h-full flex-col">
        {!focusMode && (
          <EditorToolbar
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
          <div className="relative flex min-w-0 flex-1 flex-col">
            <FindReplaceBar />
            {/* Sprint pill — floats over the editor pane, incl. focus mode */}
            <SprintHud />
            {viewMode === "edit" && (
              <div
                key="edit"
                className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
              >
                <MarkdownEditor
                  documentId={documentId}
                  projectId={projectId}
                  slashEnabled={slashEnabled}
                  snippetsEnabled={snippetsEnabled}
                  hasSnippets={hasSnippets}
                  selectionToolbarEnabled={selectionToolbarEnabled}
                />
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
                  <MarkdownEditor
                    documentId={documentId}
                    projectId={projectId}
                    slashEnabled={slashEnabled}
                    snippetsEnabled={snippetsEnabled}
                    hasSnippets={hasSnippets}
                    selectionToolbarEnabled={selectionToolbarEnabled}
                  />
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

          <OutlinePanel open={outlinePanelOpen} onClose={toggleOutlinePanel} />

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
