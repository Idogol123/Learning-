# "הספירה" v3 — שכבת הפיצ'רים

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להוסיף ל"הספירה" את הפיצ'רים שהופכים אותה מכלי נכון לכלי שרוצים לפתוח —
בלי שרת, בלי חשבון, בלי לשבור את מערכת העיצוב.

**Architecture:** ממשיך את המבנה של v2. כל לוגיקה חדשה שאפשר לבדוק בלי דפדפן נכנסת
ל-`dates`/`store` (שנשאבים ל-`node:vm` בבדיקות); כל השאר ל-`render`/`motion` ולמודולים
חדשים `live` (ספירה חיה + Wake Lock), `card` (כרטיס שיתוף), `link` (העברה בין מכשירים).

**Tech Stack:** אותו HTML/CSS/JS ללא תלויות. APIs חדשים בשימוש, כולם עם feature-detection
ונפילה רכה: `navigator.wakeLock`, `navigator.vibrate`, `navigator.canShare({files})`,
`OffscreenCanvas`/`<canvas>`, `TextEncoder`/`btoa`.

**תלות:** התוכנית הזו רצה **אחרי** [`2026-08-08-service-countdown-v2.md`](2026-08-08-service-countdown-v2.md).
משימות 15-22 מניחות שקיימים: `dates.unitValue/unitName/axisGap`, `store.validateEvent`,
`render.openSheet/toast/eventSheet`, `clock.init`, ו-`state.unit`.

## Global Constraints

כל האילוצים של v2 חלים כאן במלואם. בנוסף:

- **כל API חדש עטוף ב-feature detection ובנפילה רכה.** אין פיצ'ר שמפיל את הדף בדפדפן
  שלא תומך בו — במיוחד `vibrate` (לא קיים ב-iOS Safari) ו-`wakeLock`.
- **אין אימוג'י, אין SVG מצויר ביד.** אייקונים מ-`ICONS` בלבד; גרפיקה חדשה = SVG
  גיאומטרי (טבעת, קשת) או ציור ב-`canvas`.
- **אין רשת.** כרטיס השיתוף מצויר ב-`canvas` מקומי; קישור ההעברה הוא `#hash` באותו origin.
- **`prefers-reduced-motion` מכובד בכל אנימציה חדשה.**
- **הצבעים החדשים (משימה 21) הם סט סגור ומאושר.** אין בורר צבע חופשי — זו הדרך
  הבטוחה ביותר להרוס את השפה העיצובית.
- **לפני כל commit:** `node service-countdown/test/dates.test.mjs`,
  `node service-countdown/test/ics.test.mjs`, `node .claude/tools/verify-all.mjs --structural`.
- **`sw.js`:** באמפ יחיד ל-`sc-v3` במשימה 23 בלבד.

## File Structure

| קובץ | שינוי |
|---|---|
| `service-countdown/index.html` | מורחב — כל המשימות |
| `service-countdown/test/dates.test.mjs` | מורחב — משימות 16, 17, 20, 22 |
| `service-countdown/sw.js` | באמפ ל-`sc-v3` — משימה 23 |
| `README.md`, `.claude/PROJECT_LESSONS.md` | משימה 23 |

**סדר מומלץ לביצוע מקבילי:** משימות 15, 19, 21 עצמאיות לחלוטין (עיצוב/ויזואל).
משימות 16, 17, 20, 22 עצמאיות זו מזו אך כולן נוגעות ב-`dates` — למזג אחת-אחת.
משימה 18 תלויה ב-15 (הטבעת). משימה 23 אחרונה.

---

## Task 15: טבעת התקדמות אמיתית

**למה:** האפיון המקורי צייר "טבעת התקדמות דקה סביב המספר". מה שנבנה בפועל הוא פס
ישר מתחתיו. הטבעת היא גם תיקון לאפיון וגם השדרוג הוויזואלי הזול ביותר שיש כאן.

**Files:**
- Modify: `service-countdown/index.html` — CSS (`.hero-ring*`), `render.hero`

**Interfaces:**
- Produces: `render.ring(pct: number) -> SVGElement` — טבעת SVG בקוטר קבוע,
  `stroke-dasharray` מחושב מהאחוז. הפס הישן (`.hero-ring`) נמחק.

- [ ] **Step 1: Replace the bar CSS with ring CSS**

בבלוק ה-`<style>`, החלף את שני הכללים `.hero-ring` ו-`.hero-ring>i`:

```css
.hero-wrap{position:relative; display:grid; place-items:center; margin-block:.25rem}
.hero-ring{display:block; width:min(78vw, 340px); height:auto; overflow:visible}
.hero-ring circle{fill:none; stroke-linecap:round;
  transform:rotate(-90deg); transform-origin:50% 50%}
.hero-ring .track{stroke:var(--line); stroke-width:3}
.hero-ring .fill{stroke:var(--accent); stroke-width:3;
  transition:stroke-dashoffset .9s var(--ease)}
.hero-wrap>.hero-inner{position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:.15rem; padding:12%}
@media (prefers-reduced-motion: reduce){ .hero-ring .fill{transition:none} }
```

- [ ] **Step 2: Add the ring builder**

ב-`render`, לפני `function hero(state, refresh)`:

