import { caretRect } from "@wryte/logic/lib/dom/textarea-caret";
import { detectTrigger } from "@wryte/logic/lib/editor/slash-trigger";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type CaretPosition = {
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

export function useTriggerMenu(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
  detect: TriggerDetect,
  ownSelector: string,
): TriggerMenuState & { close: () => void } {
  const [state, setState] = useState<TriggerMenuState>(CLOSED);
  const composingRef = useRef(false);
  const close = useCallback(() => setState((s) => (s.open ? CLOSED : s)), []);

  useEffect(() => {
    if (!enabled) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const evaluate = () => {
      if (composingRef.current) return;
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
