"use client";

import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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
  /**
   * Main document title+content from the editor page's live subscription —
   * threaded down so the draft tab bar never opens its own body-bearing
   * subscription (see documents.getMeta rationale).
   */
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
  // True while a draft/Main switch is awaiting its flush or content fetch.
  // The writing surface dims (and fades back in when the new content lands);
  // instant cache-hit switches resolve before a frame renders, so they never
  // visibly flicker.
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
        {/* Writing surface (frontmatter + editor panes). Dims as one unit
            while a version switch is in flight and fades back when the new
            content lands, so tab changes read as a deliberate transition
            instead of a hard content snap. */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity duration-200 ease-out",
            // The 150ms delay means fast switches (cache hits, local dev)
            // complete before the dim ever becomes visible — no flicker.
            // Un-dimming is immediate so content feels snappy on arrival.
            isVersionSwitching ? "opacity-40 delay-150" : "opacity-100 delay-0",
          )}
        >
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
                    // Typing scrolls the caret into view even while the
                    // pointer rests over the preview — keys reclaim ownership.
                    onKeyDownCapture={() => setOwner("editor")}
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
                    data-testid="split-preview-pane"
                    className="h-full w-1/2 overflow-y-auto hide-scrollbar bg-muted/10"
                    onScroll={onPreviewScroll}
                    onPointerEnter={() => setOwner("preview")}
                    onTouchStart={() => setOwner("preview")}
                  >
                    <div className="mx-auto max-w-[640px]">
                      {isMdx ? <MdxPreview /> : <MarkdownPreview />}
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
