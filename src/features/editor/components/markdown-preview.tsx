"use client";

import { motion } from "framer-motion";
import { useDeferredValue, useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { codeComponents } from "@/components/markdown/code-overrides";
import {
  buildEmbedSanitizeSchema,
  embedComponents,
} from "@/components/markdown/embed-overrides";
import { useEditorStore } from "@/stores/editor-store";
import { usePreviewJump } from "../hooks/use-preview-jump";
import { remarkSourceLines } from "../lib/source-lines";
import { VideoEmbed } from "./video-embed";

/**
 * Base sanitize schema extended with `<video>` (raw HTML parsed by
 * rehype-raw, then sanitized here — `src` stays restricted to http/https by
 * the default protocol rules), then layered with the post-embed allowances
 * (whitelisted embed iframes + Twitter blockquote).
 */
const videoSchema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "video"],
  attributes: {
    ...defaultSchema.attributes,
    // Keep the `data-source-line` stamps remarkSourceLines adds — they power
    // double-click-to-edit and would otherwise be stripped here.
    ["*"]: [...(defaultSchema.attributes?.["*"] ?? []), "data*"],
    ["code"]: [
      ...(defaultSchema.attributes?.["code"] ?? []),
      ["className", /^language-./],
    ],
    ["span"]: [
      ...(defaultSchema.attributes?.["span"] ?? []),
      ["className", /^hljs/],
    ],
    ["video"]: [
      "src",
      "title",
      "poster",
      "controls",
      "loop",
      "muted",
      "playsInline",
      "preload",
      "width",
      "height",
    ],
  },
};
const sanitizeSchema = buildEmbedSanitizeSchema(videoSchema);

/**
 * Custom component overrides for polished markdown rendering.
 */
const components: Components = {
  video: ({ node: _node, ...props }) => <VideoEmbed {...props} />,
  img: ({ alt, src, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      className="my-6 max-w-full rounded-xl shadow-sm"
      loading="lazy"
      {...props}
    />
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary font-medium underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary/60"
      {...props}
    >
      {children}
    </a>
  ),
  hr: (props) => (
    <hr className="my-8 border-0 border-t border-border/40" {...props} />
  ),
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="bg-muted/40 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-t border-border/30 px-4 py-2.5" {...props}>
      {children}
    </td>
  ),
};

/**
 * Live markdown preview panel with polished typography.
 */
export function MarkdownPreview() {
  const content = useEditorStore((state) => state.content);
  // Deferred + memoized: a keystroke re-renders this component urgently but
  // hits the memo (old content), while the expensive remark/rehype re-parse
  // runs as an interruptible background render — typing in split mode never
  // blocks on it.
  const deferredContent = useDeferredValue(content);
  const handleDoubleClick = usePreviewJump(deferredContent);

  const rendered = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSourceLines]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          [rehypeHighlight, { plainText: ["mermaid"] }],
        ]}
        components={{ ...components, ...codeComponents, ...embedComponents }}
      >
        {deferredContent}
      </ReactMarkdown>
    ),
    [deferredContent],
  );

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

  return (
    <article
      onDoubleClick={handleDoubleClick}
      className="prose prose-neutral dark:prose-invert max-w-none px-8 py-6 prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-[1.75rem] prose-h1:leading-tight prose-h2:text-[1.35rem] prose-h3:text-[1.15rem] prose-p:leading-[1.8] prose-p:text-foreground/90 prose-li:leading-[1.8] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-img:rounded-xl prose-strong:text-foreground prose-strong:font-semibold"
    >
      {rendered}
    </article>
  );
}
