/*
 * Browser tests for ../index.html — the behaviours that live in the UI layer
 * and that logic.test.mjs cannot see: drafts surviving a lock or a killed
 * page, navigation, touch-target sizes, the save-failure banner, Face ID.
 *
 * Run:  node tatzpiot/test/ui.test.mjs
 *
 * Needs Playwright + Chromium. Locally Playwright is installed globally, in CI
 * it is a local node_module — both are tried.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pw;
try { pw = await import('playwright'); }
catch (e) { pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.js'); }
const { chromium } = pw.default || pw;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const p = join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const PW = 'secret1';
const tests = [];
const t = (name, fn) => tests.push([name, fn]);

/* A locked-and-reopened vault holding the demo data, on a phone-sized page. */
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL0);
  await page.fill('#pw1', PW); await page.fill('#pw2', PW); await page.click('#go');
  await page.waitForFunction(() => !!S);
  await page.evaluate(async () => { S = demoData(Date.now()); await persist(); go('#/'); render(); });
  return { ctx, page };
}
const unlock = async page => { await page.fill('#pw', PW); await page.click('#go'); await page.waitForFunction(() => !!S); };
const goto = async (page, hash) => { await page.evaluate(h => go(h), hash); await page.waitForTimeout(80); };
const background = page => page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  return saving;
});

/* ---------- drafts ---------- */
t('talk form survives a lock', async () => {
  const { ctx, page } = await fresh();
  await goto(page, '#/talk/t3');
  await page.fill('#tkSum', 'סיכום ארוך'); await page.fill('#tkSelf', 'רואה אחרת'); await page.fill('#tkAgr', 'סוכם משהו');
  await page.evaluate(() => lock());
  await unlock(page);
  await page.waitForSelector('#tkSum');
  assert.equal(await page.inputValue('#tkSum'), 'סיכום ארוך');
  assert.equal(await page.inputValue('#tkSelf'), 'רואה אחרת');
  assert.equal(await page.inputValue('#tkAgr'), 'סוכם משהו');
  await ctx.close();
});

t('observation draft survives the page being killed in the background', async () => {
  const { ctx, page } = await fresh();
  await page.click('.fab'); await page.click('[data-act=obsTrainee]');
  await page.fill('#obBeh', 'טיוטה ואז הטלפון צלצל');
  await background(page);
  await page.reload();
  await unlock(page);
  await page.waitForSelector('#sheetRoot .sheet #obBeh');
  assert.equal(await page.inputValue('#obBeh'), 'טיוטה ואז הטלפון צלצל');
  await ctx.close();
});

t('observation draft is autosaved while typing, without any lock or background event', async () => {
  const { ctx, page } = await fresh();
  await page.click('.fab'); await page.click('[data-act=obsTrainee]');
  await page.fill('#obBeh', 'נכתב ואז הדפדפן קרס');
  await page.waitForTimeout(1800);
  await page.evaluate(() => saving);
  await page.reload();
  await unlock(page);
  await page.waitForSelector('#sheetRoot .sheet #obBeh');
  assert.equal(await page.inputValue('#obBeh'), 'נכתב ואז הדפדפן קרס');
  await ctx.close();
});

t('a draft that was saved does not come back as a duplicate', async () => {
  const { ctx, page } = await fresh();
  const before = await page.evaluate(() => S.observations.length);
  await page.click('.fab'); await page.click('[data-act=obsTrainee]');
  await page.click('[data-act=obsComp]'); await page.click('[data-act=obsVal]');
  await page.fill('#obBeh', 'תצפית שנשמרה כרגיל');
  await background(page);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.click('[data-act=saveDraft]');
  await page.evaluate(() => saving);
  await page.reload();
  await unlock(page);
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#sheetRoot .sheet').count(), 0, 'no restored sheet');
  assert.equal(await page.evaluate(() => S.observations.length), before + 1);
  await ctx.close();
});

t('new-phenomenon sheet survives a lock', async () => {
  const { ctx, page } = await fresh();
  await goto(page, '#/t/t2');
  await page.click('[data-act=newPhen]');
  await page.fill('#npTitle', 'מעכב החלטה כשהתוכנית משתנה');
  await page.evaluate(() => lock());
  await unlock(page);
  await page.waitForSelector('#npTitle');
  assert.equal(await page.inputValue('#npTitle'), 'מעכב החלטה כשהתוכנית משתנה');
  await ctx.close();
});

/* ---------- save failure ---------- */
t('a failed save shows a banner that stays until a save succeeds', async () => {
  const { ctx, page } = await fresh();
  await page.evaluate(() => {
    window.__set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    S.settings.unitName = 'x'; return persist();
  });
  await page.waitForTimeout(3500);   // longer than any toast
  assert.ok(await page.locator('#saveErr').isVisible(), 'banner visible after the toast is gone');
  await page.evaluate(() => { Storage.prototype.setItem = window.__set; return persist(); });
  await page.waitForTimeout(100);
  assert.ok(!(await page.locator('#saveErr').isVisible()), 'banner cleared');
  await ctx.close();
});

