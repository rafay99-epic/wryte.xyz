"use client";

import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, FileQuestion, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { EditorLayout } from "@/components/editor/editor-layout";
import { PublishHistoryPanel } from "@/components/editor/publish-history-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutosave } from "@/hooks/use-autosave";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
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

  const { content, title, isDirty, initDocument, reset } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      title: state.title,
      isDirty: state.isDirty,
      initDocument: state.initDocument,
      reset: state.reset,
    })),
  );

  const hasInitialized = useRef(false);
  /** Track which documentId we initialised for, so we re-init on navigation. */
  const initializedDocId = useRef<string | null>(null);

  // Initialize the editor store when document loads — uses a single atomic
  // update that does NOT mark the store dirty, preventing spurious autosaves.
  useEffect(() => {
    if (
      document &&
      (!hasInitialized.current || initializedDocId.current !== documentId)
    ) {
      hasInitialized.current = true;
      initializedDocId.current = documentId;
      initDocument(
        document.title,
        document.content,
        document.projectId as string,
      );
    }
  }, [document, documentId, initDocument]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset();
      hasInitialized.current = false;
      initializedDocId.current = null;
    };
  }, [reset]);

  // Update store if document changes externally (and user hasn't made edits).
  // Uses atomic initDocument to avoid marking dirty between setTitle/setContent.
  useEffect(() => {
    if (document && hasInitialized.current && !isDirty) {
      if (document.content !== content || document.title !== title) {
        initDocument(
          document.title,
          document.content,
          document.projectId as string,
        );
      }
    }
  }, [document, isDirty, content, title, initDocument]);

  // Wire up autosave
  useAutosave({ documentId, content, title });

  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen);
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel);

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
    return <DocumentNotFound />;
  }

  return (
    <div className="relative h-full overflow-hidden">
      <EditorLayout
        documentId={documentId}
        projectId={document.projectId as string}
      />
      <PublishHistoryPanel
        documentId={documentId}
        open={historyPanelOpen}
        onClose={toggleHistoryPanel}
      />
    </div>
  );
}

/**
 * Friendly not-found state shown when the document or its parent project
 * no longer exists (e.g. deleted, bad URL).
 */
function DocumentNotFound() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mx-auto max-w-sm text-center"
      >
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-muted/60">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
          Document not found
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          This document doesn&apos;t exist or may have been deleted. Check the
          URL or head back to your projects.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Go back
          </Button>
          <Link href="/dashboard" className={cn(buttonVariants(), "gap-2")}>
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
