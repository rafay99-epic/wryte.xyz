import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import type { StyleLintFinding } from "../lib/style-lint";
import { lintStyle } from "../lib/style-lint";

const DEBOUNCE_MS = 400;

/**
 * Debounced Hemingway-style lint of the current editor content. Call only
 * from a component that is mounted exclusively while the readability panel's
 * Style section is open/expanded, so a closed panel does no work and holds
 * no content subscription — same contract as `useReadability`.
 */
export function useStyleLint(): {
  findings: StyleLintFinding[];
  analyzing: boolean;
} {
  const content = useEditorStore((s) => s.content);
  const [findings, setFindings] = useState<StyleLintFinding[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAnalyzing(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setFindings(lintStyle(content));
      setAnalyzing(false);
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [content]);

  return { findings, analyzing };
}
