/**
 * Wryte service worker — minimal by design.
 *
 * Registered as /sw.js?v=<build sha> (see ServiceWorkerRegistration): the
 * query string changes per deploy, so the browser fetches and installs a
 * fresh worker whose caches are keyed by that version — stale caches are
 * dropped on activate.
 *
 * Scope of interception (everything else passes straight through):
 *  - page navigations: network-first, /offline fallback when unreachable
 *  - hashed static assets (/_next/static/): cache-first (immutable by name)
 *
 * Never touched: non-GET requests, cross-origin requests (Convex, Clerk,
 * fonts, analytics — websockets are never routed through fetch handlers),
 * and same-origin /api routes.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `wryte-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Reload past any HTTP cache so the offline fallback is this deploy's.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("wryte-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first so content is always fresh; cached
  // offline shell only when the network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  // Hashed build assets are immutable by filename: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
