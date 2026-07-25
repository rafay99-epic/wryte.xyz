import type { Metadata } from "next";
import Link from "next/link";
import { FeatureRequestsBoard } from "./_components/feature-requests-board";

export const metadata: Metadata = {
  title: "Feature requests",
  description: "Ask for what Wryte should build next. Upvote ideas you'd use.",
};

export const revalidate = 30;

export default function FeatureRequestsPage() {
  return (
    <div className="relative min-h-screen">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-amber-500/[0.045] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-foreground/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground/80 transition-colors hover:text-foreground"
          >
            ← Back to Wryte
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/50">
            Feature requests
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {/* Hero */}
        <div className="mb-14 text-center">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-amber-500/80">
            Build with us
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Feature requests
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-foreground/65 dark:text-foreground/55">
            Tell us what to build next. Upvote ideas you&apos;d use, or submit
            your own — anything with traction makes it onto the roadmap.
          </p>
        </div>

        <FeatureRequestsBoard />
      </main>
    </div>
  );
}
