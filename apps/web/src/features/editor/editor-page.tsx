"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import type { BodySnapshot } from "@wryte/logic/lib/editor/body-sync";
import type { DocumentEditorTarget } from "@wryte/logic/lib/editor/features";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";
import { fadeSlideUp, smoothTransition } from "@wryte/logic/lib/motion";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Button, buttonVariants } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, FileQuestion, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { ConflictLockView } from "@/components/editor/conflict-lock-view";
import { EditorLayout } from "@/features/editor/components/editor-layout";
import { ExternalChangeBar } from "@/features/editor/components/external-change-bar";
import { HistoryPanel } from "@/features/editor/components/history-panel";
import {
  type SaveOptions,
  useAutosave,
} from "@/features/editor/hooks/use-autosave";
import { useBodySync } from "@/features/editor/hooks/use-body-sync";
import { useSaveShortcut } from "@/features/editor/hooks/use-save-shortcut";
import { useVersionSnapshots } from "@/features/editor/hooks/use-version-snapshots";
import { AiSynthesisDialog } from "./components/ai-synthesis-dialog";

export function EditorPage({ documentId }: { documentId: string }) {
  return (
    <ArticleEditor
      key={documentId}
      documentId={documentId as Id<"documents">}
    />
  );
}

function ArticleEditor({ documentId }: { documentId: Id<"documents"> }) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const document = useAuthedQuery(api.cms.documents.getMeta, { documentId });
  const project = useAuthedQuery(
    api.cms.projects.get,
    document ? { projectId: document.projectId } : "skip",
  );
  const openConflict = useQuery(api.cms.conflicts.getOpenByDocument, {
    documentId,
  });

  const autosaveBody = useMutation(api.cms.documents.autosaveBody);
  const autosaveDraftContent = useMutation(
    api.cms.documentDrafts.autosaveContent,
  );
  const updateDraftContent = useMutation(api.cms.documentDrafts.updateContent);

  const fetchBody = useCallback(async (): Promise<BodySnapshot | null> => {
    const body = await convex.query(api.cms.documents.getBody, { documentId });
    return body && { content: body.content, rev: body.contentRev };
  }, [convex, documentId]);

  const sync = useBodySync({
    targetId: documentId,
    meta:
      document === undefined
        ? undefined
        : document && {
            rev: document.contentRev ?? 0,
            ...(document.contentWriter !== undefined
              ? { writer: document.contentWriter }
              : {}),
          },
    fetchBody,
    enabled: isAuthenticated,
  });

  const projectId = document?.projectId;
  const target = useMemo<DocumentEditorTarget | null>(
    () => (projectId ? { kind: "document", documentId, projectId } : null),
    [documentId, projectId],
  );

  const {
    content,
    title,
    isDirty,
    activeDraftId,
    initDocument,
    syncTitle,
    reset,
    setActiveDraftId,
  } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      title: state.title,
      isDirty: state.isDirty,
      activeDraftId: state.activeDraftId,
      initDocument: state.initDocument,
      syncTitle: state.syncTitle,
      reset: state.reset,
      setActiveDraftId: state.setActiveDraftId,
    })),
  );

  const bodyApplied = useEditorStore(
    (state) =>
      state.target?.kind === "document" &&
      state.target.documentId === documentId,
  );
  const titleRef = useRef(document?.title ?? "");
  useEffect(() => {
    if (document) titleRef.current = document.title;
  }, [document]);

  useEffect(() => {
    if (bodyApplied || !target || !document || !sync.body) return;
    initDocument(document.title, sync.body.content, target);
    setActiveDraftId(null);
  }, [
    bodyApplied,
    target,
    document,
    sync.body,
    initDocument,
    setActiveDraftId,
  ]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const applyMain = useCallback(
    (body: BodySnapshot, force: boolean): boolean => {
      if (!target) return false;
      const state = useEditorStore.getState();
      if (state.activeDraftId !== null) return false;
      if (!force && state.isDirty) return false;
      const nextTitle = titleRef.current;
      if (
        state.isDirty ||
        state.content !== body.content ||
        state.title !== nextTitle
      ) {
        initDocument(nextTitle, body.content, target);
      }
      return true;
    },
    [initDocument, target],
  );

  const { externalChange, reload } = sync;
  useEffect(() => {
    if (!bodyApplied || !externalChange || isDirty || activeDraftId !== null) {
      return;
    }
    reload((body) => applyMain(body, false)).catch((error: unknown) => {
      console.error("[Editor] Failed to reload changed body:", error);
    });
  }, [bodyApplied, externalChange, isDirty, activeDraftId, reload, applyMain]);

  useEffect(() => {
    if (!bodyApplied || !document || isDirty || activeDraftId !== null) return;
    if (document.title !== title) syncTitle(document.title);
  }, [bodyApplied, document, isDirty, activeDraftId, title, syncTitle]);

  const loadMain = useCallback(async () => {
    const body = await reload(() => true);
    return body && { title: titleRef.current, content: body.content };
  }, [reload]);

  const [dismissedRev, setDismissedRev] = useState<number | null>(null);
  const metaRev = document?.contentRev ?? 0;
  const showExternalChange =
    bodyApplied &&
    externalChange &&
    isDirty &&
    activeDraftId === null &&
    dismissedRev !== metaRev;

  const handleExternalReload = useCallback(() => {
    reload((body) => applyMain(body, true)).catch(() => {
      toast.error("Couldn't reload the article. Try again.");
    });
  }, [reload, applyMain]);

  const onSave = useCallback(
    async (c: string, t: string, { flush }: SaveOptions) => {
      if (activeDraftId === null) {
        await autosaveBody({
          documentId,
          content: c,
          title: t,
          writer: EDITOR_SESSION_ID,
          ...(flush ? { flush: true } : {}),
        });
        return;
      }
      const args = {
        draftId: activeDraftId as Id<"document_drafts">,
        content: c,
        title: t,
      };
      await (flush ? updateDraftContent(args) : autosaveDraftContent(args));
    },
    [
      activeDraftId,
      autosaveBody,
      autosaveDraftContent,
      documentId,
      updateDraftContent,
    ],
  );

  const autoSaveEnabled =
    bodyApplied && (project?.autoSaveEnabled ?? true) && openConflict == null;
  const { saveNow } = useAutosave({
    targetId: activeDraftId ?? documentId,
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

  const { snapshotNow } = useVersionSnapshots({
    documentId,
    enabled: bodyApplied && openConflict == null,
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

  if (document === null || project === null || sync.body === null) {
    return <DocumentNotFound />;
  }

  if (document === undefined || project === undefined || !target) {
    return <EditorSkeleton />;
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

  if (!bodyApplied) {
    return <EditorSkeleton />;
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {showExternalChange && (
        <ExternalChangeBar
          onReload={handleExternalReload}
          onDismiss={() => setDismissedRev(metaRev)}
        />
      )}
      <div className="min-h-0 flex-1">
        <EditorLayout
          target={target}
          loadMain={loadMain}
          onRequestSave={handleRequestSave}
          onSynthesisOpen={() => setSynthesisOpen(true)}
        />
      </div>
      <HistoryPanel
        documentId={documentId}
        open={historyPanelOpen}
        onClose={toggleHistoryPanel}
      />
      <AiSynthesisDialog
        open={synthesisOpen}
        onOpenChange={setSynthesisOpen}
        target={target}
        onRequestSave={handleRequestSave}
      />
    </div>
  );
}

function EditorSkeleton() {
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
