/*
 * Routing tests for the landing hub service worker (../sw.js).
 *
 * Run:  node landing/test/sw-routing.test.mjs
 *
 * Loads the REAL sw.js in a mocked ServiceWorkerGlobalScope, captures its
 * `fetch` handler, and fires synthetic requests to assert the scope guard:
 * the hub worker handles its own shell but must NEVER intercept a sub-tool
 * path (guard-duty-scheduler/…, file-search/…) or a cross-origin request.
 * Verified for both a GitHub Pages base ("/Learning-/") and a local base ("/").
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const swSrc = readFileSync(join(here, '..', 'sw.js'), 'utf8');

const ORIGIN = 'https://idogol123.github.io';

// A minimal caches stub: enough for the handler to run without touching disk.
function makeCaches() {
  return {
    open: async () => ({ addAll: async () => {}, put: async () => {}, match: async () => undefined }),
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined,
  };
}

// Load sw.js against a mocked global scope rooted at `base`, return its fetch handler.
function loadWorker(base) {
  const handlers = {};
  const href = `${ORIGIN}${base}sw.js`;
  const sandbox = {
    self: {
      // WorkerLocation stringifies to its href (needed by `new URL('./', self.location)`).
      location: { origin: ORIGIN, href, toString: () => href },
      registration: { scope: `${ORIGIN}${base}` },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
    caches: makeCaches(),
    fetch: async () => ({ status: 200, type: 'basic', clone: () => ({}) }),
    URL,
    Promise,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(swSrc, sandbox);
  return handlers.fetch;
}

// Fire one request at the handler; report whether the worker claimed it.
function route(fetchHandler, { path, mode = 'no-cors', method = 'GET', origin = ORIGIN }) {
  let claimed = false;
  const event = {
    request: { method, url: `${origin}${path}`, mode, destination: mode === 'navigate' ? 'document' : '' },
    respondWith: () => { claimed = true; },
  };
  fetchHandler(event);
  return claimed;
}

let passed = 0;
function check(desc, fn) { fn(); passed++; console.log('  ok -', desc); }

for (const base of ['/Learning-/', '/']) {
  console.log(`landing sw.js scope guard (base ${base})`);
  const fetchHandler = loadWorker(base);

  check('handles the hub root navigation', () => {
    assert.equal(route(fetchHandler, { path: base, mode: 'navigate' }), true);
  });
  check('handles the hub index.html', () => {
    assert.equal(route(fetchHandler, { path: `${base}index.html`, mode: 'navigate' }), true);
  });
  check('handles a hub shell asset (icon)', () => {
    assert.equal(route(fetchHandler, { path: `${base}icon-192.png` }), true);
  });
  check('does NOT hijack a guard-duty sub-tool navigation', () => {
    assert.equal(route(fetchHandler, { path: `${base}guard-duty-scheduler/`, mode: 'navigate' }), false);
  });
  check('does NOT hijack a guard-duty sub-tool asset', () => {
    assert.equal(route(fetchHandler, { path: `${base}guard-duty-scheduler/index.html`, mode: 'navigate' }), false);
  });
  check('does NOT hijack a file-search sub-tool', () => {
    assert.equal(route(fetchHandler, { path: `${base}file-search/index.html`, mode: 'navigate' }), false);
  });
  check('ignores cross-origin requests (e.g. a CDN)', () => {
    assert.equal(route(fetchHandler, { path: '/tesseract.js', origin: 'https://cdn.example.com' }), false);
  });
  check('ignores non-GET requests', () => {
    assert.equal(route(fetchHandler, { path: base, method: 'POST', mode: 'navigate' }), false);
  });
}

console.log(`\nAll ${passed} checks passed.`);
