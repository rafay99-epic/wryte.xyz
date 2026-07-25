"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import {
  findLinkSuggestions,
  type LinkSuggestion,
  type LinkTargetDoc,
} from "@/features/editor/lib/link-suggestions";

/** How long after the last keystroke before re-scanning. */
const SCAN_DEBOUNCE_MS = 1000;

type UseLinkSuggestionsReturn = {
  suggestions: LinkSuggestion[];
  loading: boolean;
};

/**
 * Unlinked-mention suggestions for the research panel.
 *
 * Cost model: ONE one-shot metadata query when the panel opens (the same
 * `listForCalendar` projection the calendar uses — titles/slugs only, no
 * bodies, no subscription). All scanning is client-side, debounced, and runs
 * only while the panel is open.
 */
export function useLinkSuggestions(
  documentId: string,
  open: boolean,
): UseLinkSuggestionsReturn {
  const convex = useConvex();
  const projectId = useEditorStore((s) => s.activeProjectId);
  const content = useEditorStore((s) => s.content);

  const [docs, setDocs] = useState<LinkTargetDoc[] | null>(null);
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);

  // Fetch the project's document titles once per panel-open.
  useEffect(() => {
    if (!open || !projectId) {
      setDocs(null);
      return;
    }
    let cancelled = false;
    void convex
      .query(api.cms.documents.listForCalendar, {
        projectId: projectId as Id<"projects">,
      })
      .then((result) => {
        if (cancelled) return;
        setDocs(
          result.map((d) => ({ _id: d._id, title: d.title, slug: d.slug })),
        );
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, convex]);

  // Debounced re-scan while the panel is open. The scan is pure local work.
  useEffect(() => {
    if (!open || docs === null) return;
    const timer = setTimeout(() => {
      setSuggestions(findLinkSuggestions(content, docs, documentId));
    }, SCAN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, docs, content, documentId]);

  return { suggestions, loading: open && docs === null };
}
