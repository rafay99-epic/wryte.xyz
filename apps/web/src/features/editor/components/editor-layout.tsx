"use client";

import { api } from "@wryte/backend/_generated/api";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  type DocumentEditorTarget,
  documentEditorFeatures,
} from "@wryte/logic/lib/editor/features";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { DraftTabBar, type MainVersionLoader } from "./draft-tab-bar";
import { EditorProvider } from "./editor-context";
import { EditorMediaDialogs } from "./editor-media-dialogs";
import { EditorPanes } from "./editor-panes";
import { EditorToolbar } from "./editor-toolbar";
import { FrontmatterEditor } from "./frontmatter-editor";
import { ReadabilityPanel } from "./readability-panel";
import { ResearchPanel } from "./research-panel";

type EditorLayoutProps = {
  target: DocumentEditorTarget;
  loadMain: MainVersionLoader;
  onRequestSave: () => Promise<void>;
  onSynthesisOpen: () => void;
};

export function EditorLayout({
  target,
  loadMain,
  onRequestSave,
  onSynthesisOpen,
}: EditorLayoutProps) {
  const project = useAuthedQuery(api.cms.projects.get, {
    projectId: target.projectId,
  });
  const features = documentEditorFeatures(project);

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

  return (
    <EditorProvider>
      <EditorMediaDialogs target={target} />
      <div className="flex h-full flex-col">
        {!focusMode && <EditorToolbar target={target} features={features} />}
        {!focusMode && (
          <DraftTabBar
            target={target}
            loadMain={loadMain}
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
            <FrontmatterEditor
              documentId={target.documentId}
              projectId={target.projectId}
            />
          )}

          <EditorPanes
            target={target}
            features={features}
            sidePanels={
              <>
                <ResearchPanel
                  documentId={target.documentId}
                  open={researchPanelOpen}
                  onClose={toggleResearchPanel}
                />
                {features.readability && (
                  <ReadabilityPanel
                    open={readabilityPanelOpen}
                    onClose={toggleReadabilityPanel}
                  />
                )}
              </>
            }
          />
        </div>
      </div>
    </EditorProvider>
  );
}
