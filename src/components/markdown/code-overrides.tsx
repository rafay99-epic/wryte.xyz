import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import { MermaidDiagram } from "./mermaid-diagram";

/**
 * Shared `react-markdown` overrides for `pre`/`code`, used by every markdown
 * surface (editor markdown preview, MDX preview, server-rendered changelog /
 * share preview) so code blocks — and Mermaid diagrams — render identically.
 *
 * A ` ```mermaid ` fenced block arrives here as `<code class="language-mermaid">`
 * (its raw text preserved because the surfaces pass `plainText: ["mermaid"]`
 * to rehype-highlight). We swap it for a `<MermaidDiagram>` and drop the code
 * box `<pre>` wrapper so the diagram renders as its own block.
 *
 * This module is intentionally NOT a client module: the changelog surface is a
 * server component, and only the mermaid path pulls in the client renderer, so
 * plain code blocks keep shipping zero JS there.
 */

const MERMAID_CLASS = "language-mermaid";

/** Flatten a react node tree into its concatenated text content. */
function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText(
      (node as { props?: { children?: ReactNode } }).props?.children,
    );
  }
  return "";
}

/** True when a `<pre>`'s child is a mermaid code block. */
function isMermaidPre(children: ReactNode): boolean {
  const child = Array.isArray(children) ? children[0] : children;
  return (
    typeof child === "object" &&
    child !== null &&
    "props" in child &&
    (child as { props?: { className?: string } }).props?.className ===
      MERMAID_CLASS
  );
}

export const codeComponents: Components = {
  pre: ({ children, ...props }) => {
    // A mermaid diagram renders as its own block, not inside the code box.
    if (isMermaidPre(children)) return <>{children}</>;
    return (
      <pre
        className="overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-5 text-[13px] leading-relaxed dark:bg-muted/30"
        {...props}
      >
        {children}
      </pre>
    );
  },
  code: ({ children, className, ...props }) => {
    if (className === MERMAID_CLASS) {
      return <MermaidDiagram source={extractText(children)} />;
    }
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
};
