/* Service worker for the tools hub (landing page only).
   Caches just the hub's own shell so it opens offline. Requests for the
   individual tools are left untouched — each tool has its own service
   worker and cache under its own path. */
const CACHE = 'tools-hub-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Scope guard: only serve the hub's own directory. Anything deeper
  // (a tool sub-path) is left to the network / that tool's own worker.
  const base = self.registration.scope.replace(self.location.origin, '');
  const rel = url.pathname;
  const deeperPath = rel.slice(base.length);
  if (deeperPath.includes('/')) return; // e.g. "guard-duty-scheduler/…"

  // The HTML document (a navigation, or the hub's index) is served
  // network-first so returning visitors always get the freshly deployed page
  // (and its up-to-date "last updated" stamp). Offline, we fall back to the
  // cached copy. Static assets (icons/manifest) stay cache-first for speed.
  const isDoc = e.request.mode === 'navigate' ||
    deeperPath === '' || deeperPath === 'index.html';
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for the shell assets, then fall back to a cached copy of the hub.
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).catch(() => caches.match('./index.html'))
    )
  );
});
