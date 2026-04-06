"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { EditorLayout } from "@/components/editor/editor-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsGet = (api as any).documents.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;

export default function EditorPage() {
  const params = useParams();
  const documentId = params["documentId"] as string;

  const document = useQuery(documentsGet, {
    documentId: documentId as Id<"documents">,
  });
  const project = useQuery(
    projectsGet,
    document ? { projectId: document.projectId } : "skip",
  );

  const { content, title, isDirty, setContent, setTitle, reset } =
    useEditorStore(
      useShallow((state) => ({
        content: state.content,
        title: state.title,
        isDirty: state.isDirty,
        setContent: state.setContent,
        setTitle: state.setTitle,
        reset: state.reset,
      })),
    );

  const hasInitialized = useRef(false);

  // Initialize the editor store when document loads
  useEffect(() => {
    if (document && !hasInitialized.current) {
      hasInitialized.current = true;
      setTitle(document.title);
      setContent(document.content);
      // Reset dirty state since we just loaded
      useEditorStore.setState({ isDirty: false });
    }
  }, [document, setContent, setTitle]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset();
      hasInitialized.current = false;
    };
  }, [reset]);

  // Update store if document changes externally (and user hasn't made edits)
  useEffect(() => {
    if (document && hasInitialized.current && !isDirty) {
      if (document.content !== content || document.title !== title) {
        setTitle(document.title);
        setContent(document.content);
        useEditorStore.setState({ isDirty: false });
      }
    }
  }, [document, isDirty, content, title, setContent, setTitle]);

  // Wire up autosave
  useAutosave({ documentId, content, title });

  if (document === undefined || project === undefined) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  if (document === null || project === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  return (
    <EditorLayout
      documentId={documentId}
      projectId={document.projectId as string}
    />
  );
}
