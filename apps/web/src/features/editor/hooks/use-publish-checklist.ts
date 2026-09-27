"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  buildPublishChecklist,
  type ChecklistResult,
  type KnownDoc,
} from "@wryte/logic/lib/editor/publish-checklist";
import type { ValidatableField } from "@wryte/logic/lib/frontmatter-detection/validate";
import { parseFrontmatterSchema } from "@wryte/logic/lib/parse-frontmatter";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { DEFAULT_FRONTMATTER_FIELDS } from "@wryte/logic/types/frontmatter";
import { useConvex } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

const KNOWN_DOCS_LIMIT = 500;

type UsePublishChecklistArgs = {
  open: boolean;
  projectId: string;
  frontmatterRaw?: string | undefined;
  frontmatterSchema?: string | undefined;
  contentFormat?: "md" | "mdx" | undefined;
};

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
    () =>
      parseFrontmatterSchema<ValidatableField>(
        frontmatterSchema,
        DEFAULT_FRONTMATTER_FIELDS,
      ),
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
