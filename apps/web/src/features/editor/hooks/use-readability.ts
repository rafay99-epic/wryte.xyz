import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useEffect, useRef, useState } from "react";
import { analyze } from "../lib/readability/analyze";
import type { ReadabilityResult } from "../lib/readability/types";
import { analyzeAsync } from "../lib/readability/worker-client";

const DEBOUNCE_MS = 300;
/** ~8k words — above this we route analysis to the worker. */
const WORKER_CHAR_THRESHOLD = 50_000;

/**
 * Debounced readability analysis of the current editor content. Small docs run
 * inline; large docs route to the Web Worker so the editor never janks. Call
 * only from a component that is mounted exclusively while the panel is open
 * (see ReadabilityPanelBody), so a closed panel does no work and holds no
 * content subscription.
 */
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
        // Ignore results from a superseded run.
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
