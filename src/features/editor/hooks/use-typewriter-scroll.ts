"use client";

import { type RefObject, useEffect } from "react";
import { caretRect } from "../lib/caret/textarea-caret";
import { getScrollParent } from "../lib/scroll";

/**
 * Typewriter scrolling for focus mode: while typing, keeps the caret line
 * vertically centered in the editor's scroll pane instead of letting it
 * drift to the bottom. Only reacts to `input` events — scrolling and
 * clicking around remain free.
 */
export function useTypewriterScroll(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    let frame = 0;
    const center = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = caretRect(textarea, textarea.selectionStart);
        const scroller = getScrollParent(textarea);
        if (!rect || !scroller) return;
        const caretTopInScroller =
          textarea.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop +
          rect.top;
        scroller.scrollTop =
          caretTopInScroller - scroller.clientHeight / 2 + rect.height / 2;
      });
    };

    textarea.addEventListener("input", center);
    return () => {
      cancelAnimationFrame(frame);
      textarea.removeEventListener("input", center);
    };
  }, [enabled, textareaRef]);
}
