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

const sandbox = { Math, Date, String, Number, JSON, Error, Array, Uint8Array,
                  TextEncoder, TextDecoder, btoa, atob, localStorage: makeLS() };
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

// ---- units ----
t('monthsBetween counts whole calendar months', () => {
  assert.equal(dates.monthsBetween('2025-03-15', '2027-11-15'), 32);
  assert.equal(dates.monthsBetween('2025-03-15', '2025-04-14'), 0);
  assert.equal(dates.monthsBetween('2025-03-15', '2025-04-15'), 1);
  assert.equal(dates.monthsBetween('2027-11-15', '2025-03-15'), -32);
});

t('monthsBetween handles an end-of-month start', () => {
  assert.equal(dates.monthsBetween('2025-01-31', '2025-02-28'), 0);
  assert.equal(dates.monthsBetween('2025-01-31', '2025-03-31'), 2);
});

t('unitValue converts the same span into each unit', () => {
  assert.equal(dates.unitValue('days',   '2026-08-08', '2027-11-15'), 464);
  assert.equal(dates.unitValue('weeks',  '2026-08-08', '2027-11-15'), 66);
  assert.equal(dates.unitValue('months', '2026-08-08', '2027-11-15'), 15);
  assert.equal(dates.unitValue('days',   '2027-11-15', '2026-08-08'), 464);
});

t('unitName uses Hebrew singular, dual and plural', () => {
  assert.equal(dates.unitName('days', 1), 'יום');
  assert.equal(dates.unitName('days', 2), 'יומיים');
  assert.equal(dates.unitName('days', 5), 'ימים');
  assert.equal(dates.unitName('weeks', 1), 'שבוע');
  assert.equal(dates.unitName('weeks', 2), 'שבועיים');
  assert.equal(dates.unitName('weeks', 5), 'שבועות');
  assert.equal(dates.unitName('months', 1), 'חודש');
  assert.equal(dates.unitName('months', 2), 'חודשיים');
  assert.equal(dates.unitName('months', 5), 'חודשים');
});

t('remainderLabel spells out what the unit rounds away', () => {
  assert.equal(dates.remainderLabel('months', '2026-08-08', '2027-11-15'), 'ו-7 ימים');
  assert.equal(dates.remainderLabel('weeks',  '2026-08-08', '2027-11-15'), 'ויומיים');
  assert.equal(dates.remainderLabel('days',   '2026-08-08', '2027-11-15'), '');
  assert.equal(dates.remainderLabel('months', '2026-08-08', '2026-09-08'), '');
});

// ---- enlistment waves ----
t('enlistWaves lists recent March/August/November intakes, newest first', () => {
  const w = dates.enlistWaves('2026-08-08', 4);
  assert.deepEqual([...w], ['2026-08-01', '2026-03-01', '2025-11-01', '2025-08-01']);
});

