"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    wryteDesktop?: { isDesktop: boolean; platform: string; isMac: boolean };
  }
}

/**
 * Marks the document when running inside the macOS desktop shell so the site's
 * headers can double as the draggable title bar with room for the traffic-light
 * buttons (styling lives in globals.css under `html.wryte-desktop-mac`).
 *
 * `window.wryteDesktop` is injected by the Electron preload; on the web it's
 * undefined and this renders nothing, so the site is unaffected.
 */
export function DesktopChrome() {
  useEffect(() => {
    if (window.wryteDesktop?.isMac) {
      document.documentElement.classList.add("wryte-desktop-mac");
    }
  }, []);

  return null;
}
