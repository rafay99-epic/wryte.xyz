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

export function EditorLayout({ documentId, projectId }: EditorLayoutProps) {
  const viewMode = useEditorStore((state) => state.viewMode);

  return (
    <EditorProvider>
      <div className="flex h-full flex-col">
        <EditorToolbar documentId={documentId} projectId={projectId} />
        <FrontmatterEditor documentId={documentId} projectId={projectId} />
        <div className="flex min-h-0 flex-1">
          {viewMode === "edit" && (
            <div className="h-full w-full overflow-y-auto">
              <MarkdownEditor />
            </div>
          )}
          {viewMode === "preview" && (
            <div className="h-full w-full overflow-y-auto">
              <MarkdownPreview />
            </div>
          )}
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