```js
  // A ring, not a bar: the spec drew one and a straight line under the number
  // reads as a loading indicator rather than as a share of a service.
  // r=46 in a 100-unit box leaves room for the 3-unit stroke at both ends.
  function ring(pct) {
    const R = 46, C = 2 * Math.PI * R;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hero-ring');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    for (const cls of ['track', 'fill']) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', cls);
      c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(R));
      if (cls === 'fill') {
        c.setAttribute('stroke-dasharray', String(C));
        // Start empty, then let the CSS transition draw it on the next frame.
        c.setAttribute('stroke-dashoffset', String(C));
        requestAnimationFrame(() => requestAnimationFrame(() => {
          c.setAttribute('stroke-dashoffset', String(C * (1 - Math.min(100, pct) / 100)));
        }));
      }
      svg.append(c);
    }
    return svg;
  }
```

והוסף `ring` ל-`return` של `render`.

- [ ] **Step 3: Wrap the number inside the ring**

ב-`render.hero`, החלף את הבלוק שמוסיף את המספר, היחידה והטבעת (מ-`host.append(num)`
ועד סוף בלוק ה-`if (state.profile)`) ב:

```js
    const wrap = el('div', { class: 'hero-wrap' });
    const inner = el('div', { class: 'hero-inner' });
    inner.append(num);
    const rest = dates.remainderLabel(unit, today, ev.date);
    inner.append(el('div', { class: 'hero-unit' },
      past ? `${dates.unitName(unit, value)} מאז ${ev.title}`
           : (value === 0 && unit === 'days' ? 'היום!'
              : `${dates.unitName(unit, value)}${rest ? ' ' + rest : ''}`)));

    if (state.profile) {
      const pct = dates.progressPct(state.profile.enlistDate, state.profile.releaseDate, today);
      wrap.append(ring(pct));
      wrap.append(inner);
      host.append(wrap);
      host.append(el('div', { class: 'hero-meta' },
        `${dates.formatHe(ev.date)} · ${pct}% פז"מ`));
    } else {
      wrap.append(inner);
      host.append(wrap);
      host.append(el('div', { class: 'hero-meta' }, dates.formatHe(ev.date)));
    }
```

שים לב: `const rest = ...` ו-`hero-unit` הועברו לכאן ממשימה 5 — ודא שאין כפילות
של אותן שתי שורות בהמשך הפונקציה.

- [ ] **Step 4: Shrink the number so it fits inside the ring**

בבלוק ה-`<style>`, החלף את `font-size` של `.hero-num`:

```css
.hero-num{font-size:clamp(4rem, 16vw, 8.5rem)}
```

- [ ] **Step 5: Verify at three widths, both schemes**

Run:
```bash
for w in 320 390 1280; do for s in dark light; do
  node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-ring-$w-$s.png $s $w
done; done
```
Expected: בכל שש הריצות `overflow=false console_errors=[]`. פתח את
`/tmp/sc-ring-320-dark.png` וּודא שהמספר והיחידה יושבים בתוך הטבעת בלי לגעת בה.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): real progress ring around the number"
```

---

## Task 16: מצב ספירה חיה — שעות, דקות, שניות

**למה:** פז"מ סופרת בדקות ובשניות. לרוב הזמן זה רעש, אבל בשבוע האחרון זה בדיוק
מה שאנשים רוצים. לחיצה ארוכה על המספר פותחת מסך מלא שסופר חי, עם נעילת מסך פעילה
כדי שאפשר יהיה להשעין את הטלפון על המדף.

**Files:**
- Modify: `service-countdown/index.html` — `dates` (2 פונקציות), מודול `live` חדש,
  `render.hero`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.msUntilDate(iso, now: Date) -> number` (עד חצות המקומית של אותו יום,
  יכול להיות שלילי); `dates.splitDuration(ms) -> {days, hours, minutes, seconds}`;
  `live.open(title, dateISO) -> void`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.msUntilDate is not a function`.

- [ ] **Step 3: Implement the pure functions**

ב-`dates`, אחרי `enlistWaves`:

```js
  // Distance to local midnight that starts the target day. Negative once the
  // day has begun -- the live screen shows the elapsed time instead.
  function msUntilDate(iso, now) {
    return parse(iso) - now;
  }

  // Absolute breakdown: the sign is the caller's business, since "3 days since"
  // and "3 days until" render identically apart from their label.
  function splitDuration(ms) {
    let s = Math.floor(Math.abs(ms) / 1000);
    const days = Math.floor(s / 86400); s -= days * 86400;
    const hours = Math.floor(s / 3600); s -= hours * 3600;
    const minutes = Math.floor(s / 60);
    return { days, hours, minutes, seconds: s - minutes * 60 };
  }
```

והוסף את שתיהן ל-`return` של `dates`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `51 passed`.

- [ ] **Step 5: Add the `live` module**

הוסף בלוק `<script>` חדש אחרי המודול `ics`:

