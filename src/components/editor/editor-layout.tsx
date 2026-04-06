"use client";

import { Separator } from "@/components/ui/separator";
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
 * Top-level layout for the document editor page.
 * Wraps everything in EditorProvider so toolbar, textarea, and preview
 * can share a single textarea ref for programmatic text manipulation.
 *
 * Renders three possible view modes driven by Zustand state:
 *  - "edit"    : full-width markdown textarea
 *  - "preview" : full-width rendered markdown
 *  - "split"   : side-by-side editor + preview (50/50)
 */
export function EditorLayout({ documentId, projectId }: EditorLayoutProps) {
  const viewMode = useEditorStore((state) => state.viewMode);

  return (
    <EditorProvider>
      <div className="flex h-full flex-col">
        <EditorToolbar documentId={documentId} projectId={projectId} />
        <FrontmatterEditor documentId={documentId} projectId={projectId} />
        {/* min-h-0 prevents flex children from overflowing the viewport */}
        <div className="flex min-h-0 flex-1">
          {/* Edit-only view */}
          {viewMode === "edit" && (
            <div className="h-full w-full overflow-y-auto">
              <MarkdownEditor />
            </div>
          )}
          {/* Preview-only view */}
          {viewMode === "preview" && (
            <div className="h-full w-full overflow-y-auto">
              <MarkdownPreview />
            </div>
          )}
          {/* Side-by-side split view with a vertical divider */}
          {viewMode === "split" && (
            <>
              <div className="h-full w-1/2 overflow-y-auto">
                <MarkdownEditor />
              </div>
              <Separator orientation="vertical" />
              <div className="h-full w-1/2 overflow-y-auto">
                <MarkdownPreview />
              </div>
            </>
          )}
        </div>
      </div>
    </EditorProvider>
  );
}
