"use client";

import { useCallback, useEffect, useRef } from "react";
import { caretRect } from "../lib/caret/textarea-caret";
import { lineOfIndex } from "../lib/source-lines";

type Pane = "editor" | "preview";

/** How far from the pane edge the caret is kept while typing. */
const CARET_MARGIN = 80;

/**
 * Scroll behavior for the split view. Two cooperating mechanisms:
 *
 * 1. Manual scrolling — ratio-based bidirectional sync. One pane "owns" the
 *    scroll at any time (decided by where the pointer, touch, or keyboard
 *    last acted) and only the owner pushes its ratio to the other pane. The
 *    scroll event echoed by that push lands on the non-owner and is ignored,
 *    so the panes can never fight each other.
 *
 * 2. Typing — caret-follow. A growing textarea never scrolls anything by
 *    itself, so no scroll event fires and ratio sync alone leaves both panes
 *    behind the caret. On every input the editor pane is nudged to keep the
 *    caret visible and the preview is scrolled to the rendered block carrying
 *    the caret's `data-source-line` — exact, not a ratio guess. The
 *    ResizeObserver re-runs the follow once the (deferred) preview re-render
 *    actually lands, since it commits after the keystroke.
 *
 * The editor side is scroll-container-agnostic: it drives whichever element
 * actually scrolls (the pane wrapper, or the textarea itself when its content
 * overflows a fixed height).
 */
export function useSplitScrollSync(enabled: boolean) {
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const owner = useRef<Pane>("editor");
  /** True while scrolling is driven by typing; cleared by manual intent. */
  const typing = useRef(false);
  /** Editor scroll events to swallow — echoes of our own programmatic nudge. */
  const skipEditorScroll = useRef(0);
  const followFrame = useRef(0);

  const getTextarea = useCallback(
    () => editorPaneRef.current?.querySelector("textarea") ?? null,
    [],
  );

  /** The element whose scrollTop actually moves the editor's content. */
  const getEditorScroller = useCallback((): HTMLElement | null => {
    const textarea = getTextarea();
    if (textarea && textarea.scrollHeight > textarea.clientHeight + 1) {
      return textarea;
    }
    return editorPaneRef.current;
  }, [getTextarea]);

  const syncTo = useCallback(
    (source: HTMLElement | null, target: HTMLElement | null) => {
      if (!source || !target) return;
      const max = source.scrollHeight - source.clientHeight;
      const ratio = max > 0 ? source.scrollTop / max : 0;
      target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
    },
    [],
  );

  /** Keep the caret visible in the editor and align the preview to it. */
  const followCaret = useCallback(() => {
    const pane = editorPaneRef.current;
    const preview = previewRef.current;
    const textarea = getTextarea();
    if (!pane || !preview || !textarea) return;

    const rect = caretRect(textarea, textarea.selectionStart);
    if (!rect) return;
    const paneBox = pane.getBoundingClientRect();
    let caretTop = textarea.getBoundingClientRect().top + rect.top;

    // Editor pane: nudge only in the wrapper-scroll case. When the textarea
    // scrolls internally the browser already keeps the caret visible.
    if (textarea.scrollHeight <= textarea.clientHeight + 1) {
      let delta = 0;
      if (caretTop + rect.height > paneBox.bottom - CARET_MARGIN) {
        delta = caretTop + rect.height - (paneBox.bottom - CARET_MARGIN);
      } else if (caretTop < paneBox.top + CARET_MARGIN) {
        delta = caretTop - (paneBox.top + CARET_MARGIN);
      }
      if (delta !== 0) {
        skipEditorScroll.current++;
        pane.scrollTop += delta;
        caretTop -= delta;
      }
    }

    // Preview: scroll the block containing the caret's source line to the
    // same viewport fraction the caret sits at in the editor.
    const caretLine = lineOfIndex(textarea.value, textarea.selectionStart);
    let target: HTMLElement | null = null;
    for (const el of preview.querySelectorAll<HTMLElement>(
      "[data-source-line]",
    )) {
      const line = Number(el.dataset["sourceLine"]);
      if (line <= caretLine) target = el;
      else break;
    }
    if (!target) {
      // MDX preview carries no source lines — ratio is the best available.
      syncTo(getEditorScroller(), preview);
      return;
    }
    const frac = Math.min(
      Math.max((caretTop - paneBox.top) / paneBox.height, 0),
      1,
    );
    const targetTop =
      target.getBoundingClientRect().top -
      preview.getBoundingClientRect().top +
      preview.scrollTop;
    preview.scrollTop = targetTop - frac * preview.clientHeight;
  }, [syncTo, getTextarea, getEditorScroller]);

  const scheduleFollow = useCallback(() => {
    cancelAnimationFrame(followFrame.current);
    followFrame.current = requestAnimationFrame(followCaret);
  }, [followCaret]);

  const setOwner = useCallback((pane: Pane) => {
    owner.current = pane;
  }, []);

  const onEditorScroll = useCallback(() => {
    if (skipEditorScroll.current > 0) {
      skipEditorScroll.current--;
      return;
    }
    if (owner.current !== "editor") return;
    // While typing, followCaret positions the preview precisely — a ratio
    // pass on the same frame would overwrite it with a worse guess.
    if (typing.current) return;
    syncTo(getEditorScroller(), previewRef.current);
  }, [syncTo, getEditorScroller]);

  const onPreviewScroll = useCallback(() => {
    if (owner.current !== "preview") return;
    syncTo(previewRef.current, getEditorScroller());
  }, [syncTo, getEditorScroller]);

  // Typing → follow; manual scroll intent (wheel, touch, scrollbar drag) →
  // back to ratio sync. Listeners attach imperatively because the textarea
  // lives in a child component and the internal-scroll case needs a scroll
  // listener the JSX can't reach.
  useEffect(() => {
    if (!enabled) return;
    const pane = editorPaneRef.current;
    const preview = previewRef.current;
    const textarea = getTextarea();
    if (!pane || !preview || !textarea) return;

    const onInput = () => {
      typing.current = true;
      owner.current = "editor";
      scheduleFollow();
    };
    const manualIntent = () => {
      typing.current = false;
    };

    textarea.addEventListener("input", onInput);
    textarea.addEventListener("scroll", onEditorScroll);
    for (const el of [pane, preview]) {
      el.addEventListener("wheel", manualIntent, { passive: true });
      el.addEventListener("touchstart", manualIntent, { passive: true });
      el.addEventListener("pointerdown", manualIntent);
    }

    // Re-align once the deferred preview re-render lands: its height changes
    // after the keystroke that caused it, so the follow must run again.
    const observer = new ResizeObserver(() => {
      if (typing.current) scheduleFollow();
      else if (owner.current === "editor") {
        syncTo(getEditorScroller(), preview);
      }
    });
    const inner = preview.firstElementChild;
    if (inner) observer.observe(inner);

    return () => {
      textarea.removeEventListener("input", onInput);
      textarea.removeEventListener("scroll", onEditorScroll);
      for (const el of [pane, preview]) {
        el.removeEventListener("wheel", manualIntent);
        el.removeEventListener("touchstart", manualIntent);
        el.removeEventListener("pointerdown", manualIntent);
      }
      observer.disconnect();
      cancelAnimationFrame(followFrame.current);
    };
  }, [
    enabled,
    onEditorScroll,
    scheduleFollow,
    syncTo,
    getTextarea,
    getEditorScroller,
  ]);

  return {
    editorPaneRef,
    previewRef,
    onEditorScroll,
    onPreviewScroll,
    setOwner,
  };
}
