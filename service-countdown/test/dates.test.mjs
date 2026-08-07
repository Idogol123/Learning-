/*
 * Tests for the date math in ../index.html.
 *
 * Run:  TZ=Asia/Jerusalem node service-countdown/test/dates.test.mjs
 *
 * The `dates` module lives inline inside index.html (this tool ships as a
 * single self-contained page). We extract its ACTUAL source text and evaluate
 * it in a sandbox, so the test can never silently drift from the code that
 * really runs in the browser.
 *
 * TZ is pinned to Asia/Jerusalem because several cases assert behaviour across
 * a DST boundary, which does not exist in UTC.
 */
process.env.TZ = 'Asia/Jerusalem';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const m = html.match(/const dates = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
if (!m) throw new Error('could not find the `dates` module in index.html');

const sandbox = { Math, Date, String, Number };
vm.createContext(sandbox);
vm.runInContext(`${m[0]}\nglobalThis.__dates = dates;`, sandbox);
const dates = sandbox.__dates;

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
}

// ---- parse / toISO round-trip ----
t('parse builds a LOCAL midnight date, not a UTC one', () => {
  const d = dates.parse('2026-03-15');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 0);
});

t('toISO round-trips parse', () => {
  assert.equal(dates.toISO(dates.parse('2026-03-15')), '2026-03-15');
  assert.equal(dates.toISO(dates.parse('2026-01-01')), '2026-01-01');
});

// ---- daysBetween ----
t('daysBetween counts whole days', () => {
  assert.equal(dates.daysBetween('2026-01-01', '2026-01-02'), 1);
  assert.equal(dates.daysBetween('2026-01-01', '2026-01-01'), 0);
  assert.equal(dates.daysBetween('2026-01-02', '2026-01-01'), -1);
});

t('daysBetween survives the spring DST jump (23-hour day)', () => {
  // Israel 2026: clocks go forward on Friday 27 March.
  // A naive floor(ms/86400000) returns 1 here. It must be 2.
  assert.equal(dates.daysBetween('2026-03-26', '2026-03-28'), 2);
});

t('daysBetween survives the autumn DST fallback (25-hour day)', () => {
  // Israel 2026: clocks go back on Sunday 25 October.
  assert.equal(dates.daysBetween('2026-10-24', '2026-10-26'), 2);
});

t('daysBetween spans a leap day', () => {
  assert.equal(dates.daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(dates.daysBetween('2025-02-28', '2025-03-01'), 1);
});

// ---- addMonths ----
t('addMonths clamps to the end of a shorter month', () => {
  // Naive JS gives 2025-05-01 here. It must clamp to 2025-04-30.
  assert.equal(dates.addMonths('2025-03-31', 1), '2025-04-30');
});

t('addMonths clamps onto a leap day and a non-leap February', () => {
  assert.equal(dates.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(dates.addMonths('2025-01-31', 1), '2025-02-28');
});

t('addMonths handles the 32-month male service term', () => {
  assert.equal(dates.addMonths('2025-03-15', 32), '2027-11-15');
});

t('addMonths handles the 24-month female service term', () => {
  assert.equal(dates.addMonths('2025-03-15', 24), '2027-03-15');
});

// ---- progressPct ----
t('progressPct clamps to 0 and 100', () => {
  assert.equal(dates.progressPct('2025-01-01', '2026-01-01', '2024-06-01'), 0);
  assert.equal(dates.progressPct('2025-01-01', '2026-01-01', '2027-01-01'), 100);
});

t('progressPct reports the midpoint', () => {
  assert.equal(dates.progressPct('2025-01-01', '2025-01-11', '2025-01-06'), 50);
});

t('progressPct returns 100 when the range is empty or inverted', () => {
  assert.equal(dates.progressPct('2026-01-01', '2026-01-01', '2026-01-01'), 100);
  assert.equal(dates.progressPct('2026-06-01', '2026-01-01', '2026-03-01'), 100);
});

// ---- Hebrew phrasing ----
t('hebrewDays uses the dual form for two', () => {
  assert.equal(dates.hebrewDays(0), 'היום');
  assert.equal(dates.hebrewDays(1), 'יום אחד');
  assert.equal(dates.hebrewDays(2), 'יומיים');
  assert.equal(dates.hebrewDays(3), '3 ימים');
});

t('remainingLabel conjugates the verb and handles the past', () => {
  assert.equal(dates.remainingLabel(1), 'נשאר יום אחד');
  assert.equal(dates.remainingLabel(2), 'נשארו יומיים');
  assert.equal(dates.remainingLabel(3), 'נשארו 3 ימים');
  assert.equal(dates.remainingLabel(0), 'היום!');
  assert.equal(dates.remainingLabel(-2), 'עברו יומיים');
});

// ---- formatHe ----
t('formatHe renders a Hebrew long date', () => {
  assert.equal(dates.formatHe('2027-11-14'), '14 בנובמבר 2027');
  assert.equal(dates.formatHe('2026-08-07'), '7 באוגוסט 2026');
});

console.log(`${passed} passed`);
