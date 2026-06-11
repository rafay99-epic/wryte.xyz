"use client";

import { useEffect, useState } from "react";
import { caretRect } from "../lib/caret/textarea-caret";
import { paragraphBounds } from "../lib/paragraph";
import { useEditorContext } from "./editor-context";

type OverlayBounds = { top: number; bottom: number };

const PADDING_PX = 6;

/**
 * Focus-mode paragraph dimming. Two pointer-events-none washes sit above
 * the textarea, leaving the paragraph under the caret at full contrast.
 * Positions come from the caret-mirror measurement (relative to the
 * textarea's border box, which matches the wrapper's coordinate space).
 */
export function FocusParagraphOverlay() {
  const { textareaRef } = useEditorContext();
  const [bounds, setBounds] = useState<OverlayBounds | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { start, end } = paragraphBounds(
          textarea.value,
          textarea.selectionStart,
        );
        const startRect = caretRect(textarea, start);
        const endRect = caretRect(textarea, end);
        if (!startRect || !endRect) {
          setBounds(null);
          return;
        }
        setBounds({
          top: Math.max(0, startRect.top - PADDING_PX),
          bottom: endRect.top + endRect.height + PADDING_PX,
        });
      });
    };
    const onSelectionChange = () => {
      if (document.activeElement === textarea) update();
    };

    textarea.addEventListener("input", update);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("resize", update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      textarea.removeEventListener("input", update);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("resize", update);
    };
  }, [textareaRef]);

  if (!bounds) return null;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] bg-background/70 transition-[height] duration-200 ease-out"
        style={{ height: bounds.top }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-[1] bg-background/70 transition-[top] duration-200 ease-out"
        style={{ top: bounds.bottom, bottom: 0 }}
      />
    </>
  );
}
