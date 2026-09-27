import type { StyleLintFinding } from "@wryte/logic/lib/editor/style-lint";
import { lintStyle } from "@wryte/logic/lib/editor/style-lint";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 400;

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
