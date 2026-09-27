import { analyze } from "@wryte/logic/lib/readability/analyze";
import type { ReadabilityResult } from "@wryte/logic/lib/readability/types";
import { analyzeAsync } from "@wryte/logic/lib/readability/worker-client";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const WORKER_CHAR_THRESHOLD = 50_000;

export function useReadability(): {
  result: ReadabilityResult | null;
  analyzing: boolean;
} {
  const content = useEditorStore((s) => s.content);
  const [result, setResult] = useState<ReadabilityResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    setAnalyzing(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const myReq = ++reqRef.current;
      const run =
        content.length > WORKER_CHAR_THRESHOLD
          ? analyzeAsync(content)
          : Promise.resolve(analyze(content));
      void run.then((res) => {
        if (myReq !== reqRef.current) return;
        setResult(res);
        setAnalyzing(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [content]);

  return { result, analyzing };
}
