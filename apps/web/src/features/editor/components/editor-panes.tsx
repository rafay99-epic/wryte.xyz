"use client";

import type { EditorFeatures } from "@wryte/logic/lib/editor/features";
import type { EditorTarget } from "@wryte/logic/lib/editor/target";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useSplitScrollSync } from "../hooks/use-split-scroll-sync";
import { FindReplaceBar } from "./find-replace-bar";
import { MarkdownEditor } from "./markdown-editor";
import { OutlinePanel } from "./outline-panel";
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

type EditorPanesProps = {
  target: EditorTarget;
  features: EditorFeatures;
  sidePanels?: ReactNode;
  onBlur?: () => void;
};

export function EditorPanes({
  target,
  features,
  sidePanels,
  onBlur,
}: EditorPanesProps) {
  const viewMode = useEditorStore((state) => state.viewMode);
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

  const editor = (
    <MarkdownEditor
      target={target}
      features={features}
      {...(onBlur ? { onBlur } : {})}
    />
  );
  const preview = features.mdx ? (
    <MdxPreview animationsEnabled={features.animations} />
  ) : (
    <MarkdownPreview />
  );

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <FindReplaceBar />
        <SprintHud />
        {viewMode === "edit" && (
          <div
            key="edit"
            className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
          >
            {editor}
          </div>
        )}

        {viewMode === "preview" && (
          <div
            key="preview"
            className="editor-pane-enter h-full w-full overflow-y-auto slim-scrollbar"
          >
            <div className="mx-auto max-w-[820px]">{preview}</div>
          </div>
        )}

        {viewMode === "split" && (
          <div key="split" className="editor-pane-enter flex h-full w-full">
            <div
              ref={editorPaneRef}
              data-editor-pane
              className="h-full w-1/2 overflow-y-auto hide-scrollbar"
              onScroll={onEditorScroll}
              onPointerEnter={() => setOwner("editor")}
              onTouchStart={() => setOwner("editor")}
              onKeyDownCapture={() => setOwner("editor")}
            >
              {editor}
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
              <div className="mx-auto max-w-[640px]">{preview}</div>
            </div>
          </div>
        )}
      </div>

      <OutlinePanel open={outlinePanelOpen} onClose={toggleOutlinePanel} />

      {sidePanels}
    </div>
  );
}
