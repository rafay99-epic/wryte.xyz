"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useEditorStore } from "@/stores/editor-store";

/**
 * Custom component overrides for react-markdown rendering.
 * These ensure images are lazy-loaded, links open in new tabs,
 * and code blocks are distinguished from inline code.
 */
const components: Components = {
  // Lazy-load images and constrain them to the container width
  img: ({ alt, src, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      className="my-4 max-w-full rounded-lg"
      loading="lazy"
      {...props}
    />
  ),
  // Force all links to open in a new tab for safety (noopener noreferrer)
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 hover:text-primary/80"
      {...props}
    >
      {children}
    </a>
  ),
  // Differentiate fenced code blocks (which have a `language-*` class from
  // rehype-highlight) from inline `code` spans so they get distinct styling
  code: ({ children, className, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
};

/**
 * Live markdown preview panel.
 * Rendering pipeline:
 *  1. remark-gfm   -- adds GitHub Flavored Markdown (tables, strikethrough, task lists)
 *  2. rehype-sanitize -- strips dangerous HTML to prevent XSS
 *  3. rehype-highlight -- applies syntax highlighting to fenced code blocks
 *  4. custom `components` -- overrides for img, a, and code elements
 */
export function MarkdownPreview() {
  const content = useEditorStore((state) => state.content);

  // Show an empty-state prompt when the document has no content yet
  if (!content) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Nothing to preview yet. Start writing in the editor.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Tailwind Typography plugin (`prose`) handles base markdown styling */}
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize, rehypeHighlight]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
