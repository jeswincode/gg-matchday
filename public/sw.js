/* GG's service worker caches only the public application shell.
   Authenticated API responses, membership data and private user media are network-only. */
const SHELL_CACHE = "gg-shell-v2";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/offline.html",
  "/gg-app-icon.svg",
  "/icons/gg-180.png",
  "/icons/gg-192.png",
  "/icons/gg-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith("gg-shell-") && key !== SHELL_CACHE)
        .map(key => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Do not cache private or authenticated traffic, even if a route is later
  // accidentally moved outside the current API URL prefixes.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname === "/sw.js" ||
    request.headers.has("authorization")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match("/");
        if (cached) return cached;
        const offline = await caches.match("/offline.html");
        if (offline) return offline;
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
