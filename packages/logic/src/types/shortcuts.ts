/**
 * Shared shortcut types.
 *
 * The store in `src/stores/shortcuts-store.ts` re-exports these for
 * backwards compatibility, but any new code should import from here.
 */

export type ShortcutCategory = "general" | "navigation" | "editor";

export type ShortcutDef = {
  /** Unique identifier, e.g. "toggleSidebar" */
  id: string;
  /** Human-readable label, e.g. "Toggle Sidebar" */
  label: string;
  /** Grouping category for settings UI */
  category: ShortcutCategory;
  /** Default key binding in TanStack Hotkeys format, e.g. "Mod+\\" */
  defaultKeys: string;
  /** Short description shown in settings */
  description: string;
};