/* ---------- navigation ---------- */
t('profile tabs do not pile up in history: one "back" leaves the profile', async () => {
  const { ctx, page } = await fresh();
  await page.click('a.li');
  for (const k of ['comp', 'time', 'talks']) { await page.click(`a.tab[href$="/${k}"]`); await page.waitForTimeout(60); }
  assert.match(await page.evaluate(() => location.hash), /\/talks$/);
  await page.click('[data-act=back]'); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => location.hash), '#/');
  await ctx.close();
});

t('home shows at most 3 attention items', async () => {
  const { ctx, page } = await fresh();
  assert.ok(await page.evaluate(() => logic.attention(S, Date.now()).length) > 3, 'demo data has more than 3');
  assert.equal(await page.locator('main .q').count(), 3);
  await ctx.close();
});

/* ---------- conclusions, not tables ---------- */
t('there is no team screen: three destinations in the bottom bar, settings from the home header', async () => {
  const { ctx, page } = await fresh();
  assert.equal(await page.locator('.bnav a').count(), 2);
  assert.equal(await page.locator('.bnav a[href="#/team"]').count(), 0);
  await page.click('header a[href="#/settings"]'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => location.hash), '#/settings');
  await page.click('[data-act=back]'); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => location.hash), '#/');
  await goto(page, '#/team');
  assert.equal(await page.locator('.cvr').count(), 0, 'old link lands on home, no coverage table');
  await ctx.close();
});

t('blind spots are one sentence on home and before a round', async () => {
  const { ctx, page } = await fresh();
  const names = await page.evaluate(() => logic.teamCoverage(S, Date.now()).blind.map(x => x.c.name));
  assert.ok(names.length >= 1 && names.length <= 3);
  const home = await page.locator('#blind').innerText();
  for (const n of names) assert.ok(home.includes(n), n);
  await goto(page, '#/round');
  const rd = await page.locator('#blind').innerText();
  for (const n of names) assert.ok(rd.includes(n), n);
  await ctx.close();
});

t('a new vault with one trainee shows no zeros and no blind-spot verdict', async () => {
  const { ctx, page } = await fresh();
  await page.evaluate(async () => { S = logic.normalize({}); S.trainees = [{ id: 'a', nickname: 'ברק', team: '', active: true }]; await persist(); go('#/'); render(); });
  assert.equal(await page.locator('#blind').count(), 0);
  assert.ok(!(await page.locator('main').innerText()).includes('0/1'));
  await ctx.close();
});

/* ---------- round: any order ---------- */
const startRound = async page => { await goto(page, '#/round'); await page.click('[data-act=startRound]'); await page.waitForSelector('[data-act=roundPick]'); };
const fillObs = async (page, text) => { await page.click('#obsForm [data-act=obsComp]'); await page.click('#obsForm [data-act=obsVal]'); await page.fill('#obBeh', text); };
t('round: any trainee can be picked at any moment, whatever the suggested order', async () => {
  const { ctx, page } = await fresh();
  await startRound(page);
  const q = await page.evaluate(() => round.queue);
  assert.equal(await page.locator('[data-act=roundPick]').count(), q.length);
  await page.click(`[data-act=roundPick][data-id="${q[3]}"]`);
  await fillObs(page, 'התנהגות שנצפתה אצל הרביעי בתור');
  await page.click('[data-act=roundSave]');
  const last = await page.evaluate(() => S.observations[S.observations.length - 1]);
  assert.equal(last.traineeId, q[3]);
  assert.equal(await page.evaluate(() => round.queue[round.i]), q[0], '"next" returns to the first one not yet observed');
  await ctx.close();
});

t('round: text already typed moves with you when you pick another trainee', async () => {
  const { ctx, page } = await fresh();
  await startRound(page);
  const q = await page.evaluate(() => round.queue);
  await page.fill('#obBeh', 'כתבתי ואז הבנתי שזה חניך אחר');
  await page.click(`[data-act=roundPick][data-id="${q[2]}"]`);
  assert.equal(await page.inputValue('#obBeh'), 'כתבתי ואז הבנתי שזה חניך אחר');
  assert.equal(await page.evaluate(() => round.draft.traineeId), q[2]);
  await ctx.close();
});

t('round: ends when everyone was observed, in whatever order', async () => {
  const { ctx, page } = await fresh();
  await startRound(page);
  const q = await page.evaluate(() => round.queue);
  for (const id of [...q].reverse()) {
    await page.click(`[data-act=roundPick][data-id="${id}"]`);
    await fillObs(page, 'תצפית בסדר הפוך מהמוצע');
    await page.click('[data-act=roundSave]');
  }
  await page.waitForSelector('[data-act=endRound]');
  assert.equal(await page.evaluate(() => round.done.length), q.length);
  await ctx.close();
});

