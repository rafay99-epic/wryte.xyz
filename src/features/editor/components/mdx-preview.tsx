"use client";

import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildComponentMap,
  CompileError,
  compileMdx,
  type MdxComponentProps,
  MdxErrorBoundary,
  type MdxModule,
} from "@/components/markdown/mdx-runtime";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { usePreviewJump } from "../hooks/use-preview-jump";
import { wrapAnimation } from "../lib/animations/animation-boundary";
import { compileAnimation } from "../lib/animations/compile-animation";

const DEBOUNCE_MS = 300;

/**
 * The editor's live MDX Read view. The compile/run machinery lives in the
 * shared `mdx-runtime` (also used by the public share preview); this
 * component adds the editor concerns — store subscription, debounce,
 * double-click-to-edit, and the project's animation components.
 */
export function MdxPreview({
  animationsEnabled = false,
}: {
  /** Gate the animations subscription — projects without the feature
   * configured must not pay the list's read cost on every session. */
  animationsEnabled?: boolean;
}) {
  const content = useEditorStore((state) => state.content);
  const activeProjectId = useEditorStore((state) => state.activeProjectId);
  const handleDoubleClick = usePreviewJump();
  const [compiled, setCompiled] = useState<MdxModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Project animations, compiled once per source change (not per keystroke
  // of the document — the memo only re-runs when the Convex rows change).
  // A source that fails to compile falls back to the dashed placeholder.
  const animations = useQuery(
    api.cms.animations.list,
    animationsEnabled && activeProjectId
      ? { projectId: activeProjectId as Id<"projects"> }
      : "skip",
  );
  const userComponents = useMemo(() => {
    const map: Record<string, React.ComponentType<MdxComponentProps>> = {};
    for (const anim of animations ?? []) {
      const result = compileAnimation(anim.source);
      if (result.ok) {
        map[anim.name] = wrapAnimation(anim.name, result.component);
      }
    }
    return map;
  }, [animations]);

  useEffect(() => {
    if (!content) {
      setCompiled(null);
      setError(null);
      return;
    }

    let stale = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const components = buildComponentMap(content, userComponents);
        const mod = await compileMdx(content, components);
        if (!stale) {
          setCompiled(mod);
          setError(null);
        }
      } catch (err) {
        if (!stale) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      stale = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, userComponents]);

  if (!content) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full items-center justify-center p-8"
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground/60">
            Nothing to preview yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Start writing in the editor to see a live preview
          </p>
        </div>
      </motion.div>
    );
  }

  if (error) return <CompileError message={error} />;

  if (!compiled) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground/40">Compiling MDX…</p>
      </div>
    );
  }

  const Content = compiled.default;

  return (
    <MdxErrorBoundary
      fallback={<CompileError message="Failed to render MDX content." />}
    >
      <article
        onDoubleClick={handleDoubleClick}
        className="prose prose-neutral dark:prose-invert max-w-none px-8 py-6 prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-[1.75rem] prose-h1:leading-tight prose-h2:text-[1.35rem] prose-h3:text-[1.15rem] prose-p:leading-[1.8] prose-p:text-foreground/90 prose-li:leading-[1.8] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-img:rounded-xl prose-strong:text-foreground prose-strong:font-semibold"
      >
        <Content />
      </article>
    </MdxErrorBoundary>
  );
}
