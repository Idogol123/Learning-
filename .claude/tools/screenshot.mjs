// Headless screenshot + sanity check for the tool collection.
// Usage: node .claude/tools/screenshot.mjs <file.html|url> <out.png> [light|dark] [width]
// Prints:  scheme=... overflow=<true|false> console_errors=[...]
//
// Why this exists: Playwright is installed GLOBALLY here (not as a local
// node_module) and the Chromium build lives under /opt/pw-browsers with a
// version-stamped folder name. Resolving both by hand cost several tries in a
// past session, so this helper does it automatically. Reuse it, do not rebuild.

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const [, , target, out, scheme = 'light', width = '412'] = process.argv;
if (!target || !out) {
  console.error('Usage: node .claude/tools/screenshot.mjs <file.html|url> <out.png> [light|dark] [width]');
  process.exit(2);
}

// Resolve the globally-installed playwright package (CommonJS -> default export).
const gRoot = execSync('npm root -g').toString().trim();
const mod = await import(gRoot + '/playwright/index.js');
const { chromium } = mod.default || mod;

// Find the Chromium binary under /opt/pw-browsers/chromium-<version>/ (version varies).
let executablePath;
const base = '/opt/pw-browsers';
if (existsSync(base)) {
  for (const d of readdirSync(base)) {
    if (!d.startsWith('chromium-') || d.includes('headless_shell')) continue;
    const p = `${base}/${d}/chrome-linux/chrome`;
    if (existsSync(p)) executablePath = p;
  }
}

const url = target.startsWith('http') || target.startsWith('file://')
  ? target
  : 'file://' + (target.startsWith('/') ? target : process.cwd() + '/' + target);

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({
  colorScheme: scheme,
  viewport: { width: Number(width), height: 900 },
  deviceScaleFactor: 2,
});
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('dialog', d => d.accept());

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(400);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await page.screenshot({ path: out, fullPage: true });
console.log(`scheme=${scheme} overflow=${overflow} console_errors=${JSON.stringify(errs)}`);
await browser.close();
