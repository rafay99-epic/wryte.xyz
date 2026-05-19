import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { ChangelogList } from "./_components/changelog-list";
import { ChangelogListSkeleton } from "./_components/changelog-list-skeleton";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Recent releases, fixes, and improvements to Wryte.",
};

export default function ChangelogPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-amber-500/[0.04] blur-[120px]" />
      </div>

      <header className="relative z-10 border-b border-foreground/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground/80 transition-colors hover:text-foreground"
          >
            ← Back to Wryte
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/50">
            Changelog
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 py-20 sm:py-28">
        <div className="mb-20 text-center">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-amber-500/80">
            What&apos;s new
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Changelog
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-foreground/65 dark:text-foreground/55">
            A record of every release, fix, and improvement we&apos;ve shipped.
            Subscribe to the{" "}
            <Link
              href="/rss.xml"
              className="text-amber-500 underline decoration-amber-500/30 underline-offset-[3px] transition-colors hover:decoration-amber-500/60"
            >
              RSS feed
            </Link>{" "}
            to follow along.
          </p>
        </div>

        <Suspense fallback={<ChangelogListSkeleton />}>
          <ChangelogList />
        </Suspense>
      </main>

      <MarketingFooter />
    </div>
  );
}
