"use client";

import { useConvex } from "convex/react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** Sentinel `switchTarget` value for a switch back to the Main document. */
export const MAIN_TAB = "main";

/**
 * How long a cache entry counts as verified. Within this window a cache-hit
 * switch fires NO background query at all — rapid tab browsing costs zero
 * Convex function calls. Cross-device edits land on the first switch after
 * the window (and this client's own writes update the cache directly, so
 * they are never stale).
 */
const REVALIDATE_TTL_MS = 30_000;

type VersionContent = { title: string; content: string };

/** Cached draft body + when it was last known to match the server. */
type CacheEntry = VersionContent & { validatedAt: number };

type DraftMeta = { _id: string; wordCount: number };

type UseDraftSwitchingOptions = {
  projectId: string;
  /**
   * The live `documents.get` subscription for the Main document. Main never
   * needs the draft cache — this subscription is already kept fresh.
   */
  document: { title: string; content: string } | null | undefined;
  /**
   * Draft metadata from the tab bar's already-subscribed list. `wordCount`
   * lets a first visit to an EMPTY draft render instantly (nothing to
   * fetch) with only a background title check.
   */
  drafts: DraftMeta[] | undefined;
  /** Flushes the current tab's unsaved edits (no-op when clean). */
  onRequestSave: () => Promise<void>;
};

type UseDraftSwitchingReturn = {
  /**
   * Switch the editor to a draft (or back to Main with `null`). Resolves to
   * true only when the target's content was actually loaded into the store —
   * the active tab NEVER changes on a failed or superseded switch, so the
   * editor can't end up showing one version's text labeled as another.
   */
  switchToDraft: (draftId: string | null) => Promise<boolean>;
  /** Drop a draft's cached content (call after deleting it). */
  evictDraft: (draftId: string) => void;
  /**
   * Pre-seed the cache for a draft this client just created, so the switch
   * to it is instant. Pass `verified: true` when the seeded value is known
   * to be byte-identical to what the server wrote (a blank draft) — that
   * skips even the background check.
   */
  seedDraft: (
    draftId: string,
    content: VersionContent,
    verified: boolean,
  ) => void;
  /**
   * Load a just-promoted Main result into the editor and activate the Main
   * tab, superseding any in-flight switch.
   */
  applyPromotedMain: (main: VersionContent) => void;
};

/**
 * Owns the version-switching state machine for the draft tab bar.
 *
 * Latency model: within a session, every draft body that has been viewed,
 * edited, or created is kept in an in-memory cache, so revisiting a tab
 * renders instantly. Empty drafts (per the list's `wordCount`) render
 * instantly even on first visit. Server round trips only happen as
 * background revalidation, at most once per draft per TTL window — the
 * total Convex call count is at or below what a fetch-per-switch design
 * costs, never above it.
 */
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

  // Session cache of draft bodies, keyed by draft id. Entries are written
  // from the store when switching away (byte-identical to what the flush
  // persists), at draft creation, and from every fetch result.
  const cacheRef = useRef(new Map<string, CacheEntry>());
  // Monotonic token per switch attempt. A newer switch (or a promote)
  // supersedes any in-flight one: the older attempt's post-await work is
  // dropped so a slow fetch can never clobber the newer tab's content.
  const seqRef = useRef(0);
  // Kept in a ref so switchToDraft doesn't recreate on every list update.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  /**
   * Background refresh after serving from cache. The result is applied only
   * when nothing moved underneath it: same switch generation, same active
   * draft, and no local keystrokes since (dirty local content always wins —
   * it will be autosaved over the server copy anyway).
   */
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
        .catch(() => {
          // Keep the cached copy — the next switch retries the check.
        });
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
        // Snapshot the outgoing draft so switching back is instant. The
        // flush below persists this exact content, so cache and server
        // agree. (Main needs no snapshot — its subscription stays live.)
        if (state.activeDraftId !== null) {
          cacheRef.current.set(state.activeDraftId, {
            title: state.title,
            content: state.content,
            validatedAt: Date.now(),
          });
        }

        // Resolve the target's content without waiting when possible:
        // 1. session cache — the draft was seen/edited/created here;
        // 2. synthesized empty — the list metadata says wordCount is 0, so
        //    there is nothing to wait for (validatedAt 0 forces a
        //    background title check, since titles live on the content row).
        const meta = draftsRef.current?.find((d) => d._id === draftId);
        const cached =
          draftId !== null
            ? (cacheRef.current.get(draftId) ??
              (meta?.wordCount === 0
                ? { title: "", content: "", validatedAt: 0 }
                : undefined))
            : undefined;

        // Flush the current tab's pending edits and (when nothing local can
        // answer) fetch the target draft's body in parallel — they touch
        // different rows, and running them sequentially doubles the
        // perceived latency.
        const [, fetched] = await Promise.all([
          onRequestSave(),
          draftId !== null && cached === undefined
            ? convex.query(api.cms.documentDrafts.getContent, {
                draftId: draftId as Id<"document_drafts">,
              })
            : Promise.resolve(null),
        ]);
        // A newer switch (or promote) started while we awaited — let it win.
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
        // Unverified seeds (copy-from-main built from the client's
        // subscription value) get one background check on first open.
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
