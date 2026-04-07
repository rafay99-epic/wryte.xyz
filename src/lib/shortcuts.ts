/**
 * Keyboard shortcut utilities for display formatting and platform detection.
 */

/** Detect macOS/iOS for keyboard shortcut display. */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/**
 * Convert a TanStack Hotkeys key string like "Mod+Shift+k" into a
 * human-readable display string.
 *
 * On macOS: "⌘⇧K"
 * On Windows/Linux: "Ctrl+Shift+K"
 */
export function formatShortcutDisplay(keys: string): string {
  if (!keys) return "";
  const mac = isMac();
  return keys
    .split("+")
    .map((k) => {
      const lower = k.toLowerCase();
      if (lower === "mod") return mac ? "⌘" : "Ctrl";
      if (lower === "shift") return mac ? "⇧" : "Shift";
      if (lower === "alt") return mac ? "⌥" : "Alt";
      if (lower === "control") return mac ? "⌃" : "Ctrl";
      if (lower === "meta") return mac ? "⌘" : "Win";
      if (lower === "escape") return "Esc";
      if (lower === "backspace") return "⌫";
      if (lower === "enter") return "↵";
      if (lower === "arrowup") return "↑";
      if (lower === "arrowdown") return "↓";
      if (lower === "arrowleft") return "←";
      if (lower === "arrowright") return "→";
      if (k === "\\") return "\\";
      return k.toUpperCase();
    })
    .join(mac ? "" : "+");
}

/**
 * Split a formatted display string into individual key tokens for rendering
 * as separate <kbd> elements.
 */
export function splitShortcutKeys(keys: string): string[] {
  if (!keys) return [];
  const mac = isMac();
  return keys
    .split("+")
    .map((k) => {
      const lower = k.toLowerCase();
      if (lower === "mod") return mac ? "⌘" : "Ctrl";
      if (lower === "shift") return mac ? "⇧" : "Shift";
      if (lower === "alt") return mac ? "⌥" : "Alt";
      if (lower === "control") return mac ? "⌃" : "Ctrl";
      if (lower === "escape") return "Esc";
      if (k === "\\") return "\\";
      return k.toUpperCase();
    });
}
