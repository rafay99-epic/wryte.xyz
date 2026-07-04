"use client";

import { useConvex } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ValidatableField } from "@/lib/frontmatter-detection/validate";
import { useEditorStore } from "@/stores/editor-store";
import { DEFAULT_FRONTMATTER_FIELDS } from "@/types/frontmatter";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  buildPublishChecklist,
  type ChecklistResult,
  type KnownDoc,
} from "../lib/publish-checklist";

/** Bounded one-shot fetch — resolves internal links without a subscription. */
const KNOWN_DOCS_LIMIT = 500;

type UsePublishChecklistArgs = {
  /** Gate the one-shot fetch so it only runs while the dialog is open. */
  open: boolean;
  projectId: string;
  /** Raw frontmatter JSON string stored on the document. */
  frontmatterRaw?: string | undefined;
  /** The project's frontmatter schema (JSON string of FrontmatterField[]). */
  frontmatterSchema?: string | undefined;
  contentFormat?: "md" | "mdx" | undefined;
};

/**
 * Parse the project's stored frontmatter schema into the minimal shape the
 * validator needs. Falls back to sensible blog defaults when the project has
 * no custom schema or the JSON is malformed.
 */
function parseSchemaFields(schemaJson?: string): ValidatableField[] {
  if (!schemaJson) return DEFAULT_FRONTMATTER_FIELDS;
  try {
    const parsed = JSON.parse(schemaJson) as ValidatableField[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_FRONTMATTER_FIELDS;
  } catch {
    return DEFAULT_FRONTMATTER_FIELDS;
  }
}

/**
 * Computes the pre-publish checklist for the currently open document.
 *
 * Reads live content/title from the editor store (so it reflects unsaved
 * edits), and fetches the project's `{title, slug}` doc metadata exactly once
 * when the dialog opens — a bounded one-shot query, never a subscription — to
 * resolve `[[internal links]]`. Everything else is computed client-side.
 */
export function usePublishChecklist({
  open,
  projectId,
  frontmatterRaw,
  frontmatterSchema,
  contentFormat,
}: UsePublishChecklistArgs): {
  result: ChecklistResult;
  isLoadingDocs: boolean;
} {
  const convex = useConvex();
  const { content, title } = useEditorStore(
    useShallow((state) => ({ content: state.content, title: state.title })),
  );

  const [knownDocs, setKnownDocs] = useState<KnownDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // One-shot fetch of lean doc metadata when the dialog opens. Cancelled if the
  // dialog closes (or the project changes) before it resolves.
  useEffect(() => {
    if (!open || !projectId) {
      setKnownDocs([]);
      return;
    }
    let cancelled = false;
    setIsLoadingDocs(true);
    void convex
      .query(api.cms.documents.listForLink, {
        projectId: projectId as Id<"projects">,
        paginationOpts: { numItems: KNOWN_DOCS_LIMIT, cursor: null },
      })
      .then((res) => {
        if (cancelled) return;
        setKnownDocs(res.page.map((d) => ({ title: d.title, slug: d.slug })));
      })
      .catch(() => {
        if (!cancelled) setKnownDocs([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDocs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, convex]);

  const schema = useMemo(
    () => parseSchemaFields(frontmatterSchema),
    [frontmatterSchema],
  );

  const result = useMemo(
    () =>
      buildPublishChecklist({
        content,
        title,
        frontmatter: { raw: frontmatterRaw, schema },
        contentFormat,
        knownDocs,
      }),
    [content, title, frontmatterRaw, schema, contentFormat, knownDocs],
  );

  return { result, isLoadingDocs };
}
