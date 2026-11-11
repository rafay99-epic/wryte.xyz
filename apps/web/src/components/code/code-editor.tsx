"use client";

import type { AnimationLanguage } from "@wryte/backend/_lib/animationChecks";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import { cn } from "@wryte/logic/lib/utils";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import type { ReactNode, RefObject } from "react";
import { useMemo, useRef } from "react";

export type CodeLanguage = AnimationLanguage | ConfigFormat;

const GRAMMARS = { ini, javascript, json, typescript, yaml };

const GRAMMAR_BY_LANGUAGE: Record<CodeLanguage, keyof typeof GRAMMARS> = {
  tsx: "typescript",
  jsx: "javascript",
  json: "json",
  yaml: "yaml",
  toml: "ini",
};

const lowlight = createLowlight(GRAMMARS);

type HastRoot = ReturnType<typeof lowlight.highlight>;
type HastElement = Extract<HastRoot["children"][number], { type: "element" }>;
type HastNode = HastRoot["children"][number] | HastElement["children"][number];

const TYPOGRAPHY =
  "font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [tab-size:2]";
const BOX = "px-2.5 py-2";

function className(node: HastElement): string | undefined {
  const value = node.properties["className"];
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" ? value : undefined;
}

function render(nodes: readonly HastNode[], prefix: string): ReactNode[] {
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

function highlight(source: string, language: CodeLanguage): ReactNode[] {
  const grammar = GRAMMAR_BY_LANGUAGE[language];
  let tree: HastRoot;
  try {
    tree = lowlight.highlight(grammar, source);
  } catch {
    return [source];
  }
  return render(tree.children, "t");
}

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
  language: CodeLanguage;
  rows?: number;
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
        rows === undefined && "h-full",
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
          rows === undefined && "h-full",
          TYPOGRAPHY,
          BOX,
        )}
      />
    </div>
  );
}
