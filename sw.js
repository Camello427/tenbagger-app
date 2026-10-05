/* Offline support for the installed phone app (dist/site). The app page is fetched fresh when online, so new
 * market data shows up on the next launch, and served from cache when offline or when the network is too slow. */
const CACHE = "tenbagger-2026-10-02-2108252";
const SHELL = ["./", "app.bin", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Network first with a 4 s cap, then the cached copy.
    const cached = () => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match("./"));
    e.respondWith(new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { cached().then((m) => { if (m && !done) { done = true; resolve(m); } }); }, 4000);
      fetch(req).then((res) => { put(req, res); if (!done) { done = true; clearTimeout(timer); resolve(res); } })
        .catch(() => cached().then((m) => { if (!done) { done = true; clearTimeout(timer); resolve(m || Response.error()); } }));
    }));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // Fonts never change: cache first.
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((res) => put(req, res))));
  }
});