```html
<script>
/* ---------- live: the seconds view, for the week when seconds matter ---------- */
const live = (() => {
  let raf = null, sentinel = null;

  async function lock() {
    // Screen Wake Lock so the phone can sit on a shelf counting down. Absent on
    // some browsers and revoked whenever the tab is backgrounded -- both are
    // fine, the view just dims with the screen.
    try {
      if ('wakeLock' in navigator) sentinel = await navigator.wakeLock.request('screen');
    } catch (e) { sentinel = null; }
  }

  function release() {
    if (sentinel) { sentinel.release().catch(() => {}); sentinel = null; }
  }

  function open(title, dateISO) {
    const box = el('div', { class: 'sheet live', role: 'dialog', 'aria-modal': 'true' });
    box.innerHTML = `
      <div class="live-body">
        <div class="hero-label" id="lvTitle"></div>
        <div class="live-grid" id="lvGrid"></div>
        <div class="hero-meta" id="lvDate"></div>
      </div>`;
    const dismiss = render.openSheet(box, () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      release();
    });
    box.querySelector('#lvTitle').textContent = title;
    box.querySelector('#lvDate').textContent = dates.formatHe(dateISO);
    const grid = box.querySelector('#lvGrid');

    const cells = [['days', 'ימים'], ['hours', 'שעות'], ['minutes', 'דקות'], ['seconds', 'שניות']]
      .map(([key, label]) => {
        const cell = el('div', { class: 'live-cell' });
        const n = el('div', { class: 'live-num' }, '0');
        cell.append(n, el('div', { class: 'live-lab' }, label));
        grid.append(cell);
        return { key, n };
      });

    let lastSecond = -1;
    function frame() {
      const ms = dates.msUntilDate(dateISO, new Date());
      const parts = dates.splitDuration(ms);
      // One DOM write per second, not per frame: rAF only exists here to stay
      // in step with the compositor and to stop cleanly when the sheet closes.
      if (parts.seconds !== lastSecond) {
        lastSecond = parts.seconds;
        for (const c of cells) c.n.textContent = String(parts[c.key]);
        box.querySelector('#lvTitle').textContent =
          ms < 0 ? `מאז ${title}` : title;
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    lock();
    return dismiss;
  }

  return { open };
})();
</script>
```

- [ ] **Step 6: Style it**

בבלוק ה-`<style>`, אחרי הכללים של `.sheet`:

```css
.sheet.live{justify-content:center; align-items:center}
.live-body{display:flex; flex-direction:column; align-items:center; gap:1rem; text-align:center}
.live-grid{display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:.6rem}
.live-cell{min-width:4rem; padding:.8rem .4rem; border-radius:var(--r);
  background:var(--card); border:1px solid var(--line)}
.live-num{font-size:clamp(1.6rem, 8vw, 2.6rem); font-weight:800; color:var(--accent);
  font-variant-numeric:tabular-nums; line-height:1}
.live-lab{color:var(--muted); font-size:.8rem; margin-top:.3rem}
```

- [ ] **Step 7: Open it from a long press on the number**

ב-`render.hero`, אחרי `num.onclick = ...`:

```js
    // Long press, not a second button: the hero screen earns its calm by
    // having exactly one thing on it.
    let holdTimer = null;
    const startHold = () => {
      holdTimer = setTimeout(() => { holdTimer = null; live.open(ev.title, ev.date); }, 550);
    };
    const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    num.addEventListener('pointerdown', startHold);
    num.addEventListener('pointerup', cancelHold);
    num.addEventListener('pointerleave', cancelHold);
    num.addEventListener('contextmenu', e => e.preventDefault());
```

וב-`hero-meta` הוסף רמז, מיד אחרי הוספת ה-`hero-meta` הקיים:

```js
    host.append(el('div', { class: 'hero-meta', style: 'opacity:.6;font-size:.8rem' },
      'לחיצה על המספר מחליפה יחידה · לחיצה ארוכה לספירה חיה'));
```

- [ ] **Step 8: Verify the live view ticks and cleans up**

Run:
```bash
cat > /tmp/sc-live.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const page = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:8899/service-countdown/index.html');
await page.evaluate(() => localStorage.setItem('service-countdown.v1', JSON.stringify({
  v:1, profile:{enlistDate:'2025-03-15',releaseDate:'2027-11-15',gender:'m'},
  events:[], heroId:'release', theme:'dark', unit:'days' })));
await page.reload(); await page.waitForTimeout(300);
await page.locator('#heroNum').dispatchEvent('pointerdown');
await page.waitForTimeout(900);
const first = await page.locator('.live-cell').last().textContent();
await page.waitForTimeout(1600);
const second = await page.locator('.live-cell').last().textContent();
console.log('live sheet open:', await page.locator('.sheet.live').count() === 1);
console.log('seconds ticking:', first !== second);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('closed cleanly:', await page.locator('.sheet.live').count() === 0);
console.log('page errors:', errs);
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-live.mjs
```

Expected: שלוש שורות `true` ו-`page errors: []`.

- [ ] **Step 9: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): live seconds view on long press, with screen wake lock"
```

---

## Task 17: אירועים חוזרים — "רגילה כל שלושה שבועות"

**למה:** רגילה היא לא אירוע חד-פעמי. היום המשתמש מזין תאריך, הוא עובר, והשורה נשארת
תקועה בעבר עד שימחק אותה ידנית. אירוע חוזר מתגלגל לבד למופע הבא.

**Files:**
- Modify: `service-countdown/index.html` — `dates.nextOccurrence`, `store.allEvents`,
  `render.eventSheet`
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.nextOccurrence(startISO, everyDays, todayISO) -> string`.
  שדה חדש באירוע: `every: number | null` (ימים בין מופעים). `store.allEvents`
  מחזיר אירוע חוזר כשהוא **מגולגל** למופע הבא, עם `date` מעודכן ו-`baseDate` המקורי.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.nextOccurrence is not a function`.

- [ ] **Step 3: Implement**

ב-`dates`, אחרי `splitDuration`:

```js
  // The next date in a fixed-day cycle at or after `todayISO`. Built on addDays
  // so a cycle that crosses a DST boundary keeps landing on the same weekday.
  function nextOccurrence(startISO, everyDays, todayISO) {
    if (!everyDays || everyDays <= 0) return startISO;
    const behind = daysBetween(startISO, todayISO);
    if (behind <= 0) return startISO;
    return addDays(startISO, Math.ceil(behind / everyDays) * everyDays);
  }
