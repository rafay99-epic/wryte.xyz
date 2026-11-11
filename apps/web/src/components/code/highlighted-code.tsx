"use client";

import type { AnimationLanguage } from "@wryte/backend/_lib/animationChecks";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import type { ReactNode } from "react";
import { useMemo } from "react";

export type CodeLanguage = AnimationLanguage | ConfigFormat;

const GRAMMARS = { ini, javascript, json, typescript, yaml };

const GRAMMAR_BY_LANGUAGE: Record<CodeLanguage, keyof typeof GRAMMARS> = {
  tsx: "typescript",
  jsx: "javascript",
  json: "json",
  yaml: "yaml",
  toml: "ini",
};

const DATA_LANGUAGES = new Set<CodeLanguage>(["json", "yaml", "toml"]);

const lowlight = createLowlight(GRAMMARS);

type HastRoot = ReturnType<typeof lowlight.highlight>;
type HastElement = Extract<HastRoot["children"][number], { type: "element" }>;
type HastNode = HastRoot["children"][number] | HastElement["children"][number];

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
  try {
    const tree = lowlight.highlight(GRAMMAR_BY_LANGUAGE[language], source);
    return render(tree.children, "t");
  } catch {
    return [source];
  }
}

export function HighlightedCode({
  source,
  language,
}: {
  source: string;
  language: CodeLanguage;
}) {
  const tokens = useMemo(() => highlight(source, language), [source, language]);
  return (
    <span className={DATA_LANGUAGES.has(language) ? "code-data" : undefined}>
      {tokens}
    </span>
  );
}
