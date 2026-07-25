"use client";

/**
 * Full-width banner shown when the desktop wrapper detects no internet.
 * Renders nothing outside Electron (no `wryteDesktop` API).
 */
export function DesktopOfflineBanner({ online }: { online: boolean | null }) {
  if (online !== false) return null;

  return (
    <div className="fixed top-0 right-0 left-0 z-[60] flex items-center justify-center gap-2.5 bg-red-500/90 px-4 py-2 text-center text-[12px] font-medium text-white backdrop-blur-sm sm:text-[13px]">
      <span className="size-1.5 shrink-0 rounded-full bg-white/60" />
      <span>
        Internet connection required — Wryte needs a network connection to work.
      </span>
    </div>
  );
}