```

והוסף `nextOccurrence` ל-`return` של `dates`.

ב-`store`, החלף את `allEvents`:

```js
  // A repeating event is stored once and rolled forward for display. Mutating
  // the stored date on every open would rewrite history and break undo.
  function allEvents(state, todayISO) {
    const today = todayISO || dates.todayISO();
    const list = state.events.map(e => {
      const row = Object.assign({ virtual: false }, e);
      if (e.every > 0) {
        row.baseDate = e.date;
        row.date = dates.nextOccurrence(e.date, e.every, today);
      }
      return row;
    });
    const rel = releaseEvent(state);
    if (rel) list.push(rel);
    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `55 passed`.

- [ ] **Step 5: Offer the cycle in the event sheet**

ב-`render.eventSheet`, הוסף אחרי ה-`div` של התאריך ב-`innerHTML`:

```html
      <div>
        <label for="aEvery">חוזר כל</label>
        <div class="row">
          <input type="number" id="aEvery" min="0" max="365" step="1" value="0"
                 inputmode="numeric" aria-label="מספר ימים בין מופעים">
          <span class="ev-d">ימים · 0 = אירוע חד-פעמי</span>
        </div>
        <div class="tpl" id="aEveryQuick"></div>
      </div>
```

ואחרי `if (existing) { ... }`:

```js
    const every = box.querySelector('#aEvery');
    if (existing && existing.every) every.value = existing.every;
    const quick = box.querySelector('#aEveryQuick');
    for (const q of [{ n: 7, label: 'כל שבוע' }, { n: 14, label: 'כל שבועיים' },
                     { n: 21, label: 'כל 3 שבועות' }, { n: 28, label: 'כל 4 שבועות' }]) {
      const b = el('button', { type: 'button' }, q.label);
      b.onclick = () => {
        quick.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        every.value = q.n;
      };
      quick.append(b);
    }
```

ובשמירה, החלף את שתי ההסתעפויות:

```js
      const cycle = Math.max(0, Math.min(365, Number(every.value) || 0));
      if (existing) {
        Object.assign(existing, { title: draft.title, date: draft.date,
                                  icon: pickedIcon, every: cycle || null });
      } else {
        state.events.push({ id: 'e' + Date.now().toString(36), title: draft.title,
                            date: draft.date, icon: pickedIcon, source,
                            every: cycle || null });
      }
```

- [ ] **Step 6: Mark repeating rows in the list**

ב-`render.events`, אחרי `mid.append(el('span', { class: 'ev-d' }, dates.formatHe(ev.date)));`:

```js
      if (ev.baseDate) {
        mid.append(el('span', { class: 'ev-d' },
          `חוזר כל ${dates.hebrewDays(state.events.find(x => x.id === ev.id).every)}`));
      }
```

- [ ] **Step 7: Verify and commit**

Run:
```bash
node service-countdown/test/dates.test.mjs && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-repeat.png dark 390
```
Expected: `55 passed`, `overflow=false console_errors=[]`

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): repeating events that roll to the next occurrence"
```

---

## Task 18: רגעי ציון דרך — "רגע ההיפוך"

**למה:** בשירות יש שלושה רגעים שכולם סופרים אליהם: חצי פז"מ, 100 הימים האחרונים,
והרגע שבו נשאר פחות ממה שכבר עשית. הכלי יודע את שלושתם ואינו אומר עליהם דבר.

**Files:**
- Modify: `service-countdown/index.html` — `dates.momentFor`, `render.hero`, `motion.celebrate`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.momentFor(enlistISO, releaseISO, todayISO) -> {key, text} | null`;
  `motion.celebrate() -> void`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.momentFor is not a function`.

- [ ] **Step 3: Implement**

ב-`dates`, אחרי `nextOccurrence`:

```js
  // The three moments people actually count toward. Returns the most advanced
  // one that has already happened, or null when there is nothing to say --
  // a banner that is always on stops being a banner.
  function momentFor(enlistISO, releaseISO, todayISO) {
    const left = daysBetween(todayISO, releaseISO);
    if (left < 0) return null;
    if (left <= 100) {
      return { key: 'last100', text: `100 הימים האחרונים — נשארו ${hebrewDays(left)}` };
    }
    const pct = progressPct(enlistISO, releaseISO, todayISO);
    if (pct >= 50) {
      return { key: 'half', text: 'עברת את חצי הפז״מ — נשאר לך פחות ממה שכבר עשית' };
    }
    return null;
  }
```

והוסף `momentFor` ל-`return` של `dates`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `57 passed`.

- [ ] **Step 5: Render the banner**

ב-`render.hero`, אחרי הוספת ה-`hero-meta` הראשי:

```js
    if (state.profile) {
      const moment = dates.momentFor(state.profile.enlistDate, state.profile.releaseDate, today);
      if (moment) {
        const badgeEl = el('div', { class: 'moment' });
        badgeEl.append(el('span', { class: 'ico' }, icon('star')));
        badgeEl.append(el('span', {}, moment.text));
        host.append(badgeEl);
        // Celebrate once per moment, not on every render.
        if (state.seenMoment !== moment.key) {
          state.seenMoment = moment.key;
          store.save(state);
          motion.celebrate();
        }
      }
    }
```

והוסף `seenMoment: null` ל-`store.blank()`.

- [ ] **Step 6: Add the celebration**

ב-`motion`, לפני ה-`return`:

```js
  // A restrained pulse of the accent, not confetti: this collection does not
  // do party graphics, and reduced-motion users get nothing at all.
  function celebrate() {
    if (reduce) return;
    const el2 = document.querySelector('.hero-ring .fill') || document.getElementById('heroNum');
    if (!el2) return;
    el2.classList.remove('celebrate');
    void el2.getBoundingClientRect();
    el2.classList.add('celebrate');
    if (navigator.vibrate) { try { navigator.vibrate([12, 60, 12]); } catch (e) {} }
  }
