"use client";

import { type RefObject, useEffect } from "react";
import { caretRect } from "../lib/caret/textarea-caret";
import { getScrollParent } from "../lib/scroll";

/**
 * Typewriter scrolling for focus mode: keeps the caret line vertically
 * centered in the editor's scroll pane while writing.
 *
 * - Recenters on `input` and on caret movement (`selectionchange` while the
 *   textarea is focused). Measurement is rAF-throttled so bursts of
 *   keystrokes coalesce into one caret measurement per frame.
 * - Never fights manual scrolling: a wheel or touch scroll pauses centering
 *   until the next input event, so the user can freely read elsewhere in the
 *   document and centering resumes the moment they type again.
 * - Uses the scroller's native smooth scrolling; recentering to an unchanged
 *   position is skipped, so steady typing within one line never scrolls.
 */
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
    // Set on user-initiated scrolling; cleared by the next input event.
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
        // Skip sub-pixel adjustments — typing along a single line keeps the
        // caret's top constant, so this is the hot no-op path.
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
    // Wheel/touch are unambiguously user intent — unlike `scroll`, which our
    // own smooth scrolling also fires, so listening to it would self-pause.
    scroller.addEventListener("wheel", onManualScroll, { passive: true });
    scroller.addEventListener("touchmove", onManualScroll, { passive: true });

    // Center immediately on activation so entering focus mode settles the
    // current line into place.
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
