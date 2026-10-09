/* Offline support for the installed phone app (dist/site, dist/site-locked).
 * Same-origin files are network-first so each morning's new data shows on the first open, but the network
 * gets at most 3 s: offline or on a slow connection the cached copy is used (and refreshed in the background).
 * GitHub Pages' ETags make the check cheap when nothing changed. Fonts are cache-first. */
const CACHE = "tenbagger-2026-10-08-2245104";
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
      const fresh = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      const hit = await c.match(req, { ignoreSearch: true });
      if (!hit) return (await fresh) || (req.mode === "navigate" && (await c.match("./"))) || Response.error();
      const res = await Promise.race([fresh, new Promise((r) => setTimeout(r, 3000, null))]);
      if (res && res.ok) return res;
      e.waitUntil(fresh); // slow or offline: cached copy now, the fresh one is saved for next time
      return hit;
    }));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
  }
});
