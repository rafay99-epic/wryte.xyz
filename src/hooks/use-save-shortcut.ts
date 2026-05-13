import { useEffect, useRef } from "react";

/**
 * Listen for the platform-standard "save document" shortcut
 * (Cmd+S on macOS, Ctrl+S on Windows/Linux) at the window level and
 * forward it to the provided handler.
 *
 * Suppresses the browser's default "Save Page As…" dialog so the
 * keystroke can be repurposed for in-app save.
 *
 * The callback is held in a ref so consumers can hand in fresh closures
 * each render without re-registering the listener.
 */
export function useSaveShortcut(handler: () => void): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // event.key normalises across layouts; the modifier covers both
      // Mac (metaKey) and Windows/Linux (ctrlKey).
      const isSaveCombo =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "s";
      if (!isSaveCombo) return;
      event.preventDefault();
      handlerRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
