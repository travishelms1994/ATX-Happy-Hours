// Keeps the app opening with no signal: the page and icons come from the cache,
// and the happy hour list is fetched fresh when online, with the last copy as a fallback.
const CACHE = "hh-v1";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.endsWith("tile.openstreetmap.org")) return; // map tiles: straight to the network

  const sameOrigin = url.origin === self.location.origin;
  const isData = sameOrigin && url.pathname.endsWith("data.json");
  const isPage = e.request.mode === "navigate";

  if (isData || isPage) {
    // network first, so new deals and page updates show up right away
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(isPage ? "index.html" : e.request, copy));
        return res;
      }).catch(() => caches.match(isPage ? "index.html" : e.request))
    );
    return;
  }
  // everything else: cache first
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && (sameOrigin || url.hostname.includes("cdnjs") || url.hostname.includes("gstatic") || url.hostname.includes("googleapis"))) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  })));
});
