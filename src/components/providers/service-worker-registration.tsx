"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production. The build SHA rides the registration URL
 * as a query param — a new deploy changes the URL, the browser fetches the
 * new worker, and its activate step drops the previous deploy's caches.
 * Dev is excluded so HMR and the service worker never fight.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const version = process.env["NEXT_PUBLIC_BUILD_SHA"] ?? "unknown";
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`)
      .catch((error: unknown) => {
        console.warn("Service worker registration failed:", error);
      });
  }, []);

  return null;
}
