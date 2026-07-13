/* Service worker: caches the app shell so the tool opens offline (previously
   loaded results are also cached in localStorage, see index.html). Live price
   and news lookups still require network — this only makes the UI itself
   load without a connection. */
const CACHE = "eh-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle same-origin shell requests; let Alpha Vantage API calls pass through untouched.
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === "navigate" || req.destination === "document" ||
    url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match(req).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp && resp.status === 200 && resp.type === "basic") {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }))
  );
});
