import { create } from "zustand";
import { persist } from "zustand/middleware";

/** User-selectable theme modes. "system" defers to the OS preference via `prefers-color-scheme`. */
type ThemeMode = "light" | "dark" | "system";

/** Theme state — intentionally minimal; only stores the user's preference. */
type ThemeState = {
  /** The active theme mode. Defaults to "dark" so first-time users get the branded dark experience. */
  mode: ThemeMode;
  /** Switch to a specific theme mode. The new value is persisted to localStorage automatically. */
  setMode: (mode: ThemeMode) => void;
};

/**
 * Persisted theme store.
 *
 * Uses Zustand's `persist` middleware to read/write the selected theme mode
 * to localStorage under the key "wryte-theme". This ensures the user's
 * preference survives page reloads and new tabs without any server round-trip.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      setMode: (mode) => set({ mode }),
    }),
    {
      // localStorage key — keep stable to avoid losing user preferences across deploys
      name: "wryte-theme",
    },
  ),
);
