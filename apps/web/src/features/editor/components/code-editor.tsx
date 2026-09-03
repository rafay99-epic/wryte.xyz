"use client";

import type { AnimationLanguage } from "@wryte/backend/_lib/animationChecks";
import { cn } from "@wryte/logic/lib/utils";
import type { Element, Root, RootContent } from "hast";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import { createLowlight } from "lowlight";
import type { ReactNode, RefObject } from "react";
import { useMemo, useRef } from "react";

const lowlight = createLowlight({ javascript, typescript });

const TYPOGRAPHY =
  "font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [tab-size:2]";
const BOX = "px-2.5 py-2";

function className(node: Element): string | undefined {
  const value = node.properties["className"];
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" ? value : undefined;
}

function render(nodes: readonly RootContent[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}.${String(index)}`;
    if (node.type === "text") return node.value;
    if (node.type !== "element") return null;
    return (
      <span key={key} className={className(node)}>
        {render(node.children, key)}
      </span>
    );
  });
}

function highlight(source: string, language: AnimationLanguage): ReactNode[] {
  const grammar = language === "jsx" ? "javascript" : "typescript";
  let tree: Root;
  try {
    tree = lowlight.highlight(grammar, source);
  } catch {
    return [source];
  }
  return render(tree.children, "t");
}

/**
 * Textarea with syntax highlighting behind it: a `<pre>` renders the coloured
 * tokens and the textarea sits on top with transparent text and a visible
 * caret. Both share one typography string so the two layers stay aligned;
 * changing font or padding on one without the other is what makes this
 * technique drift. `hljs` goes on the <pre> rather than a nested <code>
 * because globals.css gives `pre code.hljs` its own padding, which would
 * shift the highlight layer off the caret.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  rows,
  id,
  invalid,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  language: AnimationLanguage;
  rows: number;
  id?: string;
  invalid?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const tokens = useMemo(() => highlight(value, language), [value, language]);

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-transparent transition-colors focus-within:ring-3",
        invalid
          ? "border-destructive ring-destructive/20 focus-within:border-destructive"
          : "border-input ring-ring/50 focus-within:border-ring",
      )}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        className={cn(
          "hljs pointer-events-none absolute inset-0 m-0 overflow-hidden bg-transparent",
          TYPOGRAPHY,
          BOX,
        )}
      >
        {tokens}
      </pre>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          const pre = preRef.current;
          if (!pre) return;
          pre.scrollTop = event.currentTarget.scrollTop;
          pre.scrollLeft = event.currentTarget.scrollLeft;
        }}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={invalid}
        className={cn(
          "relative block w-full resize-none bg-transparent text-transparent caret-foreground outline-none",
          TYPOGRAPHY,
          BOX,
        )}
      />
    </div>
  );
}