t('enlistWaves never returns a future intake', () => {
  const w = dates.enlistWaves('2026-07-31', 2);
  assert.deepEqual([...w], ['2026-03-01', '2025-11-01']);
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

// ---- timeline axis ----
t('axisGap is proportional to elapsed time', () => {
  // Half the span => half the pixels. (2026-01-01 + 200 days = 2026-07-20;
  // + 400 days = 2027-02-05.)
  assert.equal(dates.axisGap('2026-01-01', '2026-07-20', 400, 400, 14), 200);
  assert.equal(dates.axisGap('2026-01-01', '2027-02-05', 400, 400, 14), 400);
});

t('axisGap floors at the readable minimum and never goes negative', () => {
  assert.equal(dates.axisGap('2026-01-01', '2026-01-02', 400, 400, 14), 14);
  assert.equal(dates.axisGap('2026-01-01', '2026-01-01', 400, 400, 14), 14);
  assert.equal(dates.axisGap('2026-07-01', '2026-01-01', 400, 400, 14), 14);
});

t('axisGap tolerates a zero-length span', () => {
  assert.equal(dates.axisGap('2026-01-01', '2026-01-01', 0, 400, 14), 14);
});

// ---- weekday counting ----
t('countWeekday counts inclusive occurrences of one weekday', () => {
  // 2026-01-03 is a Saturday.
  assert.equal(dates.countWeekday('2026-01-03', '2026-01-03', 6), 1);
  assert.equal(dates.countWeekday('2026-01-04', '2026-01-09', 6), 0);
  assert.equal(dates.countWeekday('2026-01-04', '2026-01-10', 6), 1);
  assert.equal(dates.countWeekday('2026-01-04', '2026-01-17', 6), 2);
});

t('countWeekday returns zero for an inverted range', () => {
  assert.equal(dates.countWeekday('2026-02-01', '2026-01-01', 6), 0);
});

// ---- live countdown ----
t('msUntilDate measures to local midnight of the target day', () => {
  assert.equal(dates.msUntilDate('2026-08-09', new Date(2026, 7, 8, 23, 0, 0, 0)), 3600 * 1000);
  assert.equal(dates.msUntilDate('2026-08-08', new Date(2026, 7, 8, 0, 0, 0, 0)), 0);
  assert.equal(dates.msUntilDate('2026-08-07', new Date(2026, 7, 8, 0, 0, 0, 0)), -86400000);
});

t('splitDuration breaks milliseconds into d/h/m/s', () => {
  assert.deepEqual({ ...dates.splitDuration(0) },
    { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual({ ...dates.splitDuration(90061000) },
    { days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual({ ...dates.splitDuration(-5000) },
    { days: 0, hours: 0, minutes: 0, seconds: 5 });
});

// ---- service moments ----
t('momentFor names the crossover, the halfway mark and the last 100 days', () => {
  const enlist = '2025-03-15', release = '2027-11-15';   // 975 days
  assert.equal(dates.momentFor(enlist, release, '2025-03-16'), null);
  assert.equal(dates.momentFor(enlist, release, '2026-09-01').key, 'half');
  assert.equal(dates.momentFor(enlist, release, '2027-09-01').key, 'last100');
});

t('momentFor prefers the nearest milestone and stops after release', () => {
  const enlist = '2025-03-15', release = '2027-11-15';
  assert.equal(dates.momentFor(enlist, release, '2027-11-16'), null);
  assert.ok(dates.momentFor(enlist, release, '2026-09-01').text.includes('פחות'));
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

// ---- serviceSummary: the numbers the stats panel is allowed to show ----
t('serviceSummary needs a profile', () => {
  assert.equal(store.serviceSummary(store.blank(), '2026-08-09'), null);
});

t('serviceSummary counts up to today while the service is running', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-02', releaseDate: '2027-11-02', gender: 'm' };
  const sum = store.serviceSummary(s, '2026-08-09');
  assert.equal(sum.released, false);
  assert.equal(sum.servedDays, dates.daysBetween('2025-03-02', '2026-08-09'));
  assert.equal(sum.leftDays, dates.daysBetween('2026-08-09', '2027-11-02'));
  assert.equal(sum.sinceRelease, 0);
});

t('serviceSummary stops counting service at the release date', () => {
  // The bug this pins: the hero said "you finished 976 days of service"
  // while the stats panel said 1256 days in service, about the same fact,
  // on the same screen. Service accounting ends at the discharge.
  const s = store.blank();
  s.profile = { enlistDate: '2023-03-02', releaseDate: '2025-11-02', gender: 'm' };
  const sum = store.serviceSummary(s, '2026-08-09');
  assert.equal(sum.released, true);
  assert.equal(sum.servedDays, 976);
  assert.equal(sum.servedDays, dates.daysBetween('2023-03-02', '2025-11-02'));
  assert.equal(sum.servedMonths, 32);
  assert.equal(sum.leftDays, 0);
});

t('serviceSummary keeps the days SINCE release as the number that grows', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2023-03-02', releaseDate: '2025-11-02', gender: 'm' };
  assert.equal(store.serviceSummary(s, '2026-08-09').sinceRelease, 280);
  assert.equal(store.serviceSummary(s, '2026-08-10').sinceRelease, 281);
  // ...while the served total does not move with it.
  assert.equal(store.serviceSummary(s, '2026-08-10').servedDays, 976);
});

t('serviceSummary does not call the release day itself "released"', () => {
  // The hero reads "היום!" on the release day, not "משוחרר"; the panel
  // has to agree with it rather than close the service a day early.
  const s = store.blank();
  s.profile = { enlistDate: '2023-03-02', releaseDate: '2025-11-02', gender: 'm' };
  const sum = store.serviceSummary(s, '2025-11-02');
  assert.equal(sum.released, false);
  assert.equal(sum.servedDays, 976);
  assert.equal(sum.leftDays, 0);
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

t('validateEvent demands a title and a date', () => {
  const s = store.blank();
  assert.equal(store.validateEvent(s, { title: '', date: '2026-01-01' }), 'צריך שם ותאריך');
  assert.equal(store.validateEvent(s, { title: 'א', date: '' }), 'צריך שם ותאריך');
});

t('validateEvent rejects a date before enlistment', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-15', releaseDate: '2027-11-15', gender: 'm' };
  assert.equal(store.validateEvent(s, { title: 'א', date: '1999-01-01' }),
    'התאריך מוקדם מתאריך הגיוס');
  assert.equal(store.validateEvent(s, { title: 'א', date: '2026-01-01' }), '');
});

t('validateEvent rejects a duplicate title on the same date', () => {
  const s = store.blank();
  s.events = [{ id: 'a', title: 'מסע כומתה', date: '2026-09-01', icon: 'star', source: 'template' }];
  assert.equal(store.validateEvent(s, { title: 'מסע כומתה', date: '2026-09-01' }),
    'האירוע הזה כבר קיים');
  // Editing the row itself is not a duplicate of itself.
  assert.equal(store.validateEvent(s, { id: 'a', title: 'מסע כומתה', date: '2026-09-01' }), '');
});

t('validateEvent accepts anything sane without a profile', () => {
  const s = store.blank();
  assert.equal(store.validateEvent(s, { title: 'א', date: '2030-01-01' }), '');
});

t('encodeState round-trips through decodeState, Hebrew included', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-15', releaseDate: '2027-11-15', gender: 'm', months: 32 };
  s.events = [{ id: 'a', title: 'מסע כומתה', date: '2026-09-01', icon: 'star',
                source: 'template', every: null }];
  const code = store.encodeState(s);
  assert.ok(!/[+/=]/.test(code), 'must be URL-safe with no padding');
  const back = store.decodeState(code);
  assert.deepEqual(back.profile, s.profile);
  assert.equal(back.events[0].title, 'מסע כומתה');
});

t('decodeState rejects junk instead of wiping the device', () => {
  assert.throws(() => store.decodeState('not-a-real-code'));
  assert.throws(() => store.decodeState(''));
});

// ---- repeating events ----
t('nextOccurrence rolls forward to the next cycle', () => {
  assert.equal(dates.nextOccurrence('2026-08-01', 21, '2026-08-08'), '2026-08-22');
  assert.equal(dates.nextOccurrence('2026-08-01', 21, '2026-08-22'), '2026-08-22');
  assert.equal(dates.nextOccurrence('2026-08-01', 21, '2026-08-23'), '2026-09-12');
});

t('nextOccurrence leaves a future start alone', () => {
  assert.equal(dates.nextOccurrence('2026-12-01', 21, '2026-08-08'), '2026-12-01');
});

t('nextOccurrence ignores a nonsense cycle', () => {
  assert.equal(dates.nextOccurrence('2026-08-01', 0, '2026-08-08'), '2026-08-01');
  assert.equal(dates.nextOccurrence('2026-08-01', -7, '2026-08-08'), '2026-08-01');
});

t('allEvents rolls a repeating event to its next occurrence', () => {
  const s = store.blank();
  s.events = [{ id: 'r', title: 'רגילה', date: '2026-08-01', every: 21,
                icon: 'home', source: 'template' }];
  const row = store.allEvents(s, '2026-08-08').find(e => e.id === 'r');
  assert.equal(row.date, '2026-08-22');
  assert.equal(row.baseDate, '2026-08-01');
  // The stored row is untouched: rolling is a view, not a mutation.
  assert.equal(s.events[0].date, '2026-08-01');
});

t('groupedEvents puts the nearest upcoming event first', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-02', releaseDate: '2027-11-02' };
  s.events = [
    { id: 'a', title: 'סוף טירונות', date: '2025-06-10', icon: 'shield' },
    { id: 'b', title: 'קורס',        date: '2026-09-15', icon: 'flag' },
    { id: 'c', title: 'רגילה',       date: '2026-08-14', icon: 'home' },
  ];
  const { upcoming, past } = store.groupedEvents(s, '2026-08-09');
  // Spread into the host realm before comparing: an array built inside the vm
  // sandbox carries the sandbox's Array.prototype, and assert.deepEqual then
  // fails with "same structure but not reference-equal" even when it is right.
  assert.deepEqual([...upcoming.map(e => e.id)], ['c', 'b', 'release']);
  assert.deepEqual([...past.map(e => e.id)], ['a']);
});

t('groupedEvents lists the most recent past event first', () => {
  const s = store.blank();
  s.events = [
    { id: 'a', title: 'ישן',  date: '2025-06-10', icon: 'flag' },
    { id: 'b', title: 'חדש',  date: '2026-01-01', icon: 'flag' },
  ];
  const { upcoming, past } = store.groupedEvents(s, '2026-08-09');
  assert.equal(upcoming.length, 0);
  assert.deepEqual([...past.map(e => e.id)], ['b', 'a']);
});

t('groupedEvents counts today as upcoming', () => {
  const s = store.blank();
  s.events = [{ id: 'a', title: 'היום', date: '2026-08-09', icon: 'flag' }];
  const { upcoming, past } = store.groupedEvents(s, '2026-08-09');
  assert.deepEqual([...upcoming.map(e => e.id)], ['a']);
  assert.equal(past.length, 0);
});

t('occurrencesUntil counts the cycles left in a range', () => {
  // 22/08, 12/09, 03/10, 24/10 -- the next one (14/11) is past the end.
  assert.equal(dates.occurrencesUntil('2026-08-01', 21, '2026-08-09', '2026-11-02'), 4);
});

t('occurrencesUntil counts an occurrence that lands on the last day', () => {
  assert.equal(dates.occurrencesUntil('2026-08-01', 21, '2026-08-09', '2026-08-22'), 1);
});

t('occurrencesUntil returns zero when nothing fits', () => {
  assert.equal(dates.occurrencesUntil('2026-08-01', 21, '2026-08-09', '2026-08-21'), 0);
  assert.equal(dates.occurrencesUntil('2026-08-01', 0,  '2026-08-09', '2026-11-02'), 0);
  assert.equal(dates.occurrencesUntil('2026-08-01', 21, '2026-11-02', '2026-08-09'), 0);
});

t('postponeRelease moves the date and records the move', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-02', releaseDate: '2027-11-02' };
  assert.equal(store.postponeRelease(s, '2027-12-02'), true);
  assert.equal(s.profile.releaseDate, '2027-12-02');
  assert.equal(s.profile.history.length, 1);
  assert.equal(s.profile.history[0].from, '2027-11-02');
  assert.equal(s.profile.history[0].to, '2027-12-02');
});

t('postponeRelease refuses a no-op or a missing profile', () => {
  const s = store.blank();
  assert.equal(store.postponeRelease(s, '2027-12-02'), false);
  s.profile = { enlistDate: '2025-03-02', releaseDate: '2027-11-02' };
  assert.equal(store.postponeRelease(s, '2027-11-02'), false);
  assert.equal(store.postponeRelease(s, ''), false);
});

t('postponedDays sums every move, including one that pulled the date in', () => {
  const s = store.blank();
  s.profile = { enlistDate: '2025-03-02', releaseDate: '2027-11-02' };
  store.postponeRelease(s, '2027-12-02');   // +30
  store.postponeRelease(s, '2027-11-22');   // -10
  assert.equal(store.postponedDays(s), 20);
  assert.equal(store.postponedDays(store.blank()), 0);
});

console.log(`${passed} passed`);
