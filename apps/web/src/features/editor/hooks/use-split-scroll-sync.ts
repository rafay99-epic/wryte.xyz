"use client";

import { caretRect } from "@wryte/logic/lib/dom/textarea-caret";
import { lineOfIndex } from "@wryte/logic/lib/editor/source-lines";
import { useCallback, useEffect, useRef } from "react";

type Pane = "editor" | "preview";

const CARET_MARGIN = 80;

export function useSplitScrollSync(enabled: boolean) {
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const owner = useRef<Pane>("editor");
  const typing = useRef(false);
  const skipEditorScroll = useRef(0);
  const followFrame = useRef(0);

  const getTextarea = useCallback(
    () => editorPaneRef.current?.querySelector("textarea") ?? null,
    [],
  );

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

  const followCaret = useCallback(() => {
    const pane = editorPaneRef.current;
    const preview = previewRef.current;
    const textarea = getTextarea();
    if (!pane || !preview || !textarea) return;

    const rect = caretRect(textarea, textarea.selectionStart);
    if (!rect) return;
    const paneBox = pane.getBoundingClientRect();
    let caretTop = textarea.getBoundingClientRect().top + rect.top;

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
    if (typing.current) return;
    syncTo(getEditorScroller(), previewRef.current);
  }, [syncTo, getEditorScroller]);

  const onPreviewScroll = useCallback(() => {
    if (owner.current !== "preview") return;
    syncTo(previewRef.current, getEditorScroller());
  }, [syncTo, getEditorScroller]);

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
