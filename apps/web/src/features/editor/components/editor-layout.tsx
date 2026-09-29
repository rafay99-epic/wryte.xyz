"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import dynamic from "next/dynamic";
import { useSplitScrollSync } from "../hooks/use-split-scroll-sync";
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
  mainDocument: { title: string; content: string } | null | undefined;
  onRequestSave: () => Promise<void>;
  onSynthesisOpen: () => void;
};

export function EditorLayout({
  documentId,
  projectId,
  mainDocument,
  onRequestSave,
  onSynthesisOpen,
}: EditorLayoutProps) {
  const project = useAuthedQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const isMdx = project?.contentFormat === "mdx";
  const readabilityEnabled = project?.readabilityLensEnabled ?? false;
  const animationsEnabled =
    isMdx && !!project?.animationsPath && (project.animationsEnabled ?? true);
  const slashEnabled = project?.slashCommandsEnabled ?? false;
  const snippetsEnabled = project?.snippetsEnabled ?? false;
  const selectionToolbarEnabled = project?.selectionToolbarEnabled ?? true;
  const hasSnippets = (project?.snippetCount ?? 0) > 0;

  const viewMode = useEditorStore((state) => state.viewMode);
  const focusMode = useEditorStore((state) => state.focusMode);
  const activeDraftId = useEditorStore((state) => state.activeDraftId);
  const isVersionSwitching = useEditorStore(
    (state) => state.switchTarget !== null,
  );
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
  const {
    editorPaneRef,
    previewRef,
    onEditorScroll,
    onPreviewScroll,
    setOwner,
  } = useSplitScrollSync(viewMode === "split");

  return (
    <EditorProvider>
      <EditorMediaDialogs documentId={documentId} projectId={projectId} />
      <div className="flex h-full flex-col">
        {!focusMode && (
          <EditorToolbar
            projectId={projectId}
            readabilityEnabled={readabilityEnabled}
            animationsEnabled={animationsEnabled}
          />
        )}
        {!focusMode && (
          <DraftTabBar
            documentId={documentId}
            projectId={projectId}
            mainDocument={mainDocument}
            onRequestSave={onRequestSave}
            onSynthesisOpen={onSynthesisOpen}
          />
        )}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity duration-200 ease-out",
            isVersionSwitching ? "opacity-40 delay-150" : "opacity-100 delay-0",
          )}
        >
          {!focusMode && activeDraftId === null && (
            <FrontmatterEditor documentId={documentId} projectId={projectId} />
          )}

          <div className="flex min-h-0 flex-1">
            <div className="relative flex min-w-0 flex-1 flex-col">
              <FindReplaceBar />
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
                    animationsEnabled={animationsEnabled}
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
                    {isMdx ? (
                      <MdxPreview animationsEnabled={animationsEnabled} />
                    ) : (
                      <MarkdownPreview />
                    )}
                  </div>
                </div>
              )}

              {viewMode === "split" && (
                <div
                  key="split"
                  className="editor-pane-enter flex h-full w-full"
                >
                  <div
                    ref={editorPaneRef}
                    data-editor-pane
                    className="h-full w-1/2 overflow-y-auto hide-scrollbar"
                    onScroll={onEditorScroll}
                    onPointerEnter={() => setOwner("editor")}
                    onTouchStart={() => setOwner("editor")}
                    onKeyDownCapture={() => setOwner("editor")}
                  >
                    <MarkdownEditor
                      documentId={documentId}
                      projectId={projectId}
                      slashEnabled={slashEnabled}
                      snippetsEnabled={snippetsEnabled}
                      hasSnippets={hasSnippets}
                      animationsEnabled={animationsEnabled}
                      selectionToolbarEnabled={selectionToolbarEnabled}
                    />
                  </div>
                  <div className="split-divider" />
                  <div
                    ref={previewRef}
                    data-testid="split-preview-pane"
                    className="h-full w-1/2 overflow-y-auto hide-scrollbar bg-muted/10"
                    onScroll={onPreviewScroll}
                    onPointerEnter={() => setOwner("preview")}
                    onTouchStart={() => setOwner("preview")}
                  >
                    <div className="mx-auto max-w-[640px]">
                      {isMdx ? (
                        <MdxPreview animationsEnabled={animationsEnabled} />
                      ) : (
                        <MarkdownPreview />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <OutlinePanel
              open={outlinePanelOpen}
              onClose={toggleOutlinePanel}
            />

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
      </div>
    </EditorProvider>
  );
}
