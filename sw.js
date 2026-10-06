/* Offline support and instant launch for the installed phone app (dist/site, dist/site-locked).
 * Same-origin files are served from the cache straight away, and refreshed from the network in the background,
 * so the app opens instantly (even offline) and a new version shows up on the next launch. Fonts are cache-first. */
const CACHE = "tenbagger-2026-10-02-2234610";
const SHELL = ["./", "app.bin", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; } // instant; the refreshed copy is used next time
      return (await fresh) || (req.mode === "navigate" && (await c.match("./"))) || Response.error();
    }));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
  }
});
