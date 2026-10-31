/*
 * Tests for the pure `logic` and `vault` modules inside ../index.html.
 *
 * Run:  TZ=Asia/Jerusalem node tatzpiot/test/logic.test.mjs
 *
 * The tool ships as one self-contained page, so we extract the ACTUAL source
 * of both modules from index.html and evaluate it in a sandbox: the tests can
 * never drift from the code that runs in the browser.
 */
process.env.TZ = 'Asia/Jerusalem';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const grab = name => {
  const m = html.match(new RegExp(`const ${name} = \\(\\(\\) => \\{[\\s\\S]*?\\n\\}\\)\\(\\);`));
  if (!m) throw new Error(`could not find the \`${name}\` module in index.html`);
  return m[0];
};

const sandbox = { Math, Date, String, Number, JSON, Error, Array, Map, Set, Object, Uint8Array,
  TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto, Infinity };
vm.createContext(sandbox);
vm.runInContext(`${grab('logic')}\n${grab('vault')}\nglobalThis.__logic = logic; globalThis.__vault = vault;`, sandbox);
const L = sandbox.__logic;
const V = sandbox.__vault;

let passed = 0;
const queue = [];
const t = (name, fn) => queue.push([name, fn]);

const DAY = 864e5;
const NOW = new Date(2026, 9, 31, 12, 0).getTime();      // 31 Oct 2026, noon local
const at = (daysAgo, hour = 12) => { const d = new Date(NOW - daysAgo * DAY); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
let n = 0;
const ob = (traineeId, daysAgo, competencyId, valence, extra = {}) =>
  ({ id: 'o' + (++n), traineeId, at: at(daysAgo, extra.hour ?? 12), competencyId, valence, behavior: 'x', ...extra });
function state(over = {}) {
  const S = L.normalize({});
  S.trainees = [
    { id: 'a', nickname: 'אלפא', active: true },
    { id: 'b', nickname: 'בטא', active: true },
    { id: 'c', nickname: 'גמא', active: true },
    { id: 'z', nickname: 'יצא', active: false },
  ];
  return Object.assign(S, over);
}

/* ---------- normalize ---------- */
t('normalize fills defaults: 8 competencies, staleDays 5, bgLockSec 60', () => {
  const S = L.normalize({});
  assert.equal(S.settings.competencies.length, 8);
  assert.equal(S.settings.competencies[0].name, 'פיקוד ושליטה');
  assert.equal(S.settings.staleDays, 5);
  assert.equal(S.settings.bgLockSec, 60);
  assert.deepEqual([...S.observations], []);
});
t('normalize keeps bgLockSec 0 (lock immediately) instead of defaulting it', () => {
  assert.equal(L.normalize({ settings: { bgLockSec: 0 } }).settings.bgLockSec, 0);
});
t('normalize backfills new observation fields on old data', () => {
  const S = L.normalize({ observations: [{ id: 'x', traineeId: 'a', at: at(1), competencyId: 'c1', valence: 'plus', behavior: 'b' }] });
  assert.deepEqual([...S.observations[0].phenomenonIds], []);
  assert.deepEqual([...S.observations[0].conditions], []);
});

/* ---------- coverage ---------- */
t('coverage order: never-observed first, then oldest last-observation; inactive excluded', () => {
  const S = state({ observations: [ob('a', 1, 'c1', 'plus'), ob('b', 9, 'c1', 'plus'), ob('z', 30, 'c1', 'plus')] });
  const order = L.coverageOrder(S, NOW).map(x => x.t.id);
  assert.deepEqual(order, ['c', 'b', 'a']);
});
t('stale = never observed, or more than staleDays calendar days', () => {
  const S = state({ observations: [ob('a', 5, 'c1', 'plus'), ob('b', 6, 'c1', 'plus')] });
  assert.equal(L.stats(S, 'a', NOW).stale, false);   // exactly 5 days: not yet
  assert.equal(L.stats(S, 'b', NOW).stale, true);
  assert.equal(L.stats(S, 'c', NOW).stale, true);
  assert.equal(L.stats(S, 'c', NOW).daysSince, null);
});
t('daysSince is calendar days, not 24h blocks (23:00 yesterday = 1 day)', () => {
  const S = state({ observations: [ob('a', 1, 'c1', 'plus', { hour: 23 })] });
  assert.equal(L.stats(S, 'a', new Date(2026, 9, 31, 0, 30).getTime()).daysSince, 1);
});

/* ---------- trend ---------- */
t('trend: not enough data with <3 directional obs in either window', () => {
  const l = [ob('a', 2, 'c1', 'plus'), ob('a', 3, 'c1', 'plus'), ob('a', 4, 'c1', 'plus'),
             ob('a', 25, 'c1', 'minus'), ob('a', 26, 'c1', 'minus')];
  assert.equal(L.trend(l, NOW).dir, null);
});
t('trend: neutral observations do not count toward the minimum', () => {
  const l = [ob('a', 2, 'c1', 'plus'), ob('a', 3, 'c1', 'plus'), ob('a', 4, 'c1', 'neutral'),
             ob('a', 25, 'c1', 'minus'), ob('a', 26, 'c1', 'minus'), ob('a', 27, 'c1', 'minus')];
  assert.equal(L.trend(l, NOW).dir, null);
});
t('trend: up when ⊕ share rises by >=15 points', () => {
  const l = [ob('a', 2, 'c1', 'plus'), ob('a', 3, 'c1', 'plus'), ob('a', 4, 'c1', 'minus'),
             ob('a', 25, 'c1', 'minus'), ob('a', 26, 'c1', 'minus'), ob('a', 27, 'c1', 'plus')];
  const r = L.trend(l, NOW);
  assert.equal(r.dir, 'up');
  assert.deepEqual({ ...r.recent }, { p: 2, m: 1 });
  assert.deepEqual({ ...r.prev }, { p: 1, m: 2 });
});
t('trend: down and flat', () => {
  const down = [ob('a', 1, 'c1', 'minus'), ob('a', 2, 'c1', 'minus'), ob('a', 3, 'c1', 'minus'),
                ob('a', 22, 'c1', 'plus'), ob('a', 23, 'c1', 'plus'), ob('a', 24, 'c1', 'plus')];
  assert.equal(L.trend(down, NOW).dir, 'down');
  const flat = [ob('a', 1, 'c1', 'plus'), ob('a', 2, 'c1', 'minus'), ob('a', 3, 'c1', 'plus'),
                ob('a', 22, 'c1', 'plus'), ob('a', 23, 'c1', 'minus'), ob('a', 24, 'c1', 'plus')];
  assert.equal(L.trend(flat, NOW).dir, 'flat');
});
t('trend: observations older than 42 days are ignored', () => {
  const l = [ob('a', 1, 'c1', 'plus'), ob('a', 2, 'c1', 'plus'), ob('a', 3, 'c1', 'plus'),
             ob('a', 50, 'c1', 'minus'), ob('a', 51, 'c1', 'minus'), ob('a', 52, 'c1', 'minus')];
  assert.equal(L.trend(l, NOW).dir, null);
});

/* ---------- bias ---------- */
t('bias: 5+ observations all ⊕ → one-sided warning; 4 is not enough', () => {
  const four = state({ observations: [1, 2, 3, 4].map(d => ob('a', d, 'c' + d, 'plus')) });
  assert.equal(L.biasWarnings(four, 'a').filter(w => w.type === 'onesided').length, 0);
  const five = state({ observations: [1, 2, 3, 4, 5].map(d => ob('a', d, 'c' + d, 'plus')) });
  assert.equal(L.biasWarnings(five, 'a')[0].type, 'onesided');
  assert.match(L.biasWarnings(five, 'a')[0].text, /חד־צדדית/);
});
t('bias: a single ⊖ breaks the one-sided warning', () => {
  const S = state({ observations: [1, 2, 3, 4, 5].map(d => ob('a', d, 'c' + d, d === 5 ? 'minus' : 'plus')) });
  assert.equal(L.biasWarnings(S, 'a').length, 0);
});
t('bias: 4+ observations all in one competency → narrow-view warning', () => {
  const S = state({ observations: [1, 2, 3, 4].map(d => ob('a', d, 'c3', d % 2 ? 'plus' : 'minus')) });
  const w = L.biasWarnings(S, 'a');
  assert.equal(w.length, 1);
  assert.equal(w[0].type, 'single');
  assert.match(w[0].text, /ניווט והתמצאות/);
});

/* ---------- patterns ---------- */
t('pattern: 3 unlinked ⊖ in one competency within 14 days', () => {
  const S = state({ observations: [ob('a', 1, 'c4', 'minus'), ob('a', 5, 'c4', 'minus'), ob('a', 13, 'c4', 'minus'), ob('a', 20, 'c4', 'minus')] });
  const p = L.patternSuggestions(S, 'a', NOW);
  assert.equal(p.length, 1);
  assert.equal(p[0].kind, 'gap');
  assert.equal(p[0].obsIds.length, 3);
  assert.equal(p[0].existingId, null);
});
t('pattern: linked observations do not count', () => {
  const S = state({ observations: [ob('a', 1, 'c4', 'minus'), ob('a', 2, 'c4', 'minus'), ob('a', 3, 'c4', 'minus', { phenomenonIds: ['p'] })] });
  assert.equal(L.patternSuggestions(S, 'a', NOW).length, 0);
});
t('pattern: suggests linking to an existing open phenomenon instead of a duplicate', () => {
  const S = state({
    observations: [ob('a', 1, 'c4', 'minus'), ob('a', 2, 'c4', 'minus'), ob('a', 3, 'c4', 'minus')],
    phenomena: [{ id: 'p9', traineeId: 'a', competencyId: 'c4', kind: 'gap', status: 'working', statusLog: [] }],
  });
  assert.equal(L.patternSuggestions(S, 'a', NOW)[0].existingId, 'p9');
});
t('pattern: dismissed until a NEW matching observation arrives', () => {
  const obs = [ob('a', 1, 'c4', 'minus'), ob('a', 2, 'c4', 'minus'), ob('a', 3, 'c4', 'minus')];
  const S = state({ observations: obs, dismissedObs: obs.map(o => o.id) });
  assert.equal(L.patternSuggestions(S, 'a', NOW).length, 0);
  S.observations.push(ob('a', 0, 'c4', 'minus'));
  assert.equal(L.patternSuggestions(S, 'a', NOW).length, 1);
});

/* ---------- phenomenon progress ---------- */
t('progress: null until the phenomenon leaves "identified"', () => {
  const S = state();
  assert.equal(L.phenomenonProgress(S, { traineeId: 'a', competencyId: 'c7', statusLog: [{ status: 'identified', at: at(20) }] }), null);
});
t('progress: splits the competency\'s ⊕/⊖ at the moment it was discussed', () => {
  const S = state({ observations: [
    ob('a', 30, 'c7', 'minus'), ob('a', 25, 'c7', 'minus'), ob('a', 22, 'c7', 'plus'),
    ob('a', 10, 'c7', 'plus'), ob('a', 5, 'c7', 'plus'), ob('a', 3, 'c7', 'minus'),
    ob('a', 4, 'c1', 'minus'), ob('a', 4, 'c7', 'neutral'),
  ] });
  const r = L.phenomenonProgress(S, { traineeId: 'a', competencyId: 'c7',
    statusLog: [{ status: 'identified', at: at(28) }, { status: 'discussed', at: at(20) }] });
  assert.deepEqual({ ...r.before }, { p: 1, m: 2 });
  assert.deepEqual({ ...r.after }, { p: 2, m: 1 });
});

/* ---------- breakdown ---------- */
t('breakdown: insights only for >=2 occurrences and >=50%', () => {
  const l = [ob('a', 1, 'c7', 'minus', { conditions: ['לילה', 'עייפות'], hour: 2 }),
             ob('a', 2, 'c7', 'minus', { conditions: ['עייפות'], hour: 3 }),
             ob('a', 3, 'c7', 'minus', { conditions: ['לחץ זמן'], hour: 14 })];
  const b = L.breakdown(l);
  const labels = b.insights.map(x => x.label);
  assert.ok(labels.includes('עייפות'));
  assert.ok(labels.includes('לילה'));        // time of day: 2 of 3 at night
  assert.ok(!labels.includes('לחץ זמן'));
});

/* ---------- follow-ups & attention ---------- */
t('follow-up is due only on the LATEST talk, and not when done', () => {
  const S = state({ talks: [
    { id: 'k1', traineeId: 'a', at: at(20), followUpAt: L.ymd(NOW - 10 * DAY) },
    { id: 'k2', traineeId: 'a', at: at(5), followUpAt: L.ymd(NOW + 2 * DAY) },
    { id: 'k3', traineeId: 'b', at: at(9), followUpAt: L.ymd(NOW - 2 * DAY) },
    { id: 'k4', traineeId: 'c', at: at(9), followUpAt: L.ymd(NOW - 2 * DAY), followUpDone: true },
  ] });
  const due = L.dueFollowups(S, NOW);
  assert.deepEqual([...due.map(x => x.talk.id)], ['k3']);
  assert.equal(due[0].overdue, 2);
});
t('attention: follow-ups before patterns before bias', () => {
  const S = state({
    observations: [ob('a', 1, 'c4', 'minus'), ob('a', 2, 'c4', 'minus'), ob('a', 3, 'c4', 'minus'),
                   ...[1, 2, 3, 4, 5].map(d => ob('b', d, 'c' + d, 'plus'))],
    talks: [{ id: 'k', traineeId: 'c', at: at(9), followUpAt: L.ymd(NOW) }],
  });
  assert.deepEqual([...L.attention(S, NOW).map(x => x.type)], ['followup', 'pattern', 'bias']);
});

/* ---------- texts ---------- */
t('prep text: strengths/gaps by count with dated examples; private notes excluded by default', () => {
  const S = state({
    observations: [ob('a', 3, 'c5', 'plus', { behavior: 'היה ראשון בהעמסה' }), ob('a', 4, 'c5', 'plus'),
                   ob('a', 2, 'c7', 'minus', { behavior: 'דיווח בלי מיקום' })],
    notes: [{ id: 'n', traineeId: 'a', at: at(1), text: 'סוד אישי', private: true },
            { id: 'm', traineeId: 'a', at: at(1), text: 'מבקש משוב', private: false }],
  });
  const txt = L.prepText(S, 'a', NOW);
  assert.match(txt, /חוזקות:\n• דוגמה אישית \(⊕2\)/);
  assert.match(txt, /היה ראשון בהעמסה/);
  assert.match(txt, /נקודות לשיפור:\n• דיווח ותקשורת \(⊖1\)/);
  assert.match(txt, /שיחה ראשונה/);
  assert.ok(!txt.includes('סוד אישי'));
  assert.ok(txt.includes('מבקש משוב'));
  assert.ok(L.prepText(S, 'a', NOW, { includePrivate: true }).includes('סוד אישי'));
});
t('prep text: reports what happened since the last talk in the discussed competencies', () => {
  const S = state({
    observations: [ob('a', 2, 'c7', 'plus', { behavior: 'דיווח מלא' }), ob('a', 30, 'c7', 'minus')],
    phenomena: [{ id: 'p', traineeId: 'a', competencyId: 'c7', kind: 'gap', title: 'דיווח', status: 'discussed', goal: 'תבנית', statusLog: [] }],
    talks: [{ id: 'k', traineeId: 'a', at: at(10), phenomenonIds: ['p'], agreements: 'לדווח בתבנית' }],
  });
  const txt = L.prepText(S, 'a', NOW);
  assert.match(txt, /סוכם: לדווח בתבנית/);
  assert.match(txt, /מאז, באותן כשירויות: ⊕1 ⊖0/);
  assert.match(txt, /\[לשיפור\] דיווח — נדונה בשיחה/);
});
t('summary text lists phenomena with before/after', () => {
  const S = state({
    observations: [ob('a', 30, 'c7', 'minus'), ob('a', 2, 'c7', 'plus')],
    phenomena: [{ id: 'p', traineeId: 'a', competencyId: 'c7', kind: 'gap', title: 'דיווח', status: 'resolved', goal: '', createdAt: at(31),
      statusLog: [{ status: 'identified', at: at(31) }, { status: 'discussed', at: at(20) }] }],
  });
  const txt = L.summaryText(S, 'a', NOW);
  assert.match(txt, /לפני השיחה: ⊕0 ⊖1 · מאז: ⊕1 ⊖0/);
  assert.match(txt, /הושגה/);
});

/* ---------- vault ---------- */
t('vault: round-trips, uses 250k iterations, fresh IV per seal', async () => {
  const salt = V.newSalt();
  const key = await V.derive('correct horse', salt);
  const a = await V.seal(key, salt, { hello: 'עולם' });
  const b = await V.seal(key, salt, { hello: 'עולם' });
  assert.equal(a.iter, 250000);
  assert.notEqual(a.iv, b.iv);
  const r = await V.open('correct horse', a);
  assert.equal(r.data.hello, 'עולם');
});
t('vault: wrong password fails with "badpw", garbage fails with "format"', async () => {
  const salt = V.newSalt();
  const env = await V.seal(await V.derive('right', salt), salt, { x: 1 });
  await assert.rejects(V.open('wrong', env), /badpw/);
  await assert.rejects(V.open('right', { foo: 1 }), /format/);
  const tampered = { ...env, ct: env.ct.slice(0, -4) + 'AAAA' };
  await assert.rejects(V.open('right', tampered), /badpw/);
});

/* ---------- evidence gaps ---------- */
const discussedPh = (daysAgo, extra = {}) => ({ id: 'p', traineeId: 'a', competencyId: 'c7', kind: 'gap', title: 'דיווח', goal: 'תבנית',
  status: 'working', createdAt: at(daysAgo + 3), statusLog: [{ status: 'identified', at: at(daysAgo + 3) }, { status: 'discussed', at: at(daysAgo) }], ...extra });
t('evidence gap: discussed 8 days ago, nothing since in that competency → flagged', () => {
  const S = state({ phenomena: [discussedPh(8)], observations: [ob('a', 2, 'c1', 'plus')] });
  const g = L.evidenceGaps(S, NOW);
  assert.equal(g.length, 1);
  assert.equal(g[0].days, 8);
  assert.equal(g[0].hadAny, false);
});
t('evidence gap: a fresh observation in the competency clears it', () => {
  const S = state({ phenomena: [discussedPh(8)], observations: [ob('a', 2, 'c7', 'minus')] });
  assert.equal(L.evidenceGaps(S, NOW).length, 0);
});
t('evidence gap: not for identified/resolved phenomena, nor inside 7 days', () => {
  assert.equal(L.evidenceGaps(state({ phenomena: [discussedPh(8, { status: 'identified' })] }), NOW).length, 0);
  assert.equal(L.evidenceGaps(state({ phenomena: [discussedPh(8, { status: 'resolved' })] }), NOW).length, 0);
  assert.equal(L.evidenceGaps(state({ phenomena: [discussedPh(6)] }), NOW).length, 0);
});
t('evidence gap: a later talk about it restarts the clock', () => {
  const S = state({ phenomena: [discussedPh(20)], talks: [{ id: 'k', traineeId: 'a', at: at(3), phenomenonIds: ['p'] }] });
  assert.equal(L.evidenceGaps(S, NOW).length, 0);
});

/* ---------- next step ---------- */
t('next step priority: follow-up > evidence > pattern > waiting-for-talk > stale', () => {
  const S = state({
    phenomena: [discussedPh(10), { id: 'q', traineeId: 'a', competencyId: 'c2', kind: 'gap', title: 'ממתין', status: 'identified', statusLog: [] }],
    observations: [ob('a', 1, 'c4', 'minus'), ob('a', 2, 'c4', 'minus'), ob('a', 3, 'c4', 'minus')],
    talks: [{ id: 'k', traineeId: 'a', at: at(12), phenomenonIds: [], agreements: 'לבדוק', followUpAt: L.ymd(NOW - DAY) }],
  });
  assert.equal(L.nextStep(S, 'a', NOW).kind, 'followup');
  S.talks[0].followUpDone = true;
  assert.equal(L.nextStep(S, 'a', NOW).kind, 'evidence');
  assert.match(L.nextStep(S, 'a', NOW).text, /חפש ראיה: תבנית/);
  S.phenomena[0].status = 'resolved';
  assert.equal(L.nextStep(S, 'a', NOW).kind, 'pattern');
  S.dismissedObs = S.observations.map(o => o.id);
  assert.equal(L.nextStep(S, 'a', NOW).kind, 'talk');
  S.phenomena[1].status = 'resolved';
  assert.equal(L.nextStep(S, 'a', NOW), null);                 // observed yesterday: nothing to do
  assert.equal(L.nextStep(S, 'b', NOW).kind, 'observe');       // never observed
  assert.match(L.nextStep(S, 'b', NOW).text, /טרם נצפה/);
});

/* ---------- team coverage ---------- */
t('team coverage: counts last 21 days only, finds blind competencies and per-trainee gaps', () => {
  const S = state({ observations: [
    ob('a', 1, 'c1', 'plus'), ob('b', 2, 'c1', 'minus'), ob('c', 3, 'c1', 'plus'),
    ob('a', 4, 'c2', 'plus'), ob('b', 5, 'c2', 'plus'),
    ob('a', 30, 'c8', 'plus'), ob('b', 31, 'c8', 'plus'), ob('c', 32, 'c8', 'plus'),   // too old
    ob('z', 1, 'c3', 'plus'),                                                          // inactive trainee
  ] });
  const r = L.teamCoverage(S, NOW);
  assert.equal(r.total, 5);
  assert.equal(r.size, 3);
  const c1 = r.comps.find(x => x.c.id === 'c1');
  assert.equal(c1.covered.length, 3);
  const blindIds = r.blind.map(x => x.c.id);
  assert.ok(!blindIds.includes('c1') && !blindIds.includes('c2'));
  assert.equal(r.blind.length, 3);
  assert.ok(r.blind.every(x => x.covered.length === 0), 'worst (unobserved) competencies first');
  assert.ok(r.blind.length <= 3, 'never more than 3 blind spots');
  const tc = r.trainees.find(x => x.t.id === 'c');
  assert.equal(tc.seen, 1);
  assert.equal(tc.unseen.length, 7);
});

/* ---------- SBI ---------- */
t('prep text phrases examples as situation ← behavior ← impact', () => {
  const S = state({ observations: [ob('a', 2, 'c4', 'minus', { situation: 'הציר נחסם', behavior: 'עיכב החלטה 4 דקות', impact: 'המפקד התערב' })] });
  const txt = L.prepText(S, 'a', NOW);
  assert.ok(txt.includes('הציר נחסם ← עיכב החלטה 4 דקות ← המפקד התערב'));
  assert.ok(txt.includes('ראיתי: עיכב החלטה 4 דקות. ההשפעה: המפקד התערב. איך אתה ראית את זה?'));
});
t('normalize keeps a pending draft and guideDone', () => {
  const S = L.normalize({ pending: { draft: { behavior: 'x' } }, settings: { guideDone: true } });
  assert.equal(S.pending.draft.behavior, 'x');
  assert.equal(S.settings.guideDone, true);
});

for (const [name, fn] of queue) {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
}
console.log(`${passed}/${queue.length} passed`);
