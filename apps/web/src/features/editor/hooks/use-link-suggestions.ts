"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  findLinkSuggestions,
  type LinkSuggestion,
  type LinkTargetDoc,
} from "@wryte/logic/lib/editor/link-suggestions";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";

const SCAN_DEBOUNCE_MS = 1000;

type UseLinkSuggestionsReturn = {
  suggestions: LinkSuggestion[];
  loading: boolean;
};

export function useLinkSuggestions(
  documentId: string,
  open: boolean,
): UseLinkSuggestionsReturn {
  const convex = useConvex();
  const projectId = useEditorStore((s) => s.activeProjectId);
  const content = useEditorStore((s) => (open ? s.content : ""));

  const [docs, setDocs] = useState<LinkTargetDoc[] | null>(null);
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);

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

  useEffect(() => {
    if (!open || docs === null) return;
    const timer = setTimeout(() => {
      setSuggestions(findLinkSuggestions(content, docs, documentId));
    }, SCAN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, docs, content, documentId]);

  return { suggestions, loading: open && docs === null };
}
