/*
 * TreatmentTrack service worker — deliberately conservative.
 *
 * - Page navigations always go to the network (patient data must never be
 *   stale), with a friendly offline page when there's no connection.
 * - Hashed static assets (/_next/static) are cached first, since their
 *   content never changes under the same URL.
 * - Nothing else is touched: API calls, server actions and auth all pass
 *   straight through.
 */
const VERSION = "tt-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(VERSION).then((cache) => cache.match(OFFLINE_URL))
      )
    );
    return;
  }

  const url = new URL(request.url);
  const isHashedAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"));

  if (isHashedAsset) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  }
});
