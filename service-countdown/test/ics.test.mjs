/*
 * Tests for the calendar export in ../index.html.
 * Run:  node service-countdown/test/ics.test.mjs
 *
 * Same extraction pattern as dates.test.mjs: the `ics` module lives inline in
 * the single-file tool, so the test evaluates its real source in a sandbox.
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
const mIcs = html.match(/const ics = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
if (!mIcs) throw new Error('could not find the `ics` module in index.html');

const sandbox = { Math, Date, String, Number, JSON, Error };
vm.createContext(sandbox);
vm.runInContext(`${mDates[0]}\n${mIcs[0]}\nglobalThis.__ics = ics;`, sandbox);
const ics = sandbox.__ics;

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
}

t('build emits a complete VCALENDAR', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-15' }], 1);
  assert.ok(out.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(out.endsWith('END:VCALENDAR\r\n'));
  assert.ok(out.includes('VERSION:2.0'));
});

t('build writes an all-day event with an exclusive end date', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-15' }], 1);
  assert.ok(out.includes('DTSTART;VALUE=DATE:20271115'));
  // iCalendar DTEND for an all-day event is exclusive: the day after.
  assert.ok(out.includes('DTEND;VALUE=DATE:20271116'));
  assert.ok(out.includes('SUMMARY:שחרור'));
});

t('build attaches a VALARM at the requested lead time', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-15' }], 1);
  assert.ok(out.includes('BEGIN:VALARM'));
  assert.ok(out.includes('TRIGGER;RELATED=START:-P1D'));
  assert.ok(out.includes('ACTION:DISPLAY'));
  assert.ok(out.includes('END:VALARM'));
  assert.ok(ics.build([{ title: 'x', date: '2027-11-15' }], 7).includes('-P7D'));
});

t('build omits the alarm when the lead time is zero', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-15' }], 0);
  assert.ok(!out.includes('BEGIN:VALARM'));
});

t('build escapes characters that would break the format', () => {
  const out = ics.build([{ title: 'רגילה, סוף; קורס\\מסלול', date: '2026-01-01' }], 1);
  assert.ok(out.includes('SUMMARY:רגילה\\, סוף\\; קורס\\\\מסלול'));
});

t('build emits one VEVENT per row, each with its own UID', () => {
  const out = ics.build([
    { title: 'א', date: '2026-01-01' },
    { title: 'ב', date: '2026-02-01' },
  ], 1);
  assert.equal(out.split('BEGIN:VEVENT').length - 1, 2);
  const uids = out.match(/UID:[^\r]+/g);
  assert.equal(uids.length, 2);
  assert.notEqual(uids[0], uids[1]);
});

t('build returns an empty calendar for no events', () => {
  const out = ics.build([], 1);
  assert.ok(!out.includes('BEGIN:VEVENT'));
  assert.ok(out.includes('END:VCALENDAR'));
});

t('build writes an RRULE for a repeating event', () => {
  const out = ics.build([{ title: 'רגילה', date: '2026-08-01', every: 21 }], 1);
  assert.ok(out.includes('RRULE:FREQ=DAILY;INTERVAL=21'), out);
});

t('build bounds the recurrence when an end date is given', () => {
  const out = ics.build([{ title: 'רגילה', date: '2026-08-01', every: 21 }], 1, '2027-11-02');
  assert.ok(out.includes('RRULE:FREQ=DAILY;INTERVAL=21;UNTIL=20271102'), out);
});

t('build still bounds the recurrence when no end date is given', () => {
  // Without a profile the caller has no release date to pass, and an
  // unbounded FREQ=DAILY is an infinite series in the user's real calendar.
  // The fallback is five years from the event -- longer than any conscript
  // service, short enough not to choke a calendar.
  const out = ics.build([{ title: 'רגילה', date: '2026-08-01', every: 21 }], 1);
  assert.ok(out.includes('RRULE:FREQ=DAILY;INTERVAL=21;UNTIL=20310731'), out);
});

t('an explicit end date still wins over the fallback bound', () => {
  const out = ics.build([{ title: 'רגילה', date: '2026-08-01', every: 21 }], 1, '2027-11-02');
  assert.ok(out.includes('UNTIL=20271102'), out);
  assert.ok(!out.includes('UNTIL=20310731'), out);
});

t('build writes no RRULE for a one-off event', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-02' }], 1);
  assert.ok(!out.includes('RRULE'), out);
});

t('build names the calendar', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-02' }], 1);
  assert.ok(out.includes('X-WR-CALNAME:הספירה'), out);
});

t('countdownRows emits one row per day, counting down', () => {
  const rows = ics.countdownRows('שחרור', '2026-08-14', '2026-08-09', 3);
  assert.equal(rows.length, 3);
  // Spread into the host realm first -- a sandbox array fails deepEqual against
  // a host literal even when the contents match.
  assert.deepEqual([...rows.map(r => r.date)], ['2026-08-09', '2026-08-10', '2026-08-11']);
  assert.equal(rows[0].title, 'שחרור · נשארו 5 ימים');
  assert.equal(rows[2].title, 'שחרור · נשארו 3 ימים');
});

t('countdownRows stops on the target day itself', () => {
  const rows = ics.countdownRows('שחרור', '2026-08-11', '2026-08-09', 30);
  assert.equal(rows.length, 3);
  assert.equal(rows[2].title, 'שחרור · היום!');
});

t('countdownRows returns nothing for a target already passed', () => {
  const rows = ics.countdownRows('שחרור', '2026-08-01', '2026-08-09', 30);
  assert.equal(rows.length, 0);
});

console.log(`${passed} passed`);
