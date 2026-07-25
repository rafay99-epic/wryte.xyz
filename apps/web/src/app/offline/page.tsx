import { BRAND, resolveBrandAsset } from "@wryte/logic/lib/branding";
import Image from "next/image";

export const metadata = {
  title: "Offline — Wryte",
};

/**
 * Offline fallback served by the service worker when a page navigation
 * fails. Deliberately self-contained and JS-free: it renders fully from
 * the precached HTML, and the retry link is a plain anchor — if the
 * network is back the navigation succeeds, otherwise the worker serves
 * this page again. Mirrors the desktop app's offline UX.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Image
        src={resolveBrandAsset(BRAND.icon)}
        alt="Wryte"
        width={64}
        height={64}
        className="rounded-2xl opacity-90"
        priority
        unoptimized
      />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          You&apos;re offline
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Wryte needs a connection to reach your content. Your latest edits were
          saved locally by the editor before you went offline.
        </p>
      </div>
      <a
        href="/dashboard"
        className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-amber-400"
      >
        Try again
      </a>
    </div>
  );
}
