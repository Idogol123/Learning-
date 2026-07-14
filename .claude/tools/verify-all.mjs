// Central quality gate for the browser-tools collection.
// Runs the SAME checks locally (in a dev loop) and in CI (.github/workflows/ci.yml),
// so nothing broken can reach production. Exits non-zero on the first failure batch.
//
// Usage:
//   node .claude/tools/verify-all.mjs              # structural + headless (light+dark)
//   node .claude/tools/verify-all.mjs --structural # structural only (no browser)
//
// What it guards (each maps to a documented project risk):
//   * Every tool dir is self-contained: index.html, manifest, sw.js, all icons.       (site integrity)
//   * Every manifest is valid JSON with the required PWA fields.                       (installability)
//   * Every tool registers its service worker.                                         (offline)
//   * Every tool has a matching card link on the landing page — the one remaining
//     manual coupling point when adding/removing a tool.                               (dead links)
//   * The deploy workflow auto-discovers tools (no hardcoded per-tool cp list to
//     drift out of sync).                                                              (deploy coupling)
//   * Headless: no console errors and no horizontal overflow, in light AND dark.       (broken UI)

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STRUCTURAL_ONLY = process.argv.includes('--structural');

const REQUIRED_FILES = [
  'index.html', 'manifest.webmanifest', 'sw.js',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
];
const REQUIRED_MANIFEST_FIELDS = ['name', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'icons'];

const failures = [];
const fail = (msg) => failures.push(msg);

// ---- Discover tools: any top-level dir that has an index.html + manifest ----
// `landing` is the hub (served at the site root); the rest are sub-path tools.
const dirs = readdirSync(ROOT).filter((d) => {
  if (d.startsWith('.')) return false;
  const p = path.join(ROOT, d);
  return statSync(p).isDirectory() &&
    existsSync(path.join(p, 'index.html')) &&
    existsSync(path.join(p, 'manifest.webmanifest'));
}).sort();

const tools = dirs.filter((d) => d !== 'landing');
if (!dirs.includes('landing')) fail('landing/ hub directory is missing');
if (tools.length === 0) fail('no tool directories discovered');

console.log(`Discovered: hub=landing, tools=[${tools.join(', ')}]`);

// ---- Structural checks ----
const landingHtml = existsSync(path.join(ROOT, 'landing/index.html'))
  ? readFileSync(path.join(ROOT, 'landing/index.html'), 'utf8') : '';

for (const dir of dirs) {
  const base = path.join(ROOT, dir);
  for (const f of REQUIRED_FILES) {
    if (!existsSync(path.join(base, f))) fail(`${dir}/: missing required file "${f}"`);
  }
  // Manifest validity.
  const mfPath = path.join(base, 'manifest.webmanifest');
  if (existsSync(mfPath)) {
    try {
      const mf = JSON.parse(readFileSync(mfPath, 'utf8'));
      for (const field of REQUIRED_MANIFEST_FIELDS) {
        if (!(field in mf)) fail(`${dir}/manifest.webmanifest: missing "${field}"`);
      }
      if (Array.isArray(mf.icons) && mf.icons.length < 3) {
        fail(`${dir}/manifest.webmanifest: expected >=3 icons`);
      }
    } catch (e) {
      fail(`${dir}/manifest.webmanifest: invalid JSON (${e.message})`);
    }
  }
  // Service worker is registered by the page.
  const html = existsSync(path.join(base, 'index.html'))
    ? readFileSync(path.join(base, 'index.html'), 'utf8') : '';
  if (!/serviceWorker\s*\.\s*register/.test(html)) {
    fail(`${dir}/index.html: does not register a service worker`);
  }
  // Every sub-tool must be linked from the landing hub (the manual coupling point).
  if (dir !== 'landing' && landingHtml && !landingHtml.includes(`href="./${dir}/"`)) {
    fail(`landing/index.html: no card links to tool "${dir}" (href="./${dir}/")`);
  }
}

// ---- Deploy workflow must auto-discover tools (no hardcoded per-tool cp) ----
const wfPath = path.join(ROOT, '.github/workflows/deploy-pages.yml');
if (!existsSync(wfPath)) {
  fail('.github/workflows/deploy-pages.yml is missing');
} else {
  const wf = readFileSync(wfPath, 'utf8');
  const hardcoded = tools.filter((t) => new RegExp(`cp\\s+-r\\s+${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(wf));
  if (hardcoded.length) {
    fail(`deploy-pages.yml still hardcodes per-tool copy for: ${hardcoded.join(', ')} — use auto-discovery instead`);
  }
}

// ---- Headless checks (skippable) ----
async function loadChromium() {
  try { const m = await import('playwright'); return (m.default || m).chromium; } catch {}
  const gRoot = execSync('npm root -g').toString().trim();
  const m = await import(gRoot + '/playwright/index.js');
  return (m.default || m).chromium;
}
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  for (const d of readdirSync(base)) {
    if (!d.startsWith('chromium-') || d.includes('headless_shell')) continue;
    const p = `${base}/${d}/chrome-linux/chrome`;
    if (existsSync(p)) return p;
  }
  return undefined;
}

if (!STRUCTURAL_ONLY && failures.length === 0) {
  const chromium = await loadChromium();
  const executablePath = findChromium();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const dir of dirs) {
      const fileUrl = 'file://' + path.join(ROOT, dir, 'index.html');
      for (const scheme of ['light', 'dark']) {
        const page = await browser.newPage({
          colorScheme: scheme,
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
        });
        const errs = [];
        page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
        page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
        page.on('dialog', (d) => d.accept());
        try {
          await page.goto(fileUrl, { waitUntil: 'load' });
          await page.waitForTimeout(400);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1);
          if (overflow) fail(`${dir} [${scheme}]: horizontal overflow`);
          if (errs.length) fail(`${dir} [${scheme}]: console errors -> ${JSON.stringify(errs)}`);
        } catch (e) {
          fail(`${dir} [${scheme}]: failed to load (${e.message})`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
} else if (STRUCTURAL_ONLY) {
  console.log('Skipping headless checks (--structural).');
}

// ---- Report ----
if (failures.length) {
  console.error(`\n❌ verify-all: ${failures.length} problem(s) found:`);
  for (const f of failures) console.error('  • ' + f);
  process.exit(1);
}
console.log(`\n✅ verify-all: all checks passed (${dirs.length} dirs: ${dirs.join(', ')}).`);
