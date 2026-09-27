export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

export function splitShortcutKeys(keys: string, mac = isMac()): string[] {
  if (!keys) return [];
  return keys.split("+").map((k) => {
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