```

והוסף `celebrate` ל-`return` של `motion`.

- [ ] **Step 7: Style it**

```css
.moment{display:inline-flex; align-items:center; gap:.5rem; margin-top:.9rem;
  padding:.5rem .8rem; border-radius:999px; font-size:.88rem; font-weight:700;
  color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, var(--card));
  border:1px solid color-mix(in srgb, var(--accent) 26%, transparent)}
.moment .ico{width:16px; height:16px}
@keyframes celebrate{
  0%{filter:none} 35%{filter:drop-shadow(0 0 14px var(--accent))} 100%{filter:none}
}
.celebrate{animation:celebrate 1.1s var(--ease)}
```

- [ ] **Step 8: Verify and commit**

Run:
```bash
node service-countdown/test/dates.test.mjs && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-moment.png dark 390
```
Expected: `57 passed`, `overflow=false console_errors=[]`

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): crossover, halfway and last-100-days moments"
```

---

## Task 19: כרטיס שיתוף כתמונה

**למה:** זו התשובה שלנו ל"סטיקרים" של המתחרה — בלי שרת, בלי חשבון, בלי אימוג'י.
תמונת PNG מצוירת ב-canvas מקומי, נשלחת דרך גיליון השיתוף של המערכת או יורדת כקובץ.

**Files:**
- Modify: `service-countdown/index.html` — מודול `card` חדש, `render.settings`

**Interfaces:**
- Produces: `card.draw(opts: {title, value, unit, dateText, pct, dark}) -> HTMLCanvasElement`;
  `card.share(state) -> Promise<void>`

- [ ] **Step 1: Add the `card` module**

הוסף בלוק `<script>` חדש אחרי המודול `live`:

```html
<script>
/* ---------- card: a shareable image, drawn locally ---------- */
const card = (() => {
  const W = 1080, H = 1080;

  function palette(dark) {
    return dark
      ? { bg: '#13140f', card: '#1c1e15', ink: '#edefe1', muted: '#9aa08c',
          line: '#2c2f23', accent: '#e0a33c' }
      : { bg: '#f2f1ea', card: '#fbfaf5', ink: '#1c1e16', muted: '#6b7061',
          line: '#e0ded2', accent: '#8a5a12' };
  }

  function draw(opts) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const p = palette(opts.dark);
    const font = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", Arial, sans-serif';

    g.fillStyle = p.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = p.card;
    g.strokeStyle = p.line; g.lineWidth = 3;
    g.beginPath(); g.roundRect(60, 60, W - 120, H - 120, 48); g.fill(); g.stroke();

    // Progress ring, same geometry as the app's hero ring.
    const cx = W / 2, cy = 470, r = 240;
    g.lineWidth = 18; g.lineCap = 'round';
    g.strokeStyle = p.line;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    if (opts.pct > 0) {
      g.strokeStyle = p.accent;
      g.beginPath();
      g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * opts.pct) / 100);
      g.stroke();
    }

    g.direction = 'rtl';
    g.textAlign = 'center';
    g.fillStyle = p.muted;
    g.font = `600 44px ${font}`;
    g.fillText(opts.title, cx, cy - 150);

    g.fillStyle = p.accent;
    g.font = `800 200px ${font}`;
    g.fillText(String(opts.value), cx, cy + 60);

    g.fillStyle = p.ink;
    g.font = `800 56px ${font}`;
    g.fillText(opts.unit, cx, cy + 145);

    g.fillStyle = p.muted;
    g.font = `400 38px ${font}`;
    g.fillText(opts.dateText, cx, 840);
    g.font = `700 34px ${font}`;
    g.fillStyle = p.accent;
    g.fillText('הספירה', cx, 940);
    return c;
  }

  function toBlob(canvas) {
    return new Promise(res => canvas.toBlob(res, 'image/png'));
  }

  async function share(state) {
    const ev = store.heroEvent(state);
    if (!ev) return;
    const today = dates.todayISO();
    const unit = state.unit || 'days';
    const value = dates.unitValue(unit, today, ev.date);
    const pct = state.profile
      ? dates.progressPct(state.profile.enlistDate, state.profile.releaseDate, today) : 0;
    const canvas = draw({
      title: ev.title, value, unit: dates.unitName(unit, value),
      dateText: dates.formatHe(ev.date), pct, dark: state.theme === 'dark',
    });
    const blob = await toBlob(canvas);
    const file = new File([blob], 'ha-sfira.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; }
      catch (e) { return; }              // the user dismissed the share sheet
    }
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ha-sfira.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { draw, share };
})();
</script>
```

- [ ] **Step 2: Wire it into settings**

ב-`render.settings`, בשורת הכפתורים של השיתוף, הוסף כפתור:

```html
        <button class="btn" id="sCard" type="button">שתף כתמונה</button>
```

ואת ה-handler:

```js
    box.querySelector('#sCard').onclick = () => card.share(state);
```

- [ ] **Step 3: Verify the canvas actually renders**

Run:
```bash
cat > /tmp/sc-card.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const page = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
await page.goto('http://localhost:8899/service-countdown/index.html');
const dataUrl = await page.evaluate(() => card.draw({
  title:'שחרור', value:464, unit:'ימים', dateText:'15 בנובמבר 2027', pct:52, dark:true
}).toDataURL('image/png'));
writeFileSync('/tmp/sc-card.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('card bytes:', Buffer.from(dataUrl.split(',')[1],'base64').length);
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-card.mjs
```

