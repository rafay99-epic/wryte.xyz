import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { caretRect } from "../lib/caret/textarea-caret";
import { detectTrigger } from "../lib/slash/trigger";

type CaretPosition = {
  /** Viewport coords of the caret's line top + its height (for below/above placement). */
  caretTop: number;
  caretLeft: number;
  caretHeight: number;
};

type TriggerMenuState = {
  open: boolean;
  query: string;
  queryStart: number;
  caretIndex: number;
  position: CaretPosition | null;
};

type TriggerDetect = (
  text: string,
  caret: number,
) => { queryStart: number; query: string } | null;

const CLOSED: TriggerMenuState = {
  open: false,
  query: "",
  queryStart: 0,
  caretIndex: 0,
  position: null,
};

/**
 * Watches the textarea for an active `/command` context. When `enabled` is
 * false it attaches NO listeners and does zero work per keystroke — the
 * zero-cost-when-disabled guarantee. Returns the menu open state, current
 * query, the `/` position (for insertion), and the caret pixel position (for
 * the popover). The caller owns filtering, keyboard nav, and insertion.
 */
export function useSlashMenu(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
): TriggerMenuState & { close: () => void } {
  return useTriggerMenu(
    textareaRef,
    enabled,
    detectTrigger,
    "[data-slash-menu]",
  );
}

/**
 * Generic caret-trigger menu watcher — the machinery behind the slash menu
 * and the `[[` internal-link menu. `detect` decides whether the caret sits
 * in an active trigger context; `ownSelector` identifies the menu's DOM so
 * scrolling inside it doesn't close it.
 */
export function useTriggerMenu(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
  detect: TriggerDetect,
  ownSelector: string,
): TriggerMenuState & { close: () => void } {
  const [state, setState] = useState<TriggerMenuState>(CLOSED);
  const composingRef = useRef(false);
  // Stable so consumers can use it in effect deps without re-running.
  const close = useCallback(() => setState((s) => (s.open ? CLOSED : s)), []);

  useEffect(() => {
    if (!enabled) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const evaluate = () => {
      if (composingRef.current) return;
      // Only a collapsed caret can be a slash context.
      if (ta.selectionStart !== ta.selectionEnd) {
        close();
        return;
      }
      const caret = ta.selectionStart;
      const trigger = detect(ta.value, caret);
      if (!trigger) {
        close();
        return;
      }
      const rect = caretRect(ta, trigger.queryStart);
      const taRect = ta.getBoundingClientRect();
      const position: CaretPosition | null = rect
        ? {
            caretTop: taRect.top + rect.top,
            caretLeft: taRect.left + rect.left,
            caretHeight: rect.height,
          }
        : null;
      setState({
        open: true,
        query: trigger.query,
        queryStart: trigger.queryStart,
        caretIndex: caret,
        position,
      });
    };

    const onCompositionStart = () => {
      composingRef.current = true;
    };
    const onCompositionEnd = () => {
      composingRef.current = false;
      evaluate();
    };
    const onSelectionChange = () => {
      if (document.activeElement === ta) evaluate();
    };
    const onScroll = (e: Event) => {
      // Let the menu scroll its own list; only an editor/page scroll closes it.
      const target = e.target;
      if (target instanceof Element && target.closest(ownSelector)) {
        return;
      }
      close();
    };

    ta.addEventListener("input", evaluate);
    ta.addEventListener("compositionstart", onCompositionStart);
    ta.addEventListener("compositionend", onCompositionEnd);
    ta.addEventListener("blur", close);
    document.addEventListener("selectionchange", onSelectionChange);
    // Capture phase catches scrolls on the editor pane (scroll doesn't bubble);
    // passive since we never preventDefault.
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      ta.removeEventListener("input", evaluate);
      ta.removeEventListener("compositionstart", onCompositionStart);
      ta.removeEventListener("compositionend", onCompositionEnd);
      ta.removeEventListener("blur", close);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled, textareaRef, close, detect, ownSelector]);

  return { ...state, close };
}
