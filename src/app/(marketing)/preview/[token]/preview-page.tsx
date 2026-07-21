"use client";

import { useQuery } from "convex/react";
import { ArrowRight, Clock, Eye, FileQuestion } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import { SharedMdxContent } from "@/components/markdown/shared-mdx-content";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND, resolveBrandAsset } from "@/lib/branding";
import { relativeTime } from "@/lib/relative-time";
import { api } from "../../../../../convex/_generated/api";

/**
 * Every preview visitor is a non-user reading a Wryte-made draft — the
 * chrome and CTA below are the growth loop for this page. Clicks are
 * measurable via utm_source=preview (mirrors the /gh commit channel).
 */
const PREVIEW_CTA_URL = "/?utm_source=preview&utm_medium=share";

/**
 * Shared shell for all three preview states (loading, not-found, document)
 * so even a dead link carries the brand. Header only — the CTA card is
 * document-state-specific.
 */
function PreviewChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-3">
          <a
            href={PREVIEW_CTA_URL}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src={resolveBrandAsset(BRAND.icon)}
              alt="Wryte"
              width={24}
              height={24}
              className="rounded-md"
              unoptimized
            />
            <span className="text-sm font-semibold tracking-tight">wryte</span>
          </a>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-500">
            <Eye className="size-3" />
            Draft preview
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}

/**
 * Public read-only draft preview, resolved by the share token in the URL.
 * No auth — the token is the credential; revoked/unknown tokens render
 * the same neutral not-found state. The page stays noindex (see page.tsx);
 * branding and the CTA are for the human reader, never for crawlers.
 */
export function PreviewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const document = useQuery(
    api.cms.shareLinks.getByToken,
    token ? { token } : "skip",
  );
  // Animation sources for MDX drafts — same token, same trust, [] for
  // md-format projects or when the feature is off.
  const animations = useQuery(
    api.cms.shareLinks.animationsByToken,
    token && document?.contentFormat === "mdx" ? { token } : "skip",
  );

  if (document === undefined) {
    return (
      <PreviewChrome>
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="mb-8 h-9 w-3/4" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </main>
      </PreviewChrome>
    );
  }

  if (document === null) {
    return (
      <PreviewChrome>
        <main className="flex flex-1 items-center justify-center px-6 py-24">
          <div className="text-center">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted/60">
              <FileQuestion className="size-7 text-muted-foreground" />
            </div>
            <h1 className="mb-2 text-lg font-semibold tracking-tight">
              Preview not available
            </h1>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              This preview link is invalid or has been revoked by the author.
            </p>
          </div>
        </main>
      </PreviewChrome>
    );
  }

  return (
    <PreviewChrome>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Clock className="size-3" />
            Updated {relativeTime(document.updatedAt)}
          </span>
        </div>

        <h1 className="mb-8 font-heading text-3xl font-bold tracking-tight">
          {document.title || "Untitled"}
        </h1>

        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-[1.8] prose-p:text-foreground/85 prose-li:leading-[1.8] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-strong:text-foreground prose-strong:font-semibold prose-img:rounded-xl">
          {document.contentFormat === "mdx" ? (
            <SharedMdxContent
              content={document.content}
              animations={animations ?? []}
            />
          ) : (
            <ChangelogMarkdown content={document.content} />
          )}
        </article>

        <footer className="mt-16 border-t border-border/40 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3.5">
            <p className="max-w-md text-[13px] leading-relaxed text-foreground/80">
              This read-only draft was written in <strong>Wryte</strong> — the
              open-source, git-native CMS. Write in markdown, publish straight
              to GitHub; your repo stays the source of truth.
            </p>
            <a
              href={PREVIEW_CTA_URL}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-amber-400"
            >
              Start writing free
              <ArrowRight className="size-3.5" />
            </a>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground/50">
            Shared by its author — always reflects the latest saved version.
          </p>
        </footer>
      </main>
    </PreviewChrome>
  );
}
