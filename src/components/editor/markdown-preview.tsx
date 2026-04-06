"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useEditorStore } from "@/stores/editor-store";

const components: Components = {
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

export function MarkdownPreview() {
  const content = useEditorStore((state) => state.content);

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Nothing to preview yet. Start writing in the editor.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
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