Expected: `card bytes:` מעל 20000. פתח את `/tmp/sc-card.png` וּודא שהעברית מיושרת
נכון, שהטבעת מלאה ב-52% ושאין טקסט חתוך.

- [ ] **Step 4: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): shareable countdown card drawn on canvas"
```

---

## Task 20: העברה למכשיר חדש בקישור — בלי ענן

**למה:** "אין ענן ואין חשבון" זה יתרון עד שמחליפים טלפון. קובץ גיבוי דורש לנווט
במערכת קבצים בנייד; קישור אפשר לשלוח לעצמך בוואטסאפ ולפתוח בצד השני.

**Files:**
- Modify: `service-countdown/index.html` — `store.encodeState`/`decodeState`,
  `render.settings`, bootstrap
- Test: `service-countdown/test/dates.test.mjs` (כולל הרחבת ה-sandbox)

**Interfaces:**
- Produces: `store.encodeState(state) -> string` (base64url ללא ריפוד);
  `store.decodeState(text) -> state` (זורק על קלט פגום)

- [ ] **Step 1: Extend the test sandbox**

ב-`service-countdown/test/dates.test.mjs`, החלף את שורת ה-sandbox:

```js
const sandbox = { Math, Date, String, Number, JSON, Error, Array, Uint8Array,
                  TextEncoder, TextDecoder, btoa, atob, localStorage: makeLS() };
```

- [ ] **Step 2: Write the failing tests**

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `store.encodeState is not a function`.

- [ ] **Step 4: Implement**

ב-`store`, אחרי `importJSON`:

```js
  // base64url of the UTF-8 JSON. Not encryption and not claimed to be: the
  // payload is enlistment dates, and the link only ever leaves the device
  // because the user chose to send it.
  function encodeState(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeState(text) {
    if (!text) throw new Error('קישור ריק');
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return importJSON(new TextDecoder().decode(bytes));
  }
```

והוסף את שתיהן ל-`return` של `store`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `59 passed`.

- [ ] **Step 6: Produce the link from settings**

ב-`render.settings`, הוסף ליד "ייצא גיבוי":

```html
        <button class="btn" id="sLink" type="button">קישור העברה</button>
```

ואת ה-handler:

```js
    box.querySelector('#sLink').onclick = async () => {
      const url = location.origin + location.pathname + '#t=' + store.encodeState(state);
      if (url.length > 8000) { err.textContent = 'יותר מדי אירועים לקישור — השתמשו בגיבוי'; return; }
      try {
        if (navigator.share) await navigator.share({ text: url });
        else { await navigator.clipboard.writeText(url); err.textContent = 'הקישור הועתק'; }
      } catch (e) { /* dismissed */ }
    };
```

- [ ] **Step 7: Consume the link on open**

בבלוק ה-bootstrap, **לפני** `let state = store.load();` אי אפשר — `store` כבר טעון,
אז הוסף מיד **אחרי** `let state = store.load();`:

```js
// An incoming transfer link never overwrites silently: this device may already
// hold a service someone is counting.
if (location.hash.startsWith('#t=')) {
  const code = location.hash.slice(3);
  history.replaceState(null, '', location.pathname);
  try {
    const incoming = store.decodeState(code);
    const hasData = state.profile || state.events.length > 0;
    if (!hasData || confirm('הקישור מכיל ספירה אחרת. להחליף את מה שיש במכשיר?')) {
      Object.assign(state, incoming);
      store.save(state);
    }
  } catch (e) { /* a broken link must not break the page */ }
}
```

- [ ] **Step 8: Verify the round trip in a real browser**

Run:
```bash
cat > /tmp/sc-link.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
await page.goto('http://localhost:8899/service-countdown/index.html');
const code = await page.evaluate(() => store.encodeState({
  v:1, profile:{enlistDate:'2025-03-15',releaseDate:'2027-11-15',gender:'m',months:32},
  events:[{id:'a',title:'מסע כומתה',date:'2026-09-01',icon:'star',source:'template',every:null}],
  heroId:'release', theme:'dark', unit:'days' }));
const fresh = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
fresh.on('dialog', d => d.accept());
await fresh.goto('http://localhost:8899/service-countdown/index.html#t=' + code);
await fresh.waitForTimeout(400);
console.log('profile landed:', await fresh.evaluate(() =>
  JSON.parse(localStorage.getItem('service-countdown.v1')).profile.releaseDate));
console.log('hash cleaned:', await fresh.evaluate(() => location.hash === ''));
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-link.mjs
```

Expected:
```
profile landed: 2027-11-15
hash cleaned: true
```

- [ ] **Step 9: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): move a countdown to a new device with a link"
```

---

## Task 21: צבע כומתה — אקסנט אישי

**למה:** ההתאמה האישית היחידה שאפשר לתת בלי לשבור את השפה העיצובית. סט סגור של
חמישה גוונים מאופקים, כולם ממשפחת האוסף — לא בורר צבע חופשי.

**Files:**
- Modify: `service-countdown/index.html` — CSS (`:root[data-accent]`), `store.blank`,
  `render.settings`, `paintTheme`

**Interfaces:**
- שדה חדש: `state.accent: 'amber' | 'olive' | 'maroon' | 'steel' | 'navy'`, ברירת מחדל `'amber'`.
  `paintTheme()` כותב `data-accent` על `:root`.

- [ ] **Step 1: Define the closed palette**

בבלוק ה-`<style>`, מיד אחרי בלוק ה-`:root[data-theme="dark"]`:

```css
/* A closed set, all from the collection's muted family. The default stays
   amber -- it is the tool's identity on the landing page. */
:root[data-accent="olive"]  { --accent:#4b5320 }
:root[data-accent="maroon"] { --accent:#7a3b32 }
:root[data-accent="steel"]  { --accent:#3d6b6b }
:root[data-accent="navy"]   { --accent:#3d4a6b }
:root[data-theme="dark"][data-accent="olive"]  { --accent:#b3c256 }
:root[data-theme="dark"][data-accent="maroon"] { --accent:#d98878 }
:root[data-theme="dark"][data-accent="steel"]  { --accent:#5f9a9a }
:root[data-theme="dark"][data-accent="navy"]   { --accent:#8593c4 }
.swatch{width:36px; height:36px; border-radius:50%; border:2px solid var(--line-strong);
  cursor:pointer; padding:0}
.swatch.on{border-color:var(--ink); box-shadow:0 0 0 3px color-mix(in srgb, var(--ink) 15%, transparent)}
```

- [ ] **Step 2: Store and paint it**

ב-`store.blank()` הוסף `accent: 'amber'`.

ב-`paintTheme()`, אחרי שורת ה-`data-theme`:

```js
  document.documentElement.setAttribute('data-accent', state.accent || 'amber');
```

- [ ] **Step 3: Add the picker to settings**

ב-`render.settings`, אחרי שורת "ערוך תאריכי שירות":

```html
      <div>
        <label>צבע</label>
        <div class="row" id="sAccent"></div>
      </div>
```

ואת ה-handler:

```js
    const ACCENTS = [
      { key: 'amber',  light: '#8a5a12', dark: '#e0a33c', name: 'ענבר' },
      { key: 'olive',  light: '#4b5320', dark: '#b3c256', name: 'זית' },
      { key: 'maroon', light: '#7a3b32', dark: '#d98878', name: 'בורדו' },
      { key: 'steel',  light: '#3d6b6b', dark: '#5f9a9a', name: 'פלדה' },
      { key: 'navy',   light: '#3d4a6b', dark: '#8593c4', name: 'כחול' },
    ];
    const accentRow = box.querySelector('#sAccent');
    for (const a of ACCENTS) {
      const b = el('button', { class: 'swatch', type: 'button', 'aria-label': a.name });
      b.style.background = state.theme === 'dark' ? a.dark : a.light;
      b.onclick = () => {
        state.accent = a.key;
        store.save(state);
        accentRow.querySelectorAll('.swatch').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        refresh();
      };
      if ((state.accent || 'amber') === a.key) b.classList.add('on');
      accentRow.append(b);
    }
```

- [ ] **Step 4: Verify both schemes, then commit**

Run:
```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-accent-d.png dark 390 && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-accent-l.png light 390
```
Expected: `overflow=false console_errors=[]` בשתיהן.

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): a closed set of accent colours"
```

---

## Task 22: פאנל "כמה שירתת"

**למה:** הכלי מחזיק את כל הנתונים כדי לומר משפט אחד שאף אחד לא אמר למשתמש:
כמה ימים, כמה שבתות, וכמה נשאר — ולא רק מספר בודד.

**Files:**
- Modify: `service-countdown/index.html` — `dates.countWeekday`, `render.stats`,
  markup (`<section id="stats">`), CSS, bootstrap
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.countWeekday(fromISO, toISO, dow) -> number` (כולל שני הקצוות,
  `dow` 0=ראשון...6=שבת); `render.stats(state) -> void`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.countWeekday is not a function`.

- [ ] **Step 3: Implement**

ב-`dates`, אחרי `momentFor`:

```js
  // Inclusive count of one weekday in a range, by arithmetic rather than by
  // walking a thousand days one Date at a time.
  function countWeekday(fromISO, toISO, dow) {
    const total = daysBetween(fromISO, toISO) + 1;
    if (total <= 0) return 0;
    const offset = (dow - parse(fromISO).getDay() + 7) % 7;
    if (offset >= total) return 0;
    return Math.floor((total - offset - 1) / 7) + 1;
  }
