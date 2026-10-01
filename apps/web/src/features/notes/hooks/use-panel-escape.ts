import { useEffect } from "react";

const OPEN_POPUP =
  '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]';

export function usePanelEscape(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector(OPEN_POPUP)) return;
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}
