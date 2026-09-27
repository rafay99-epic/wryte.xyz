import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import { MermaidDiagram } from "./mermaid-diagram";

const MERMAID_CLASS = "language-mermaid";

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
