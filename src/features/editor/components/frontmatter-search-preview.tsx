"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronRight, Globe, ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildDisplayUrl,
  checkDescription,
  checkTitle,
  pickImageValue,
} from "@/features/editor/lib/seo-preview";
import { cn } from "@/lib/utils";

type FrontmatterSearchPreviewProps = {
  /** Live frontmatter values from the visual editor. */
  values: Record<string, string | boolean>;
  /** Fallback title when frontmatter has none (the document title). */
  fallbackTitle: string;
  slug: string;
  siteUrl: string | null | undefined;
};

/**
 * Live Google-result + social-card preview rendered from the frontmatter the
 * editor already holds. Pure client-side — zero queries, zero writes. Sits
 * as a collapsible section at the bottom of the frontmatter panel.
 */
export function FrontmatterSearchPreview({
  values,
  fallbackTitle,
  slug,
  siteUrl,
}: FrontmatterSearchPreviewProps) {
  const [open, setOpen] = useState(false);

  const title =
    (typeof values["title"] === "string" && values["title"].trim()) ||
    fallbackTitle ||
    "Untitled";
  const description =
    typeof values["description"] === "string"
      ? values["description"].trim()
      : "";
  const imageUrl = pickImageValue(values);

  const titleCheck = useMemo(() => checkTitle(title), [title]);
  const descriptionCheck = useMemo(
    () => checkDescription(description),
    [description],
  );
  const displayUrl = useMemo(
    () => buildDisplayUrl(siteUrl, slug),
    [siteUrl, slug],
  );

  const warningCount =
    (titleCheck.truncated ? 1 : 0) +
    (descriptionCheck.truncated ? 1 : 0) +
    (description ? 0 : 1);

  return (
    <div className="border-t border-border/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight className="size-3" />
        </motion.div>
        <Globe className="size-3" />
        <span>Search preview</span>
        {warningCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-2.5" />
            {warningCount}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
            data-testid="search-preview"
          >
            <div className="space-y-5 px-4 pb-4 pt-1">
              {/* ── Google result ─────────────────────────────────── */}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  Google
                </p>
                <div className="max-w-[600px]">
                  <p className="truncate text-[12px] leading-4 text-muted-foreground">
                    {displayUrl.host}
                    {displayUrl.crumbs.map((c) => ` › ${c}`).join("")}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[18px] leading-6 text-[#1a0dab] dark:text-[#8ab4f8]",
                    )}
                  >
                    {title}
                  </p>
                  <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                    {description || (
                      <span className="italic opacity-60">
                        No description — Google will pick a snippet from the
                        article body.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* ── Social card (OG / Twitter large summary) ─────── */}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  Social card
                </p>
                <div className="max-w-[440px] overflow-hidden rounded-lg border border-border/60">
                  <div className="flex aspect-[1.91/1] items-center justify-center bg-muted/40">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Social card"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
                        <ImageOff className="size-5" />
                        <span className="text-[10px]">No social image set</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 border-t border-border/40 px-3 py-2">
                    <p className="text-[10px] uppercase text-muted-foreground/60">
                      {displayUrl.host}
                    </p>
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {title}
                    </p>
                    {description && (
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Warnings ─────────────────────────────────────── */}
              {warningCount > 0 && (
                <ul className="space-y-1">
                  {titleCheck.truncated && (
                    <PreviewWarning>
                      Title is ~{Math.round(titleCheck.widthPx)}px wide — Google
                      truncates around {titleCheck.limitPx}px. Consider
                      shortening it.
                    </PreviewWarning>
                  )}
                  {descriptionCheck.truncated && (
                    <PreviewWarning>
                      Description is ~{Math.round(descriptionCheck.widthPx)}px —
                      it will be cut off around {descriptionCheck.limitPx}px.
                    </PreviewWarning>
                  )}
                  {!description && (
                    <PreviewWarning>
                      No description set — search engines and social cards will
                      improvise one.
                    </PreviewWarning>
                  )}
                  {!displayUrl.hasSite && (
                    <PreviewWarning>
                      No site URL configured for this project — the preview
                      shows a placeholder domain.
                    </PreviewWarning>
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreviewWarning({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
