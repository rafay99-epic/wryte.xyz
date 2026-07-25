"use client";

import { useEffect, useState } from "react";
import { DesktopOfflineBanner } from "@/components/layout/desktop-offline-banner";

declare global {
  interface Window {
    wryteDesktop?: {
      isDesktop: boolean;
      platform: string;
      isMac: boolean;
      online: boolean | null;
      onOnlineStatusChange: (cb: (online: boolean) => void) => () => void;
      submitTask: (
        task: string,
        params: Record<string, unknown>,
      ) => Promise<unknown>;
      getWorkerStatus: () => Promise<{
        connectivity: number | null;
        task: number | null;
      }>;
    };
  }
}

/**
 * Marks the document when running inside the macOS desktop shell so the site's
 * headers can double as the draggable title bar with room for the traffic-light
 * buttons (styling lives in globals.css under `html.wryte-desktop-mac`).
 *
 * Also tracks online/offline state. The offline banner renders when the
 * desktop wrapper detects no internet connectivity.
 *
 * `window.wryteDesktop` is injected by the Electron preload; on the web it's
 * undefined and this renders nothing, so the site is unaffected.
 */
export function DesktopChrome() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    const d = window.wryteDesktop;
    if (!d?.isDesktop) return;

    if (d.isMac) {
      document.documentElement.classList.add("wryte-desktop-mac");
    }

    let prev: boolean | null = null;
    const unsub = d.onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      document.documentElement.classList.toggle(
        "wryte-desktop-offline",
        !isOnline,
      );

      if (prev === false && isOnline === true) {
        setBackOnline(true);
        setTimeout(() => setBackOnline(false), 3000);
      }
      prev = isOnline;
    });

    return unsub;
  }, []);

  return (
    <>
      <DesktopOfflineBanner online={online} />
      {backOnline && (
        <div className="fixed top-0 right-0 left-0 z-[60] flex items-center justify-center gap-2.5 bg-emerald-500/90 px-4 py-2 text-center text-[12px] font-medium text-white backdrop-blur-sm sm:text-[13px]">
          <span className="size-1.5 shrink-0 rounded-full bg-white/60" />
          <span>Back online</span>
        </div>
      )}
    </>
  );
}
