"use client";

import { motion } from "framer-motion";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useEditorStore } from "@/stores/editor-store";

/**
 * Extend the default sanitize schema to allow highlight.js class names.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    ["code"]: [
      ...(defaultSchema.attributes?.["code"] ?? []),
      ["className", /^language-./],
    ],
    ["span"]: [
      ...(defaultSchema.attributes?.["span"] ?? []),
      ["className", /^hljs/],
    ],
  },
};

/**
 * Custom component overrides for polished markdown rendering.
 */
const components: Components = {
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
  pre: ({ children, ...props }) => (
    <pre
      className="overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-5 text-[13px] leading-relaxed dark:bg-muted/30"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock =
      className?.startsWith("language-") || className?.startsWith("hljs");
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[0.9em] font-mono text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-[3px] border-primary/40 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
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
    <article className="prose prose-neutral dark:prose-invert max-w-none px-8 py-6 prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-[1.75rem] prose-h1:leading-tight prose-h2:text-[1.35rem] prose-h3:text-[1.15rem] prose-p:leading-[1.8] prose-p:text-foreground/90 prose-li:leading-[1.8] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-img:rounded-xl prose-strong:text-foreground prose-strong:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