/* ---------- accessibility ---------- */
const small = page => page.evaluate(() => {
  const bad = [];
  for (const e of document.querySelectorAll('button,a,input,select,textarea,summary')) {
    let r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.type === 'file' || e.type === 'hidden') continue;
    if (e.matches('input[type=checkbox]')) r = e.closest('label').getBoundingClientRect();
    const inline = e.tagName === 'A' && (!e.className || e.matches('.tag'));
    const min = inline ? 24 : 44;
    const wOK = inline || r.width >= 44;
    if (r.height < min - 0.5 || !wOK) bad.push(`${e.tagName}.${e.className || ''}[${e.dataset.act || e.id || ''}] ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return [...new Set(bad)];
});
t('every control is at least 44px (inline text links 24px), on every screen', async () => {
  const { ctx, page } = await fresh();
  const bad = {};
  const check = async name => { const b = await small(page); if (b.length) bad[name] = b; };
  for (const h of ['#/', '#/t/t1', '#/t/t1/comp', '#/t/t1/time', '#/t/t1/talks', '#/t/t3', '#/p/p1', '#/talk/t1', '#/prep/t1', '#/round', '#/settings']) {
    await goto(page, h); await check(h);
  }
  await goto(page, '#/round'); await page.click('[data-act=startRound]'); await page.click('details.more > summary'); await check('round-active');
  await goto(page, '#/'); await page.click('.fab'); await page.waitForTimeout(350);
  await page.click('[data-act=obsTrainee]'); await page.click('.sheet details.more > summary'); await check('obs-sheet');
  await page.evaluate(() => lock()); await page.waitForTimeout(100); await check('lock');
  assert.deepEqual(bad, {});
  await ctx.close();
});

t('opening a sheet moves focus into it, closing returns focus to the opener', async () => {
  const { ctx, page } = await fresh();
  await page.focus('.fab'); await page.keyboard.press('Enter'); await page.waitForTimeout(350);
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'focus is inside the sheet');
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('fab')), 'focus is back on the opener');
  await ctx.close();
});

t('error messages are announced (role=alert)', async () => {
  const { ctx, page } = await fresh();
  await page.click('.fab'); await page.click('[data-act=saveDraft]');
  assert.equal(await page.locator('.sheet .err[role=alert]').count(), 1);
  await ctx.close();
});

/* ---------- Face ID (WebAuthn PRF, via a virtual authenticator) ---------- */
async function withAuthenticator(page, ctx) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
}
async function enroll(page) {
  await goto(page, '#/settings');
  await page.click('[data-act=bioOn]');
  await page.waitForFunction(() => !!localStorage.getItem('tatzpiot.bio'));
}
t('Face ID: after enrolling, the vault opens without the password', async () => {
  const { ctx, page } = await fresh();
  await withAuthenticator(page, ctx);
  await enroll(page);
  await page.evaluate(() => lock()); await page.waitForSelector('[data-act=bioUnlock]');
  await page.click('[data-act=bioUnlock]');
  await page.waitForFunction(() => !!S);
  assert.equal(await page.evaluate(() => S.trainees.length), 6);
  // and what is saved afterwards still opens with the password
  await page.evaluate(() => { S.settings.unitName = 'אחרי ביומטרי'; return persist(); });
  await page.evaluate(() => lock()); await unlock(page);
  assert.equal(await page.evaluate(() => S.settings.unitName), 'אחרי ביומטרי');
  await ctx.close();
});

t('Face ID: the stored record does not contain the vault key in the clear, and the password still works', async () => {
  const { ctx, page } = await fresh();
  await withAuthenticator(page, ctx);
  await enroll(page);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('tatzpiot.bio')));
  assert.deepEqual(Object.keys(rec).sort(), ['ct', 'id', 'iv', 'prfSalt', 'v', 'vaultSalt']);
  await page.evaluate(() => lock());
  await unlock(page);
  assert.ok(await page.evaluate(() => !!S));
  await ctx.close();
});

t('Face ID: changing the password turns it off (the old wrapped key is useless)', async () => {
  const { ctx, page } = await fresh();
  await withAuthenticator(page, ctx);
  await enroll(page);
  await page.click('[data-act=changePw]');
  await page.fill('#cp0', PW); await page.fill('#cp1', 'another9'); await page.fill('#cp2', 'another9');
  await page.click('form[data-form=changePw] button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('#cp0'));
  assert.equal(await page.evaluate(() => localStorage.getItem('tatzpiot.bio')), null);
  await page.evaluate(() => lock()); await page.waitForSelector('#pw');
  assert.equal(await page.locator('[data-act=bioUnlock]').count(), 0);
  await ctx.close();
});

t('Face ID: where the device cannot do it, the option is not offered', async () => {
  const { ctx, page } = await fresh();
  await page.evaluate(() => { delete window.PublicKeyCredential; });
  await goto(page, '#/settings');
  assert.equal(await page.locator('[data-act=bioOn]').count(), 0);
  await ctx.close();
});

/* ---------- run ---------- */
let passed = 0, failed = 0;
const only = process.argv[2];
for (const [name, fn] of tests) {
  if (only && !name.includes(only)) continue;
  try { await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error('timeout 30s')), 30000))]); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').slice(0, 6).join('\n     ')); }
}
console.log(`\n${passed}/${passed + failed} passed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
