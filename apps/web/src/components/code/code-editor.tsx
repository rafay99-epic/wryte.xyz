"use client";

import { cn } from "@wryte/logic/lib/utils";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import { type CodeLanguage, HighlightedCode } from "./highlighted-code";

const TYPOGRAPHY = "font-mono text-xs leading-relaxed [tab-size:2]";
const WRAPPED = "whitespace-pre-wrap break-words px-2.5 py-2";
const NUMBERED = "whitespace-pre pl-12 pr-2.5 pt-2 pb-8";

export function CodeEditor({
  value,
  onChange,
  language,
  rows,
  id,
  invalid,
  lineNumbers = false,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  rows?: number;
  id?: string;
  invalid?: boolean;
  lineNumbers?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  const layout = lineNumbers ? NUMBERED : WRAPPED;
  const gutter = useMemo(() => {
    if (!lineNumbers) return "";
    const count = value.split("\n").length;
    return Array.from({ length: count }, (_, index) => index + 1).join("\n");
  }, [lineNumbers, value]);

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
      {lineNumbers && (
        <pre
          ref={gutterRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 m-0 w-10 select-none overflow-hidden pt-2 pb-8 text-right text-muted-foreground/50",
            TYPOGRAPHY,
          )}
        >
          {gutter}
        </pre>
      )}
      <pre
        ref={preRef}
        aria-hidden="true"
        className={cn(
          "hljs pointer-events-none absolute inset-0 m-0 overflow-hidden bg-transparent",
          TYPOGRAPHY,
          layout,
        )}
      >
        <HighlightedCode source={value} language={language} />
      </pre>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          const { scrollTop, scrollLeft } = event.currentTarget;
          if (preRef.current) {
            preRef.current.scrollTop = scrollTop;
            preRef.current.scrollLeft = scrollLeft;
          }
          if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
        }}
        rows={rows}
        wrap={lineNumbers ? "off" : "soft"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={invalid}
        className={cn(
          "relative block w-full resize-none bg-transparent text-transparent caret-foreground outline-none",
          rows === undefined && "h-full",
          lineNumbers && "overflow-auto slim-scrollbar",
          TYPOGRAPHY,
          layout,
        )}
      />
    </div>
  );
}
