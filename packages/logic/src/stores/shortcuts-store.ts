import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ShortcutCategory = "general" | "navigation" | "editor";

export type ShortcutDef = {
  id: string;
  label: string;
  category: ShortcutCategory;
  defaultKeys: string;
  description: string;
};

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  {
    id: "commandPalette",
    label: "Command Palette",
    category: "general",
    defaultKeys: "Mod+k",
    description: "Open universal search and command center",
  },
  {
    id: "toggleSidebar",
    label: "Toggle Sidebar",
    category: "general",
    defaultKeys: "Mod+\\",
    description: "Collapse or expand the sidebar",
  },
  {
    id: "toggleFocusMode",
    label: "Focus Mode",
    category: "general",
    defaultKeys: "Mod+Shift+f",
    description: "Toggle distraction-free writing mode",
  },
  {
    id: "toggleTheme",
    label: "Toggle Theme",
    category: "general",
    defaultKeys: "Mod+Shift+t",
    description: "Cycle between light, dark, and system themes",
  },
  {
    id: "escape",
    label: "Close / Exit",
    category: "general",
    defaultKeys: "Escape",
    description: "Close dialogs, command palette, or exit focus mode",
  },

  {
    id: "newArticle",
    label: "New Article",
    category: "navigation",
    defaultKeys: "Mod+n",
    description: "Create a new article in the current project",
  },
  {
    id: "switchProject",
    label: "Switch Project",
    category: "navigation",
    defaultKeys: "Mod+p",
    description: "Quick-switch between projects",
  },
  {
    id: "switchLayout",
    label: "Switch Layout",
    category: "navigation",
    defaultKeys: "Mod+Shift+l",
    description: "Toggle between table and board view",
  },
  {
    id: "goToDashboard",
    label: "Go to Dashboard",
    category: "navigation",
    defaultKeys: "Mod+Shift+h",
    description: "Navigate to the main dashboard",
  },
  {
    id: "goToSettings",
    label: "Go to Settings",
    category: "navigation",
    defaultKeys: "Mod+,",
    description: "Open application settings",
  },

  {
    id: "editorBold",
    label: "Bold",
    category: "editor",
    defaultKeys: "Mod+b",
    description: "Wrap selection in bold markers",
  },
  {
    id: "editorItalic",
    label: "Italic",
    category: "editor",
    defaultKeys: "Mod+i",
    description: "Wrap selection in italic markers",
  },
  {
    id: "editorLink",
    label: "Insert Link",
    category: "editor",
    defaultKeys: "Mod+l",
    description: "Insert a markdown link",
  },
  {
    id: "editorCodeBlock",
    label: "Code Block",
    category: "editor",
    defaultKeys: "Mod+Shift+k",
    description: "Wrap selection in a fenced code block",
  },
  {
    id: "scheduleArticle",
    label: "Schedule Article",
    category: "editor",
    defaultKeys: "Mod+Shift+s",
    description: "Open the scheduling dialog for the current article",
  },
  {
    id: "publishArticle",
    label: "Publish Article",
    category: "editor",
    defaultKeys: "Mod+Shift+p",
    description: "Publish the current article to GitHub",
  },
  {
    id: "inlineAI",
    label: "Inline AI",
    category: "editor",
    defaultKeys: "Mod+j",
    description: "Transform selected text with a custom AI prompt",
  },
  {
    id: "toggleSprint",
    label: "Writing Sprint",
    category: "editor",
    defaultKeys: "Mod+Shift+u",
    description: "Start a writing sprint, or end the one in progress",
  },
];

const DEFAULTS_MAP = new Map(DEFAULT_SHORTCUTS.map((s) => [s.id, s]));

type ShortcutsState = {
  bindings: Record<string, string>;

  getKeys: (id: string) => string;

  setBinding: (id: string, keys: string) => void;

  resetBinding: (id: string) => void;

  resetAll: () => void;
};

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      bindings: {},

      getKeys: (id: string) => {
        const override = get().bindings[id];
        if (override !== undefined) return override;
        const def = DEFAULTS_MAP.get(id);
        return def?.defaultKeys ?? "";
      },

      setBinding: (id: string, keys: string) =>
        set((state) => ({
          bindings: { ...state.bindings, [id]: keys },
        })),

      resetBinding: (id: string) =>
        set((state) => {
          const next = { ...state.bindings };
          delete next[id];
          return { bindings: next };
        }),

      resetAll: () => set({ bindings: {} }),
    }),
    {
      name: "wryte-shortcuts",
      partialize: (state) => ({ bindings: state.bindings }),
    },
  ),
);

export function findConflict(
  keys: string,
  excludeId: string,
): ShortcutDef | null {
  const { bindings } = useShortcutsStore.getState();

  for (const def of DEFAULT_SHORTCUTS) {
    if (def.id === excludeId) continue;
    const currentKeys = bindings[def.id] ?? def.defaultKeys;
    if (currentKeys.toLowerCase() === keys.toLowerCase()) {
      return def;
    }
  }
  return null;
}
