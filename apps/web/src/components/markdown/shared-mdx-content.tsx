"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import {
  buildComponentMap,
  compileMdx,
  type MdxComponentProps,
  MdxErrorBoundary,
  type MdxModule,
} from "@/components/markdown/mdx-runtime";
import { wrapAnimation } from "@/features/editor/lib/animations/animation-boundary";
import { compileAnimation } from "@/features/editor/lib/animations/compile-animation";

/**
 * MDX renderer for the public share preview — the same pipeline as the
 * editor's Read view, including the author's animation components, so a
 * shared draft looks exactly like the published post will.
 *
 * Fails soft: if MDX compilation errors (draft mid-edit, broken syntax),
 * it falls back to the plain markdown renderer instead of a dead page —
 * reviewers always see *something*.
 */
export function SharedMdxContent({
  content,
  animations,
}: {
  content: string;
  animations: { name: string; source: string }[];
}) {
  const [compiled, setCompiled] = useState<MdxModule | null>(null);
  const [failed, setFailed] = useState(false);

  const userComponents = useMemo(() => {
    const map: Record<string, React.ComponentType<MdxComponentProps>> = {};
    for (const anim of animations) {
      const result = compileAnimation(anim.source);
      if (result.ok) {
        map[anim.name] = wrapAnimation(anim.name, result.component);
      }
    }
    return map;
  }, [animations]);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const components = buildComponentMap(content, userComponents);
        const mod = await compileMdx(content, components);
        if (!stale) {
          setCompiled(mod);
          setFailed(false);
        }
      } catch {
        if (!stale) setFailed(true);
      }
    })();
    return () => {
      stale = true;
    };
  }, [content, userComponents]);

  if (failed) return <ChangelogMarkdown content={content} />;

  if (!compiled) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/50">
        Rendering preview…
      </p>
    );
  }

  const Content = compiled.default;

  return (
    <MdxErrorBoundary fallback={<ChangelogMarkdown content={content} />}>
      <Content />
    </MdxErrorBoundary>
  );
}