```

והוסף `countWeekday` ל-`return` של `dates`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `61 passed`.

- [ ] **Step 5: Add the panel**

ב-markup, אחרי `<section class="panel" id="timeline"></section>`:

```html
  <section class="panel" id="stats"></section>
```

ב-`render`, אחרי `function timeline(state)`:

```js
  function stats(state) {
    const host = document.getElementById('stats');
    host.innerHTML = '';
    if (!state.profile) return;
    const p = state.profile, today = dates.todayISO();
    const served = Math.max(0, dates.daysBetween(p.enlistDate, today));
    const left = Math.max(0, dates.daysBetween(today, p.releaseDate));
    const upTo = served > 0 ? today : p.enlistDate;

    host.append(el('h2', {}, 'כמה כבר עשית'));
    const grid = el('div', { class: 'stats' });
    const rows = [
      ['ימים בשירות', String(served)],
      ['חודשים בשירות', String(Math.max(0, dates.monthsBetween(p.enlistDate, today)))],
      ['שבתות שעברו', String(dates.countWeekday(p.enlistDate, upTo, 6))],
      ['ימים שנשארו', String(left)],
    ];
    for (const [label, value] of rows) {
      const cell = el('div', { class: 'stat' });
      cell.append(el('div', { class: 'stat-n' }, value));
      cell.append(el('div', { class: 'stat-l' }, label));
      grid.append(cell);
    }
    host.append(grid);
  }
