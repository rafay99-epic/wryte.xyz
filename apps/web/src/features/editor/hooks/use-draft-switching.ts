"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useConvex } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

export const MAIN_TAB = "main";

const REVALIDATE_TTL_MS = 30_000;

type VersionContent = { title: string; content: string };

type CacheEntry = VersionContent & { validatedAt: number };

type DraftMeta = { _id: string; wordCount: number };

type UseDraftSwitchingOptions = {
  projectId: string;
  document: { title: string; content: string } | null | undefined;
  drafts: DraftMeta[] | undefined;
  onRequestSave: () => Promise<void>;
};

type UseDraftSwitchingReturn = {
  switchToDraft: (draftId: string | null) => Promise<boolean>;
  evictDraft: (draftId: string) => void;
  seedDraft: (
    draftId: string,
    content: VersionContent,
    verified: boolean,
  ) => void;
  applyPromotedMain: (main: VersionContent) => void;
};

export function useDraftSwitching({
  projectId,
  document,
  drafts,
  onRequestSave,
}: UseDraftSwitchingOptions): UseDraftSwitchingReturn {
  const convex = useConvex();
  const initDocument = useEditorStore((s) => s.initDocument);
  const setActiveDraftId = useEditorStore((s) => s.setActiveDraftId);
  const setSwitchTarget = useEditorStore((s) => s.setSwitchTarget);

  const cacheRef = useRef(new Map<string, CacheEntry>());
  const seqRef = useRef(0);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const revalidate = useCallback(
    (draftId: string, seq: number) => {
      void convex
        .query(api.cms.documentDrafts.getContent, {
          draftId: draftId as Id<"document_drafts">,
        })
        .then((fresh) => {
          if (!fresh) return;
          cacheRef.current.set(draftId, {
            title: fresh.title,
            content: fresh.content,
            validatedAt: Date.now(),
          });
          if (seq !== seqRef.current) return;
          const state = useEditorStore.getState();
          if (state.activeDraftId !== draftId || state.isDirty) return;
          if (state.content === fresh.content && state.title === fresh.title) {
            return;
          }
          initDocument(fresh.title, fresh.content, projectId);
        })
        .catch(() => {});
    },
    [convex, initDocument, projectId],
  );

  const switchToDraft = useCallback(
    async (draftId: string | null): Promise<boolean> => {
      const state = useEditorStore.getState();
      if (draftId === state.activeDraftId) return true;
      const seq = ++seqRef.current;
      setSwitchTarget(draftId ?? MAIN_TAB);
      try {
        if (state.activeDraftId !== null) {
          cacheRef.current.set(state.activeDraftId, {
            title: state.title,
            content: state.content,
            validatedAt: Date.now(),
          });
        }

        const meta = draftsRef.current?.find((d) => d._id === draftId);
        const cached =
          draftId !== null
            ? (cacheRef.current.get(draftId) ??
              (meta?.wordCount === 0
                ? { title: "", content: "", validatedAt: 0 }
                : undefined))
            : undefined;

        const [, fetched] = await Promise.all([
          onRequestSave(),
          draftId !== null && cached === undefined
            ? convex.query(api.cms.documentDrafts.getContent, {
                draftId: draftId as Id<"document_drafts">,
              })
            : Promise.resolve(null),
        ]);
        if (seq !== seqRef.current) return false;

        if (draftId === null) {
          if (!document) {
            toast.error("The main article hasn't loaded yet — try again");
            return false;
          }
          initDocument(document.title, document.content, projectId);
        } else if (cached !== undefined) {
          initDocument(cached.title, cached.content, projectId);
          cacheRef.current.set(draftId, cached);
          if (Date.now() - cached.validatedAt > REVALIDATE_TTL_MS) {
            revalidate(draftId, seq);
          }
        } else {
          if (!fetched) {
            toast.error("Couldn't load that draft — please try again");
            return false;
          }
          initDocument(fetched.title, fetched.content, projectId);
          cacheRef.current.set(draftId, {
            title: fetched.title,
            content: fetched.content,
            validatedAt: Date.now(),
          });
        }
        setActiveDraftId(draftId);
        return true;
      } catch (error) {
        if (seq === seqRef.current) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Couldn't switch drafts — please try again",
          );
        }
        return false;
      } finally {
        if (seq === seqRef.current) setSwitchTarget(null);
      }
    },
    [
      convex,
      document,
      initDocument,
      onRequestSave,
      projectId,
      revalidate,
      setActiveDraftId,
      setSwitchTarget,
    ],
  );

  const evictDraft = useCallback((draftId: string) => {
    cacheRef.current.delete(draftId);
  }, []);

  const seedDraft = useCallback(
    (draftId: string, content: VersionContent, verified: boolean) => {
      cacheRef.current.set(draftId, {
        ...content,
        validatedAt: verified ? Date.now() : 0,
      });
    },
    [],
  );

  const applyPromotedMain = useCallback(
    (main: VersionContent) => {
      ++seqRef.current;
      setSwitchTarget(null);
      initDocument(main.title, main.content, projectId);
      setActiveDraftId(null);
    },
    [initDocument, projectId, setActiveDraftId, setSwitchTarget],
  );

  return { switchToDraft, evictDraft, seedDraft, applyPromotedMain };
}
