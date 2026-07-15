/* Service worker for the admin control panel (this directory only).
   Caches just the shell so it opens offline. The encrypted payload lives
   inside index.html, so offline access still requires the password. */
const CACHE = 'admin-v1';
const BASE = new URL('./', self.location).pathname;
const SHELL = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  // Scope guard: only handle files in the admin directory itself.
  if (!url.pathname.startsWith(BASE)) return;
  const deeper = url.pathname.slice(BASE.length);
  if (deeper.includes('/')) return;

  // The document is network-first so a freshly deployed panel wins; offline
  // falls back to the cached shell.
  const isDoc = e.request.mode === 'navigate' || deeper === '' || deeper === 'index.html';
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return res; })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
