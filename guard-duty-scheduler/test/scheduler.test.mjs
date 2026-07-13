/*
 * Tests for the guard-duty scheduling math in ../index.html.
 *
 * Run:  node guard-duty-scheduler/test/scheduler.test.mjs
 *
 * The scheduling functions live inline inside index.html (this tool ships as a
 * single self-contained page). To keep the test honest we extract the ACTUAL
 * source text of `gcd`, `MAX_SHIFT_MIN` and `computeRounds` from index.html and
 * evaluate it in a sandbox -- so the test can never silently drift from the
 * code that really runs in the browser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

function extract(re, name) {
  const m = html.match(re);
  if (!m) throw new Error(`could not find ${name} in index.html`);
  return m[0];
}

// Pull the exact definitions out of the page.
const gcdSrc = extract(/function gcd\(a,b\)\{.*return a\|\|1; \}/, 'gcd');
const maxSrc = extract(/const MAX_SHIFT_MIN\s*=\s*\d+\s*;/, 'MAX_SHIFT_MIN');
const roundsSrc = extract(/function computeRounds\([\s\S]*?\n\}/, 'computeRounds');

const sandbox = { Math };
vm.createContext(sandbox);
// function declarations attach to the context; `const` (MAX_SHIFT_MIN) does not,
// so read its literal value straight from the extracted source.
vm.runInContext(`${gcdSrc}\n${maxSrc}\n${roundsSrc}`, sandbox);
const { gcd, computeRounds } = sandbox;
const MAX_SHIFT_MIN = Number(maxSrc.match(/\d+/)[0]);

let passed = 0;
function check(desc, fn) { fn(); passed++; console.log('  ok -', desc); }

// Mirror how generate() turns a window + R into concrete slots and hands them
// out. Slot boundaries use Math.round (exactly like index.html); guards are
// dealt round-robin, which -- because R*P is a multiple of G -- gives every
// guard the same COUNT of slots.
function simulate(mins, G, P) {
  const base = G / gcd(P, G);
  const R = computeRounds(mins, G, P);
  const slots = [];
  for (let r = 0; r < R; r++) {
    const st = Math.round(r * mins / R);
    const en = Math.round((r + 1) * mins / R);
    slots.push(en - st);
  }
  const perGuard = new Array(G).fill(0);
  const counts = new Array(G).fill(0);
  let idx = 0;
  for (let r = 0; r < R; r++) {
    for (let p = 0; p < P; p++) {
      const g = (idx++) % G;
      perGuard[g] += slots[r];
      counts[g] += 1;
    }
  }
  return { base, R, maxShift: Math.max(...slots), perGuard, counts };
}

console.log('computeRounds / scheduling invariants');

// --- The required case: 12h window, 5 guards, 2 positions ------------------ #
check('12h, 5 guards, 2 positions -> every guard gets exactly equal minutes', () => {
  const { base, R, maxShift, perGuard, counts } = simulate(12 * 60, 5, 2);
  assert.equal(base, 5, 'base G/gcd(P,G) should be 5');
  assert.equal(R, 5, 'R should equal base (no split needed, 144<=240)');
  assert.equal(R % base, 0, 'R must be a whole multiple of base');
  assert.ok(maxShift <= MAX_SHIFT_MIN, `no shift may exceed ${MAX_SHIFT_MIN} (got ${maxShift})`);
  assert.equal(maxShift, 144, 'each shift should be 144 min');
  // exact equality: every guard the same number of minutes AND the same count
  assert.ok(perGuard.every(m => m === perGuard[0]), `minutes must be equal, got ${perGuard}`);
  assert.equal(perGuard[0], 288, 'each guard should get 288 min (2 x 144)');
  assert.ok(counts.every(c => c === counts[0]), `slot counts must be equal, got ${counts}`);
});

// --- Property scan: invariants hold across a wide range -------------------- #
check('R stays a whole multiple of base AND no shift > 240, across many inputs', () => {
  for (let G = 2; G <= 12; G++) {
    for (let P = 1; P <= 6 && P <= G; P++) {
      for (let m = 30; m <= 24 * 60; m += 5) {
        const { base, R, maxShift, counts } = simulate(m, G, P);
        assert.equal(R % base, 0, `R not multiple of base for mins=${m} G=${G} P=${P}`);
        assert.ok(maxShift <= MAX_SHIFT_MIN,
          `shift ${maxShift} > ${MAX_SHIFT_MIN} for mins=${m} G=${G} P=${P}`);
        assert.ok(counts.every(c => c === counts[0]),
          `unequal counts for mins=${m} G=${G} P=${P}: ${counts}`);
      }
    }
  }
});

console.log(`\nAll ${passed} checks passed.`);
