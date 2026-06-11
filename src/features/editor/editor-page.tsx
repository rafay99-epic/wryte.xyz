"use client";

import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, FileQuestion, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { ConflictLockView } from "@/components/editor/conflict-lock-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorLayout } from "@/features/editor/components/editor-layout";
import { HistoryPanel } from "@/features/editor/components/history-panel";
import { useAutosave } from "@/features/editor/hooks/use-autosave";
import { useSaveShortcut } from "@/features/editor/hooks/use-save-shortcut";
import { useVersionSnapshots } from "@/features/editor/hooks/use-version-snapshots";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AiSynthesisDialog } from "./components/ai-synthesis-dialog";

export function EditorPage() {
  const params = useParams();
  const documentId = params["documentId"] as string;

  const document = useQuery(api.cms.documents.get, {
    documentId: documentId as Id<"documents">,
  });
  const project = useQuery(
    api.cms.projects.get,
    document ? { projectId: document.projectId } : "skip",
  );
  const openConflict = useQuery(api.cms.conflicts.getOpenByDocument, {
    documentId: documentId as Id<"documents">,
  });

  const updateDocument = useMutation(api.cms.documents.update);
  const updateDraftContent = useMutation(api.cms.documentDrafts.updateContent);

  const {
    content,
    title,
    isDirty,
    activeDraftId,
    initDocument,
    reset,
    setActiveDraftId,
  } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      title: state.title,
      isDirty: state.isDirty,
      activeDraftId: state.activeDraftId,
      initDocument: state.initDocument,
      reset: state.reset,
      setActiveDraftId: state.setActiveDraftId,
    })),
  );

  const hasInitialized = useRef(false);
  const initializedDocId = useRef<string | null>(null);

  // Initialize the editor store when the document loads, and re-initialize
  // when the URL switches to a different document. Note: we intentionally
  // DO NOT eagerly reset on documentId change — that would race with any
  // pending autosave for the previous document and drop unsaved edits. The
  // tradeoff is a brief flash of the previous doc's content while the new
  // document query resolves.
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
      setActiveDraftId(null);
    }
  }, [document, documentId, initDocument, setActiveDraftId]);

  useEffect(() => {
    return () => {
      reset();
      hasInitialized.current = false;
      initializedDocId.current = null;
    };
  }, [reset]);

  useEffect(() => {
    if (
      document &&
      hasInitialized.current &&
      !isDirty &&
      activeDraftId === null
    ) {
      if (document.content !== content || document.title !== title) {
        initDocument(
          document.title,
          document.content,
          document.projectId as string,
        );
      }
    }
  }, [document, isDirty, content, title, initDocument, activeDraftId]);

  const saveDocument = useCallback(
    async (c: string, t: string) => {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        content: c,
        title: t,
      });
    },
    [documentId, updateDocument],
  );

  const saveDraft = useCallback(
    async (c: string, t: string) => {
      if (!activeDraftId) return;
      await updateDraftContent({
        draftId: activeDraftId as Id<"document_drafts">,
        content: c,
        title: t,
      });
    },
    [activeDraftId, updateDraftContent],
  );

  const targetId = activeDraftId ?? documentId;
  const onSave = activeDraftId ? saveDraft : saveDocument;

  const autoSaveEnabled =
    (project?.autoSaveEnabled ?? true) && openConflict == null;
  const { saveNow } = useAutosave({
    targetId,
    content,
    title,
    onSave,
    enabled: autoSaveEnabled,
  });

  const handleRequestSave = useCallback(async () => {
    if (useEditorStore.getState().isDirty) {
      await saveNow();
    }
  }, [saveNow]);

  // Version snapshots: captured after manual saves and on a coarse
  // interval while editing the main stream. Deduped server-side.
  const { snapshotNow } = useVersionSnapshots({
    documentId,
    enabled: hasInitialized.current && openConflict == null,
  });

  const handleManualSave = useCallback(() => {
    if (!useEditorStore.getState().isDirty) {
      toast.info("Nothing to save", { id: "manual-save" });
      return;
    }
    void saveNow()
      .then(() => {
        toast.success("Saved", { id: "manual-save", duration: 1500 });
        snapshotNow("manual");
      })
      .catch(() => {
        toast.error("Save failed", { id: "manual-save" });
      });
  }, [saveNow, snapshotNow]);
  useSaveShortcut(handleManualSave);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const historyPanelOpen = useEditorStore((s) => s.historyPanelOpen);
  const toggleHistoryPanel = useEditorStore((s) => s.toggleHistoryPanel);
  const [synthesisOpen, setSynthesisOpen] = useState(false);

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

  if (openConflict) {
    return (
      <ConflictLockView
        projectId={openConflict.projectId}
        conflictId={openConflict._id}
        githubPath={openConflict.githubPath}
        title={document.title}
      />
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      <EditorLayout
        documentId={documentId}
        projectId={document.projectId as string}
        onRequestSave={handleRequestSave}
        onSynthesisOpen={() => setSynthesisOpen(true)}
      />
      <HistoryPanel
        documentId={documentId}
        open={historyPanelOpen}
        onClose={toggleHistoryPanel}
      />
      <AiSynthesisDialog
        open={synthesisOpen}
        onOpenChange={setSynthesisOpen}
        documentId={documentId}
        projectId={document.projectId as string}
      />
    </div>
  );
}

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
