"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
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