```

והוסף `stats` ל-`return` של `render`, ואת `render.stats(state);` ל-`refresh()`
בבלוק ה-bootstrap, מיד אחרי `render.timeline(state);`.

- [ ] **Step 6: Style it**

```css
.stats{display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:.6rem}
.stat{padding:.9rem; border-radius:var(--r); background:var(--card);
  border:1px solid var(--line); box-shadow:var(--shadow)}
.stat-n{font-size:1.6rem; font-weight:800; color:var(--accent);
  font-variant-numeric:tabular-nums; line-height:1.1}
.stat-l{color:var(--muted); font-size:.85rem; margin-top:.2rem}
```

- [ ] **Step 7: Verify and commit**

Run:
```bash
node service-countdown/test/dates.test.mjs && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-stats.png dark 320
```
Expected: `61 passed`, `overflow=false console_errors=[]`

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): service statistics panel"
```

---

## Task 23: שער שחרור ל-v3

**Files:**
- Modify: `service-countdown/sw.js:4`, `README.md`, `.claude/PROJECT_LESSONS.md`

- [ ] **Step 1: Bump the cache**

```js
const CACHE = "sc-v3";
```

- [ ] **Step 2: Update the README entry**

ב-`README.md`, הוסף לתיאור של `service-countdown/`:

```markdown
  כולל ספירה חיה בשניות (לחיצה ארוכה), אירועים חוזרים, כרטיס שיתוף כתמונה,
  קישור העברה בין מכשירים, ופאנל "כמה כבר עשית".
```

- [ ] **Step 3: Update the lessons file**

הוסף לסעיף "מלכודות ספציפיות לכלים":

```markdown
- **`service-countdown` — אירוע חוזר מתגלגל בתצוגה, לא באחסון.** `store.allEvents`
  מחשב `nextOccurrence` ומחזיר `date` מגולגל + `baseDate` מקורי; כתיבת התאריך
  החדש חזרה ל-`state.events` הייתה משכתבת היסטוריה ושוברת את ה-undo.
- **`service-countdown` — בדיקות שנוגעות ב-base64 צריכות sandbox מורחב.**
  `dates.test.mjs` מריץ ב-`node:vm` עם רשימת globals מפורשת; `encodeState`
  דורש `TextEncoder`, `TextDecoder`, `btoa`, `atob`, `Uint8Array` ו-`Array`.
```

ולסעיף "היסטוריית שינויים גדולים":

```markdown
- **08/08/2026 (v3):** שכבת פיצ'רים ל`service-countdown` — טבעת התקדמות אמיתית,
  ספירה חיה בשניות עם Wake Lock, אירועים חוזרים, רגעי ציון דרך ("עברת את חצי
  הפז״מ"), כרטיס שיתוף מצויר ב-canvas, קישור העברה בין מכשירים (base64url ב-hash),
  סט אקסנטים סגור ופאנל סטטיסטיקות. תוכנית:
  `docs/superpowers/plans/2026-08-08-service-countdown-v3-features.md`.
```

- [ ] **Step 4: Full gate**

Run:
```bash
node service-countdown/test/dates.test.mjs && \
node service-countdown/test/ics.test.mjs && \
node .claude/tools/verify-all.mjs
```
Expected: `61 passed`, `7 passed`, `✅ verify-all: all checks passed`

- [ ] **Step 5: Push and merge**

```bash
git add service-countdown/sw.js README.md .claude/PROJECT_LESSONS.md
git commit -m "chore(countdown): bump SW cache to v3, update docs"
git push -u origin claude/countdown-app-improvement-plan-wm95hm
git fetch origin main
git merge-base --is-ancestor origin/main claude/countdown-app-improvement-plan-wm95hm && \
  git push origin claude/countdown-app-improvement-plan-wm95hm:main
```

---

## Self-Review

**ספירת בדיקות מצטברת:** v2 מסתיים ב-49. משימה 16 מוסיפה 2 (51), 17 מוסיפה 4 (55),
18 מוסיפה 2 (57), 20 מוסיפה 2 (59), 22 מוסיפה 2 (61). משימות 15, 19, 21 ויזואליות
בלבד ונבדקות ב-headless — אין להן בדיקות יחידה, וזה מכוון.

**עקביות טיפוסים:** `store.allEvents(state, todayISO?)` — החתימה משתנה במשימה 17;
כל הקוראים (`heroEvent`, `render.events`, `render.timeline`, ייצוא `.ics`) ממשיכים
לקרוא בלי הפרמטר ומקבלים את ברירת המחדל. `render.openSheet(node, onClose?)` —
הפרמטר השני מוגדר ב-v2 ונצרך לראשונה כאן במשימה 16. `dates.unitName`/`unitValue`
מ-v2 נצרכים במשימות 15 ו-19.

**תלויות:** 18 ← 15 (`.hero-ring .fill` הוא היעד של `celebrate`) · 16 ← v2/11
(`openSheet`) · 19 ← v2/5 (`unitValue`) · 17 ← v2/12 (`eventSheet`) ·
20 ← v2/1 (`importJSON` כשער הוולידציה). 15, 21, 22 עצמאיות.

**מה נבדק ידנית בלבד:** Wake Lock (headless לא נותן מסך אמיתי), `navigator.share`
(דורש מחווה של משתמש ומערכת אמיתית), `navigator.vibrate` (אנדרואיד בלבד).
שלושתם עטופים ב-feature detection ובנפילה רכה, ולכן כשל שלהם אינו יכול לשבור את הדף.

**מה עדיין בחוץ:** וידג'ט מסך-בית ואייקון דינמי (אין API ל-PWA), שרת Push,
חשבון וסנכרון ענן, וכל פיצ'ר קהילתי/מסחרי של המתחרה.
