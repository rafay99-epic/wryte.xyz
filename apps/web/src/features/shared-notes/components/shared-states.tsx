import { BRAND, resolveBrandAsset } from "@wryte/logic/lib/branding";
import Image from "next/image";
import type { ReactNode } from "react";

const HOME_URL = "/?utm_source=shared&utm_medium=share";

export function SharedHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-black/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-6">
        <a
          href={HOME_URL}
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <Image
            src={resolveBrandAsset(BRAND.icon)}
            alt=""
            width={20}
            height={20}
            className="rounded-[5px]"
            unoptimized
          />
          <span className="text-sm font-semibold tracking-tight">wryte</span>
        </a>
        <span className="text-xs text-white/50">Read only</span>
      </div>
    </header>
  );
}

export function SharedFooter() {
  return (
    <footer className="border-t border-white/[0.08]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-5 text-xs text-white/50">
        <span>Shared from Wryte. Always shows the latest saved version.</span>
        <a
          href={HOME_URL}
          className="shrink-0 rounded text-white/80 underline-offset-4 outline-none hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Write with Wryte
        </a>
      </div>
    </footer>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-sm text-center">{children}</div>
    </main>
  );
}

export function SharedUnavailable() {
  return (
    <CenteredMessage>
      <h1 className="text-lg font-semibold text-white">
        This link is no longer available
      </h1>
      <p className="mt-2 text-sm text-white/55">
        It may have expired or been revoked by its owner.
      </p>
    </CenteredMessage>
  );
}

export function SharedLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <CenteredMessage>
      <h1 className="text-lg font-semibold text-white">
        Couldn't load this link
      </h1>
      <p className="mt-2 text-sm text-white/55">
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/30"
      >
        Try again
      </button>
    </CenteredMessage>
  );
}

export function SharedSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading shared notes"
      className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12"
    >
      <div className="h-7 w-2/3 rounded-md bg-white/[0.06]" />
      <div className="mt-3 h-4 w-48 rounded-md bg-white/[0.04]" />
      <BodyPlaceholder className="mt-12" />
    </main>
  );
}

export function BodyPlaceholder({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <div className="h-3.5 w-full rounded bg-white/[0.05]" />
      <div className="mt-3 h-3.5 w-full rounded bg-white/[0.05]" />
      <div className="mt-3 h-3.5 w-3/4 rounded bg-white/[0.05]" />
    </div>
  );
}
