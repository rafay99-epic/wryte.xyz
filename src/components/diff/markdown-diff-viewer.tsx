"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { ReactDiffViewerStylesOverride } from "react-diff-viewer-continued";
import { Skeleton } from "@/components/ui/skeleton";

// react-diff-viewer-continued is ~1.2 MB and only renders on rarely-hit
// surfaces (conflict resolution, draft compare) — load it lazily so it
// never ships in the main app bundle.
const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

/**
 * Diff viewer palette wired to the app's CSS theme tokens. Every value is a
 * `var(--*)` reference, so the diff inherits whichever theme is active on
 * `<html>` and re-themes automatically when the user toggles dark/light — no
 * `useTheme()` re-renders needed. Added/removed highlights use semi-transparent
 * emerald/destructive overlays so they read on both light and dark surfaces
 * without inventing a separate palette.
 *
 * The same overrides are sent to both `variables.light` and `variables.dark`
 * so the library's internal `useDarkTheme` switch doesn't pull in its default
 * white panel for either branch.
 */
const DIFF_VIEWER_VARS = {
  // Surfaces — pull straight from app tokens.
  diffViewerBackground: "var(--card)",
  diffViewerColor: "var(--card-foreground)",
  diffViewerTitleBackground: "var(--muted)",
  diffViewerTitleColor: "var(--foreground)",
  diffViewerTitleBorderColor: "var(--border)",

  // Gutter (line-number column) — slightly darker than the surface.
  gutterBackground: "var(--muted)",
  gutterBackgroundDark: "var(--muted)",
  gutterColor: "var(--muted-foreground)",
  emptyLineBackground: "var(--card)",
  codeFoldGutterBackground: "var(--muted)",
  codeFoldBackground: "var(--muted)",
  codeFoldContentColor: "var(--muted-foreground)",
  highlightBackground: "var(--accent)",
  highlightGutterBackground: "var(--accent)",

  // Added (right side / new lines) — emerald wash that respects the current
  // background instead of stamping a hard green panel.
  addedBackground: "color-mix(in oklab, var(--card) 85%, oklch(0.7 0.16 145))",
  addedColor: "var(--foreground)",
  wordAddedBackground:
    "color-mix(in oklab, var(--card) 60%, oklch(0.7 0.16 145))",
  addedGutterBackground:
    "color-mix(in oklab, var(--muted) 80%, oklch(0.7 0.16 145))",
  addedGutterColor: "var(--foreground)",

  // Removed (left side / old lines) — destructive wash, same trick.
  removedBackground: "color-mix(in oklab, var(--card) 85%, var(--destructive))",
  removedColor: "var(--foreground)",
  wordRemovedBackground:
    "color-mix(in oklab, var(--card) 60%, var(--destructive))",
  removedGutterBackground:
    "color-mix(in oklab, var(--muted) 80%, var(--destructive))",
  removedGutterColor: "var(--foreground)",
} as const;

/**
 * Theme-aware style overrides shared by every ReactDiffViewer instance in the
 * app. Exported so callers that need to render the viewer directly can reuse
 * the exact same palette.
 */
export const DIFF_VIEWER_STYLES: ReactDiffViewerStylesOverride = {
  variables: {
    dark: DIFF_VIEWER_VARS,
    light: DIFF_VIEWER_VARS,
  },
  contentText: { fontFamily: "var(--font-mono)" },
  lineNumber: { fontFamily: "var(--font-mono)" },
  titleBlock: { fontFamily: "var(--font-sans)", fontWeight: 500 },
};

type MarkdownDiffViewerProps = {
  /** Left-hand ("old") content. */
  oldValue: string;
  /** Right-hand ("new") content. */
  newValue: string;
  /** Title above the left column. */
  leftTitle?: string | ReactElement;
  /** Title above the right column. */
  rightTitle?: string | ReactElement;
  /** Split (two-column) vs unified view. Defaults to split. */
  splitView?: boolean;
  /** Hide the line-number gutters. Defaults to showing them. */
  hideLineNumbers?: boolean;
};

/**
 * Thin, theme-aware wrapper around `react-diff-viewer-continued`. Owns the
 * lazy import and the shared CSS-variable palette so every diff surface in the
 * app (sync-conflict resolution, side-by-side draft compare) renders with an
 * identical, theme-following look. Callers only pass the two sides + titles.
 */
export function MarkdownDiffViewer({
  oldValue,
  newValue,
  leftTitle,
  rightTitle,
  splitView = true,
  hideLineNumbers = false,
}: MarkdownDiffViewerProps) {
  return (
    <ReactDiffViewer
      oldValue={oldValue}
      newValue={newValue}
      splitView={splitView}
      // `useDarkTheme` only selects which `variables` block the library reads;
      // both blocks reference identical CSS variables, so the choice doesn't
      // matter — the theme follows `<html class="dark">` automatically.
      useDarkTheme={false}
      // Only forward titles when provided — the library's prop types are not
      // `undefined`-tolerant under `exactOptionalPropertyTypes`.
      {...(leftTitle !== undefined ? { leftTitle } : {})}
      {...(rightTitle !== undefined ? { rightTitle } : {})}
      hideLineNumbers={hideLineNumbers}
      styles={DIFF_VIEWER_STYLES}
    />
  );
}
