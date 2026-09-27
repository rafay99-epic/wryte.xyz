import { useEffect, useRef, useState } from "react";

type PreviewRect = { top: number; left: number };

export function useHoverPreview(delay = 600) {
  const [previewRect, setPreviewRect] = useState<PreviewRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const onEnter = () => {
      timerRef.current = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        setPreviewRect({ top: rect.top, left: rect.left });
      }, delay);
    };
    const onLeave = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPreviewRect(null);
    };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delay]);

  return { elementRef, previewRect };
}
