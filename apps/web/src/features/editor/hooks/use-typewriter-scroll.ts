"use client";

import { caretRect } from "@wryte/logic/lib/dom/textarea-caret";
import { getScrollParent } from "@wryte/logic/lib/dom-utils";
import { type RefObject, useEffect } from "react";

export function useTypewriterScroll(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const scroller = getScrollParent(textarea);
    if (!scroller) return;

    let frame = 0;
    let pausedByManualScroll = false;

    const center = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = caretRect(textarea, textarea.selectionStart);
        if (!rect) return;
        const caretTopInScroller =
          textarea.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop +
          rect.top;
        const target = Math.max(
          0,
          caretTopInScroller - scroller.clientHeight / 2 + rect.height / 2,
        );
        if (Math.abs(target - scroller.scrollTop) < 1) return;
        scroller.scrollTo({ top: target, behavior: "smooth" });
      });
    };

    const onInput = () => {
      pausedByManualScroll = false;
      center();
    };
    const onSelectionChange = () => {
      if (pausedByManualScroll) return;
      if (document.activeElement !== textarea) return;
      center();
    };
    const onManualScroll = () => {
      pausedByManualScroll = true;
    };

    textarea.addEventListener("input", onInput);
    document.addEventListener("selectionchange", onSelectionChange);
    scroller.addEventListener("wheel", onManualScroll, { passive: true });
    scroller.addEventListener("touchmove", onManualScroll, { passive: true });

    center();

    return () => {
      cancelAnimationFrame(frame);
      textarea.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", onSelectionChange);
      scroller.removeEventListener("wheel", onManualScroll);
      scroller.removeEventListener("touchmove", onManualScroll);
    };
  }, [enabled, textareaRef]);
}
