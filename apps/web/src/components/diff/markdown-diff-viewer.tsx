"use client";

import { Skeleton } from "@wryte/ui/skeleton";
import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { ReactDiffViewerStylesOverride } from "react-diff-viewer-continued";

const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

const DIFF_VIEWER_VARS = {
  diffViewerBackground: "var(--card)",
  diffViewerColor: "var(--card-foreground)",
  diffViewerTitleBackground: "var(--muted)",
  diffViewerTitleColor: "var(--foreground)",
  diffViewerTitleBorderColor: "var(--border)",

  gutterBackground: "var(--muted)",
  gutterBackgroundDark: "var(--muted)",
  gutterColor: "var(--muted-foreground)",
  emptyLineBackground: "var(--card)",
  codeFoldGutterBackground: "var(--muted)",
  codeFoldBackground: "var(--muted)",
  codeFoldContentColor: "var(--muted-foreground)",
  highlightBackground: "var(--accent)",
  highlightGutterBackground: "var(--accent)",

  addedBackground: "color-mix(in oklab, var(--card) 85%, oklch(0.7 0.16 145))",
  addedColor: "var(--foreground)",
  wordAddedBackground:
    "color-mix(in oklab, var(--card) 60%, oklch(0.7 0.16 145))",
  addedGutterBackground:
    "color-mix(in oklab, var(--muted) 80%, oklch(0.7 0.16 145))",
  addedGutterColor: "var(--foreground)",

  removedBackground: "color-mix(in oklab, var(--card) 85%, var(--destructive))",
  removedColor: "var(--foreground)",
  wordRemovedBackground:
    "color-mix(in oklab, var(--card) 60%, var(--destructive))",
  removedGutterBackground:
    "color-mix(in oklab, var(--muted) 80%, var(--destructive))",
  removedGutterColor: "var(--foreground)",
} as const;

const DIFF_VIEWER_STYLES: ReactDiffViewerStylesOverride = {
  variables: {
    dark: DIFF_VIEWER_VARS,
    light: DIFF_VIEWER_VARS,
  },
  contentText: { fontFamily: "var(--font-mono)" },
  lineNumber: { fontFamily: "var(--font-mono)" },
  titleBlock: { fontFamily: "var(--font-sans)", fontWeight: 500 },
};

type MarkdownDiffViewerProps = {
  oldValue: string;
  newValue: string;
  leftTitle?: string | ReactElement;
  rightTitle?: string | ReactElement;
  splitView?: boolean;
  hideLineNumbers?: boolean;
};

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
      useDarkTheme={false}
      {...(leftTitle !== undefined ? { leftTitle } : {})}
      {...(rightTitle !== undefined ? { rightTitle } : {})}
      hideLineNumbers={hideLineNumbers}
      styles={DIFF_VIEWER_STYLES}
    />
  );
}
