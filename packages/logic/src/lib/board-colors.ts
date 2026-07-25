/**
 * Centralized 16-color palette for board columns, tags, and status badges.
 *
 * Each color provides a full set of Tailwind classes for light and dark mode:
 * - accent: column top-border highlight
 * - badge: count chips and status badges
 * - cardHover: subtle card background tint
 * - dot: color picker swatch circle
 * - ring: focus/selected outline
 */

export const BOARD_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

export type BoardColor = (typeof BOARD_COLORS)[number];

export type ColorClasses = {
  /** Column top-border accent: e.g. "border-t-blue-500" */
  accent: string;
  /** Badge/count background: e.g. "bg-blue-500/10 text-blue-600 dark:text-blue-400" */
  badge: string;
  /** Subtle card hover tint */
  cardHover: string;
  /** Small dot swatch for color picker */
  dot: string;
  /** Ring for focus/selected state */
  ring: string;
};

export const COLOR_MAP: Record<BoardColor, ColorClasses> = {
  gray: {
    accent: "border-t-gray-400",
    badge: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    cardHover: "hover:bg-gray-50 dark:hover:bg-gray-900/30",
    dot: "bg-gray-400",
    ring: "ring-gray-400",
  },
  red: {
    accent: "border-t-red-500",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
    cardHover: "hover:bg-red-50 dark:hover:bg-red-950/30",
    dot: "bg-red-500",
    ring: "ring-red-500",
  },
  orange: {
    accent: "border-t-orange-500",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    cardHover: "hover:bg-orange-50 dark:hover:bg-orange-950/30",
    dot: "bg-orange-500",
    ring: "ring-orange-500",
  },
  amber: {
    accent: "border-t-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    cardHover: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
    dot: "bg-amber-500",
    ring: "ring-amber-500",
  },
  yellow: {
    accent: "border-t-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    cardHover: "hover:bg-yellow-50 dark:hover:bg-yellow-950/30",
    dot: "bg-yellow-500",
    ring: "ring-yellow-500",
  },
  lime: {
    accent: "border-t-lime-500",
    badge: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
    cardHover: "hover:bg-lime-50 dark:hover:bg-lime-950/30",
    dot: "bg-lime-500",
    ring: "ring-lime-500",
  },
  emerald: {
    accent: "border-t-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    cardHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500",
  },
  teal: {
    accent: "border-t-teal-500",
    badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    cardHover: "hover:bg-teal-50 dark:hover:bg-teal-950/30",
    dot: "bg-teal-500",
    ring: "ring-teal-500",
  },
  cyan: {
    accent: "border-t-cyan-500",
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    cardHover: "hover:bg-cyan-50 dark:hover:bg-cyan-950/30",
    dot: "bg-cyan-500",
    ring: "ring-cyan-500",
  },
  blue: {
    accent: "border-t-blue-500",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    cardHover: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
    dot: "bg-blue-500",
    ring: "ring-blue-500",
  },
  indigo: {
    accent: "border-t-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    cardHover: "hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
    dot: "bg-indigo-500",
    ring: "ring-indigo-500",
  },
  violet: {
    accent: "border-t-violet-500",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    cardHover: "hover:bg-violet-50 dark:hover:bg-violet-950/30",
    dot: "bg-violet-500",
    ring: "ring-violet-500",
  },
  purple: {
    accent: "border-t-purple-500",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    cardHover: "hover:bg-purple-50 dark:hover:bg-purple-950/30",
    dot: "bg-purple-500",
    ring: "ring-purple-500",
  },
  fuchsia: {
    accent: "border-t-fuchsia-500",
    badge: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    cardHover: "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30",
    dot: "bg-fuchsia-500",
    ring: "ring-fuchsia-500",
  },
  pink: {
    accent: "border-t-pink-500",
    badge: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    cardHover: "hover:bg-pink-50 dark:hover:bg-pink-950/30",
    dot: "bg-pink-500",
    ring: "ring-pink-500",
  },
  rose: {
    accent: "border-t-rose-500",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    cardHover: "hover:bg-rose-50 dark:hover:bg-rose-950/30",
    dot: "bg-rose-500",
    ring: "ring-rose-500",
  },
};

/** Helper to get classes for a color key with fallback to gray. */
export function getColorClasses(color: string): ColorClasses {
  return COLOR_MAP[color as BoardColor] ?? COLOR_MAP.gray;
}
