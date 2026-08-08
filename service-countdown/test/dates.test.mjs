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

const mDates = html.match(/const dates = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
if (!mDates) throw new Error('could not find the `dates` module in index.html');
const mStore = html.match(/const store = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
if (!mStore) throw new Error('could not find the `store` module in index.html');

// A minimal localStorage stand-in so `store` can run outside a browser.
function makeLS() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

const sandbox = { Math, Date, String, Number, JSON, Error, localStorage: makeLS() };
vm.createContext(sandbox);
vm.runInContext(
  `${mDates[0]}\n${mStore[0]}\nglobalThis.__dates = dates; globalThis.__store = store;`,
  sandbox
);
const dates = sandbox.__dates;
const store = sandbox.__store;

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

// ---- addDays ----
t('addDays walks the calendar, not the clock', () => {
  assert.equal(dates.addDays('2026-01-01', 1), '2026-01-02');
  assert.equal(dates.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(dates.addDays('2024-02-28', 2), '2024-03-01');
});

t('addDays is unaffected by DST boundaries', () => {
  // Adding 86400000ms per day across these boundaries lands on 01:00 or on
  // 23:00 of the previous day, and would report the wrong calendar date.
  assert.equal(dates.addDays('2026-03-26', 2), '2026-03-28');   // spring forward
  assert.equal(dates.addDays('2026-10-24', 2), '2026-10-26');   // fall back
  assert.equal(dates.addDays('2026-10-26', -2), '2026-10-24');
});

t('addDays and daysBetween are inverses across DST', () => {
  const from = '2026-03-01';
  const to = dates.addDays(from, 100);
  assert.equal(dates.daysBetween(from, to), 100);
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

// ---- msUntilNextMidnight ----
t('msUntilNextMidnight measures to the next LOCAL midnight', () => {
  assert.equal(dates.msUntilNextMidnight(new Date(2026, 7, 8, 23, 59, 0, 0)), 60 * 1000);
  assert.equal(dates.msUntilNextMidnight(new Date(2026, 7, 8, 0, 0, 0, 0)), 24 * 60 * 60 * 1000);
});

t('msUntilNextMidnight is positive across a DST change', () => {
  // Israel 2026: clocks go back on 25 October. The night is 25 hours long, so
  // a hardcoded 86400000 would fire the daily re-render an hour early.
  const ms = dates.msUntilNextMidnight(new Date(2026, 9, 24, 23, 0, 0, 0));
  assert.ok(ms > 0, 'must be positive');
  assert.equal(ms, 60 * 60 * 1000);
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

// ---- store ----
t('blank state is valid and empty', () => {
  const s = store.blank();
  assert.equal(s.v, 1);
  assert.equal(s.profile, null);
  // Spread into a host array: values built inside the vm sandbox carry that
  // realm's Array.prototype, which deepEqual treats as a mismatch on its own.
  assert.deepEqual([...s.events], []);
  assert.equal(s.theme, 'dark');
});

t('save then load round-trips the state', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-15', releaseDate: '2027-11-15', gender: 'm' };
  assert.equal(store.save(s), true);
  assert.deepEqual(store.load().profile, s.profile);
});

t('load returns a blank state when storage is empty or corrupt', () => {
  sandbox.localStorage.removeItem(store.KEY);
  assert.equal(store.load().profile, null);
  sandbox.localStorage.setItem(store.KEY, 'not json{');
  assert.equal(store.load().profile, null);
});

t('allEvents injects release as a virtual event when a profile exists', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-15', releaseDate: '2027-11-15', gender: 'm' };
  const ids = store.allEvents(s).map(e => e.id);
  assert.ok(ids.includes('release'));
  assert.equal(store.allEvents(s).find(e => e.id === 'release').virtual, true);
});

t('allEvents omits release when there is no profile', () => {
  const s = store.blank();
  assert.deepEqual([...store.allEvents(s)], []);
});

t('allEvents sorts nearest-first by date', () => {
  const s = store.blank();
  s.events = [
    { id: 'b', title: 'שני', date: '2027-01-01', icon: 'flag', source: 'custom' },
    { id: 'a', title: 'ראשון', date: '2026-01-01', icon: 'flag', source: 'custom' },
  ];
  assert.deepEqual(store.allEvents(s).map(e => e.id), ['a', 'b']);
});

t('heroEvent falls back when heroId points at nothing', () => {
  const s = store.blank();
  s.heroId = 'release';                 // but there is no profile
  s.events = [{ id: 'a', title: 'ראשון', date: '2026-01-01', icon: 'flag', source: 'custom' }];
  assert.equal(store.heroEvent(s, '2026-08-08').id, 'a');

  const empty = store.blank();
  empty.heroId = 'ghost';
  assert.equal(store.heroEvent(empty), null);
});

t('heroEvent falls back to the NEXT UPCOMING event, not the earliest', () => {
  const s = store.blank();
  s.heroId = 'deleted';
  s.events = [
    { id: 'past',   title: 'סוף טירונות', date: '2025-06-10', icon: 'shield', source: 'template' },
    { id: 'soon',   title: 'מסע כומתה',   date: '2026-09-01', icon: 'star',   source: 'template' },
    { id: 'later',  title: 'קורס מפקדים', date: '2027-02-01', icon: 'graduation-cap', source: 'template' },
  ];
  assert.equal(store.heroEvent(s, '2026-08-08').id, 'soon');
});

t('heroEvent falls back to the most recent past event when nothing is upcoming', () => {
  const s = store.blank();
  s.heroId = 'deleted';
  s.events = [
    { id: 'old',    title: 'סוף טירונות', date: '2025-06-10', icon: 'shield', source: 'template' },
    { id: 'recent', title: 'מסע כומתה',   date: '2026-01-01', icon: 'star',   source: 'template' },
  ];
  assert.equal(store.heroEvent(s, '2026-08-08').id, 'recent');
});

t('heroEvent still honours an explicit heroId that exists', () => {
  const s = store.blank();
  s.heroId = 'past';
  s.events = [
    { id: 'past', title: 'סוף טירונות', date: '2025-06-10', icon: 'shield', source: 'template' },
    { id: 'soon', title: 'מסע כומתה',   date: '2026-09-01', icon: 'star',   source: 'template' },
  ];
  assert.equal(store.heroEvent(s, '2026-08-08').id, 'past');
});

t('importJSON rejects malformed and foreign payloads', () => {
  assert.throws(() => store.importJSON('not json{'));
  assert.throws(() => store.importJSON('{"v":999}'));
  assert.throws(() => store.importJSON('[]'));
});

t('exportJSON output survives importJSON', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-15', releaseDate: '2027-11-15', gender: 'f' };
  assert.deepEqual(store.importJSON(store.exportJSON(s)).profile, s.profile);
});

t('removeEvent returns the removed row and takes it out of the state', () => {
  const s = store.blank();
  s.events = [
    { id: 'a', title: 'א', date: '2026-01-01', icon: 'flag', source: 'custom' },
    { id: 'b', title: 'ב', date: '2026-02-01', icon: 'flag', source: 'custom' },
  ];
  const removed = store.removeEvent(s, 'a');
  assert.equal(removed.id, 'a');
  assert.deepEqual(store.allEvents(s).map(e => e.id), ['b']);
  assert.equal(store.removeEvent(s, 'nope'), null);
});

t('restoreEvent puts a removed row back exactly once', () => {
  const s = store.blank();
  s.events = [{ id: 'a', title: 'א', date: '2026-01-01', icon: 'flag', source: 'custom' }];
  const removed = store.removeEvent(s, 'a');
  assert.equal(store.restoreEvent(s, removed), true);
  assert.deepEqual(store.allEvents(s).map(e => e.id), ['a']);
  assert.equal(store.restoreEvent(s, removed), false);   // already back
  assert.equal(store.restoreEvent(s, null), false);
});

console.log(`${passed} passed`);
