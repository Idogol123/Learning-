# "הספירה" v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להפוך את `service-countdown` מכלי שמציג מספר לכלי שסופר — מספר שלא מתיישן,
מצביע על האירוע הנכון, קריא בכל רוחב, ניתן לקריאה גם בלי לפתוח את האפליקציה.

**Architecture:** הכלי נשאר `index.html` עצמאי אחד עם אותם ארבעה מודולים
(`dates`, `store`, `render`, `motion`) ושני מודולים חדשים (`clock`, `ics`). כל לוגיקה
חדשה שאפשר לבדוק בלי דפדפן נכנסת ל-`dates`/`store`/`ics` — שלושת המודולים שהבדיקה
ב-`test/dates.test.mjs` מחלצת מה-HTML ומריצה ב-`node:vm`. שינויי DOM נכנסים
ל-`render`/`motion` ונבדקים בשער האיכות ה-headless.

**Tech Stack:** HTML/CSS/JS ללא תלויות, ללא שלב בנייה, ללא רשת. בדיקות: `node:test`-less
harness ידני (`node:assert/strict` + `node:vm`) בדפוס הקיים בריפו. שער איכות:
`node .claude/tools/verify-all.mjs`.

**מקור הדרישות:** [ביקורת המוצר, 08/08/2026](../specs/2026-08-08-service-countdown-review.md).
כל משימה כאן מסומנת במזהה הממצא שהיא סוגרת (P0-1 וכו').

## Global Constraints

- **אפס בקשות רשת.** לא CDN, לא Google Fonts, לא תמונות מרוחקות, לא API, לא טלמטריה.
  כולל favicon — חייב להיות `data:` URI מוטמע.
- **אפס תלויות, אפס שלב בנייה.** הכל בתוך `service-countdown/index.html`.
- **גופנים:** מחסנית מערכת בלבד — `system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Hebrew",Arial,sans-serif`.
- **אייקונים:** Lucide inline בלבד, דרך המפה `ICONS` שכבר בקובץ. לא אימוג'י, לא SVG מצויר ביד.
- **טוקני עיצוב:** אין להמציא צבעים. אקסנט ענבר `#8a5a12` (בהיר) / `#e0a33c` (כהה),
  `--ease:cubic-bezier(.16,1,.3,1)`, `--r:16px`. ברירת מחדל כהה נשארת.
- **עברית RTL, mobile-first.** כל מידה לוגית (`inset-inline-*`, `padding-inline-*`),
  לא `left`/`right`.
- **רישום service worker חייב לשמור על שומר-הפרוטוקול:**
  `if ('serviceWorker' in navigator && location.protocol.startsWith('http'))` **וגם** `.catch(() => {})`.
  בלעדיו שער האיכות (שמרנדר ב-`file://`) נופל.
- **חשבון תאריכים לעולם לא דרך `+ n*86400000`.** רק דרך `new Date(y,m,d+n)` ו-`Math.round`.
- **`localStorage` נשאר מפתח יחיד `service-countdown.v1` עם `v:1`.** אין מיגרציית סכימה
  בתוכנית הזו — שדות חדשים נוספים עם ברירת מחדל ב-`blank()`, כך ש-`Object.assign(blank(), s)`
  ממלא אותם לנתונים ישנים.
- **לפני כל commit:** `node service-countdown/test/dates.test.mjs` וגם
  `node .claude/tools/verify-all.mjs --structural` חייבים לעבור.
- **`sw.js`:** `const CACHE` מבומפ פעם אחת בלבד לאורך כל התוכנית — במשימה 14.
- **ענף עבודה:** `claude/countdown-app-improvement-plan-wm95hm`.

## File Structure

| קובץ | אחריות | שינוי |
|---|---|---|
| `service-countdown/index.html` | הכלי כולו | מורחב — כל המשימות |
| `service-countdown/test/dates.test.mjs` | בדיקות `dates` + `store` | מורחב — משימות 1,2,3,5,7,9 |
| `service-countdown/test/ics.test.mjs` | בדיקות בניית קובץ יומן | **נוצר** — משימה 9 |
| `service-countdown/sw.js` | מטמון PWA | באמפ גרסה — משימה 12 |
| `service-countdown/manifest.webmanifest` | מניפסט | ללא שינוי |
| `README.md`, `.claude/PROJECT_LESSONS.md` | תיעוד | משימה 12 |

בתוך `index.html` הסדר נשמר: `dates` → `store` → `render` → `motion` → `clock` (חדש)
→ `ics` (חדש) → bootstrap. `clock` ו-`ics` נכנסים כבלוקי `<script>` נפרדים, בדפוס
הקיים, כדי שה-regex של הבדיקות ימשיך לחלץ כל מודול בנפרד.

---

## Task 1: נפילת-גיבור לאירוע הקרוב (P0-2)

**Files:**
- Modify: `service-countdown/index.html:291-295` (`store.heroEvent`)
- Test: `service-countdown/test/dates.test.mjs:216-225`

**Interfaces:**
- Produces: `store.heroEvent(state, todayISO?) -> event | null`. הפרמטר השני אופציונלי
  ומוגדר כברירת מחדל ל-`dates.todayISO()`; קיים כדי שהבדיקות יהיו דטרמיניסטיות.
  כל הקוראים הקיימים (`render.hero`) ממשיכים לעבוד בלי שינוי.

- [ ] **Step 1: Write the failing tests**

הוסף ב-`service-countdown/test/dates.test.mjs` מיד אחרי המבחן
`heroEvent falls back when heroId points at nothing`:

```js
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
```

ובנוסף — הפוך את המבחן הקיים לדטרמיניסטי: ב-
`t('heroEvent falls back when heroId points at nothing', ...)` החלף את השורה
`assert.equal(store.heroEvent(s).id, 'a');` ב-
`assert.equal(store.heroEvent(s, '2026-08-08').id, 'a');`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `heroEvent falls back to the NEXT UPCOMING event` נופל עם
`Expected values to be strictly equal: 'past' !== 'soon'`.

- [ ] **Step 3: Implement**

ב-`service-countdown/index.html`, החלף את `heroEvent` כולה:

```js
  // Falls back to the NEXT UPCOMING event, and only then to the most recent
  // past one. Falling back to list[0] (the earliest date) made a deleted hero
  // hand the main screen to an event that is long over -- the screen read
  // "סוף טירונות · 424 · ימים מאז", which is not what anyone opens this for.
  function heroEvent(state, todayISO) {
    const list = allEvents(state);
    if (list.length === 0) return null;
    const chosen = list.find(e => e.id === state.heroId);
    if (chosen) return chosen;
    const today = todayISO || dates.todayISO();
    return list.find(e => e.date >= today) || list[list.length - 1];
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `31 passed`, ללא שורות `FAIL`.

- [ ] **Step 5: Verify the quality gate**

Run: `node .claude/tools/verify-all.mjs --structural`
Expected: `✅ verify-all: all checks passed`

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "fix(countdown): fall back to the next upcoming event, not the earliest"
```

---

## Task 2: שעון חי — המספר לא מתיישן (P0-1)

**Files:**
- Modify: `service-countdown/index.html` — הוספת `msUntilNextMidnight` ל-`dates`,
  בלוק `<script>` חדש למודול `clock` אחרי בלוק `motion`, וקריאה ב-bootstrap
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Consumes: `dates.todayISO()`
- Produces: `dates.msUntilNextMidnight(now: Date) -> number`;
  `clock.init(onNewDay: () => void) -> void`

- [ ] **Step 1: Write the failing tests**

הוסף ב-`service-countdown/test/dates.test.mjs` אחרי בלוק `addMonths`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.msUntilNextMidnight is not a function`.

- [ ] **Step 3: Implement the pure function**

ב-`index.html`, בתוך המודול `dates`, מיד אחרי `addMonths`:

```js
  // Milliseconds from `now` to the next local midnight. Built through the Date
  // constructor for the same reason addDays is: on a DST night the distance to
  // midnight is 23 or 25 hours, and a hardcoded 86400000 drifts the daily
  // re-render by an hour in each direction.
  function msUntilNextMidnight(now) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }
```

והוסף אותה ל-`return`:

```js
  return { parse, toISO, todayISO, daysBetween, addDays, addMonths, msUntilNextMidnight,
           progressPct, hebrewDays, remainingLabel, formatHe };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `33 passed`.

- [ ] **Step 5: Add the `clock` module**

הוסף בלוק `<script>` חדש ב-`index.html` מיד אחרי הבלוק של `motion` ולפני
בלוק ה-bootstrap:

```html
<script>
/* ---------- clock: keeps the number honest without a reload ---------- */
const clock = (() => {
  let timer = null;
  let day = null;

  function schedule(onNewDay) {
    if (timer) clearTimeout(timer);
    // +1s of slack: firing a hair before midnight would compute the same day
    // again and reschedule in a tight loop.
    const ms = dates.msUntilNextMidnight(new Date()) + 1000;
    timer = setTimeout(() => tick(onNewDay), ms);
  }

  function tick(onNewDay) {
    const today = dates.todayISO();
    if (today !== day) { day = today; onNewDay(); }
    schedule(onNewDay);
  }

  // An installed PWA is suspended, not closed. Coming back to it after a day
  // in the background is the common case where the number on screen is a day
  // (or a week) stale -- which is the one thing a countdown may not do.
  function init(onNewDay) {
    day = dates.todayISO();
    schedule(onNewDay);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick(onNewDay);
    });
    window.addEventListener('pageshow', () => tick(onNewDay));
  }

  return { init };
})();
</script>
```

- [ ] **Step 6: Wire it into the bootstrap**

ב-`index.html`, בבלוק האחרון, מיד אחרי `motion.init();`:

```js
clock.init(refresh);
```

- [ ] **Step 7: Verify in the browser**

Run:
```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-clock.png dark 390
```
Expected: `overflow=false console_errors=[]`

- [ ] **Step 8: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "fix(countdown): recompute the day count at midnight and on resume"
```

---

## Task 3: מחיקה עם ביטול (P0-3)

**Files:**
- Modify: `service-countdown/index.html` — `store` (הוספת `removeEvent`/`restoreEvent`),
  CSS (`.toast`), `render.events` (החלפת ה-handler), `render` (הוספת `toast`)
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `store.removeEvent(state, id) -> event | null` (מוציא מהמערך ומחזיר את
  שהוסר); `store.restoreEvent(state, ev) -> boolean` (מחזיר `false` אם `ev` ריק או
  שה-id כבר קיים); `render.toast(message, actionLabel, onAction) -> void`

- [ ] **Step 1: Write the failing tests**

הוסף ב-`service-countdown/test/dates.test.mjs` בסוף בלוק ה-`store`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `store.removeEvent is not a function`.

- [ ] **Step 3: Implement the store functions**

ב-`index.html`, בתוך המודול `store`, אחרי `heroEvent`:

```js
  // Removal returns the row so the caller can offer an undo. Deleting a
  // milestone is one tap next to the row's own tap target; without an undo a
  // mis-tap is silent data loss, and there is no cloud copy to fall back on.
  function removeEvent(state, id) {
    const i = state.events.findIndex(e => e.id === id);
    if (i === -1) return null;
    return state.events.splice(i, 1)[0];
  }

  function restoreEvent(state, ev) {
    if (!ev || state.events.some(e => e.id === ev.id)) return false;
    state.events.push(ev);
    return true;
  }
```

והוסף אותן ל-`return`:

```js
  return { KEY, blank, load, save, allEvents, heroEvent, removeEvent, restoreEvent,
           exportJSON, importJSON };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `35 passed`.

- [ ] **Step 5: Add the toast CSS**

ב-`index.html`, בבלוק ה-`<style>`, אחרי הכלל `.ev-row+.ev-row`:

```css
.toast{position:fixed; inset-inline:1rem; z-index:40;
  inset-block-end:calc(1rem + env(safe-area-inset-bottom));
  display:flex; align-items:center; gap:.75rem; padding:.85rem 1rem;
  border-radius:var(--r); background:var(--card); color:var(--ink);
  border:1px solid var(--line-strong); box-shadow:var(--shadow);
  animation:toast-in .25s var(--ease)}
.toast span{flex:1; min-width:0; font-size:.95rem}
.toast button{background:transparent; border:0; padding:.2rem .1rem; font:inherit;
  font-weight:800; color:var(--accent); cursor:pointer}
@keyframes toast-in{from{transform:translateY(1rem); opacity:0} to{transform:none; opacity:1}}
```

- [ ] **Step 6: Add the toast renderer**

ב-`index.html`, בתוך המודול `render`, לפני `function events(...)`:

```js
  let toastTimer = null;

  // One toast at a time: a second delete replaces the first, and the first
  // deletion is then final. Six seconds is long enough to notice and reach.
  function toast(message, actionLabel, onAction) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    if (toastTimer) clearTimeout(toastTimer);
    const box = el('div', { class: 'toast', role: 'status' });
    box.append(el('span', {}, message));
    const btn = el('button', { type: 'button' }, actionLabel);
    btn.onclick = () => { clearTimeout(toastTimer); box.remove(); onAction(); };
    box.append(btn);
    document.body.append(box);
    toastTimer = setTimeout(() => box.remove(), 6000);
  }
```

והוסף `toast` ל-`return` של `render`:

```js
  return { hero, wizard, timeline, events, addSheet, settings, toast };
```

- [ ] **Step 7: Use it in the delete handler**

ב-`render.events`, החלף את `del.onclick` כולה:

```js
        del.onclick = () => {
          const removed = store.removeEvent(state, ev.id);
          store.save(state);
          refresh();
          toast(`"${removed.title}" נמחק`, 'ביטול', () => {
            store.restoreEvent(state, removed);
            store.save(state);
            refresh();
          });
        };
```

- [ ] **Step 8: Verify in the browser**

Run:
```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-toast.png light 390
```
Expected: `overflow=false console_errors=[]`

- [ ] **Step 9: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): undo for event deletion"
```

---

## Task 4: כותרת דביקה במקום הוואקום (P1-4)

**Files:**
- Modify: `service-countdown/index.html` — markup (`.hero-mini`), CSS, `render.hero`, `motion`

**Interfaces:**
- Consumes: `store.heroEvent`, `dates.daysBetween`
- Produces: `render.miniText(state) -> string` (HTML של הכותרת הדביקה);
  `motion.setCollapse(t: number)` נשאר פנימי ל-`motion`

- [ ] **Step 1: Add the sticky bar markup**

ב-`index.html`, מיד אחרי `<main id="app">` ולפני `<div class="topbar">`:

```html
<div class="hero-mini" id="heroMini" aria-hidden="true"></div>
```

- [ ] **Step 2: Add the CSS**

בבלוק ה-`<style>`, אחרי הכלל `.rolling`:

```css
.hero-mini{
  position:fixed; inset-block-start:0; inset-inline:0; z-index:9;
  display:flex; align-items:center; justify-content:center; gap:.45rem;
  padding:calc(.55rem + env(safe-area-inset-top)) 4.5rem .55rem;
  font-weight:800; font-size:.95rem;
  background:color-mix(in srgb, var(--bg) 84%, transparent);
  -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
  border-block-end:1px solid var(--line);
  opacity:0; transform:translateY(-101%); pointer-events:none;
  transition:opacity .2s var(--ease), transform .2s var(--ease);
}
.hero-mini.on{opacity:1; transform:none}
.hero-mini b{color:var(--accent); font-variant-numeric:tabular-nums}
.hero-mini em{font-style:normal; color:var(--muted); font-weight:400}
```

הערה על ה-`padding` הצדדי: `4.5rem` שומר מקום לשני כפתורי ה-topbar (2×40px + רווח)
כך שהטקסט לא נכנס מתחתם.

- [ ] **Step 3: Fill the bar from the hero renderer**

ב-`render.hero`, מיד אחרי `const ev = store.heroEvent(state);` הוסף:

```js
    const mini = document.getElementById('heroMini');
```

ובתוך ה-`if (!ev)` הוסף לפני ה-`return`:

```js
      mini.innerHTML = '';
```

ובסוף `hero()` (אחרי הוספת ה-`scroll-hint`):

```js
    // The sticky bar carries the same number the hero shows, so scrolling to
    // the timeline never means losing the headline.
    mini.innerHTML = past
      ? `${ev.title} · <b>${Math.abs(left)}</b> <em>ימים מאז</em>`
      : `${ev.title} · <b>${Math.abs(left)}</b> <em>${left === 0 ? 'היום' : 'ימים'}</em>`;
```

- [ ] **Step 4: Toggle it from the scroll handler**

ב-`motion.init`, החלף את גוף ה-`requestAnimationFrame`:

```js
      requestAnimationFrame(() => {
        const t = Math.min(1, window.scrollY / (window.innerHeight * 0.6));
        hero.style.setProperty('--t', t.toFixed(3));
        const mini = document.getElementById('heroMini');
        if (mini) {
          const on = t > 0.72;
          mini.classList.toggle('on', on);
          mini.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
        ticking = false;
      });
```

ובנוסף — `motion.init` יוצא מוקדם כש-`prefers-reduced-motion` דלוק, ואז הכותרת
הדביקה לא תופיע לעולם. החלף את `if (reduce) return;` ב:

```js
    // Reduced motion removes the collapse animation, not the sticky header:
    // the header is information, not decoration.
    const animate = !reduce;
```

והחלף את שורת ה-`--t` כך שתכובד רק כשמותר להנפיש:

```js
        if (animate) hero.style.setProperty('--t', t.toFixed(3));
```

- [ ] **Step 5: Verify in the browser, scrolled**

Run:
```bash
cat > /tmp/sc-scroll.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const page = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
page.on('dialog', d => d.accept());
await page.goto('http://localhost:8899/service-countdown/index.html');
await page.evaluate(() => localStorage.setItem('service-countdown.v1', JSON.stringify({
  v:1, profile:{enlistDate:'2025-03-15',releaseDate:'2027-11-15',gender:'m'},
  events:[{id:'e1',title:'מסע כומתה',date:'2026-09-01',icon:'star',source:'template'}],
  heroId:'release', theme:'dark' })));
await page.reload(); await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, window.innerHeight));
await page.waitForTimeout(400);
console.log('mini visible:', await page.locator('#heroMini.on').count() === 1);
console.log('mini text:', (await page.locator('#heroMini').textContent()).trim());
await page.screenshot({ path: '/tmp/sc-sticky.png' });
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-scroll.mjs
```

Expected:
```
mini visible: true
mini text: שחרור · 464 ימים
```

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): sticky mini header so the count survives scrolling"
```

---

## Task 5: החלפת יחידות — ימים / שבועות / חודשים (P1-8)

**Files:**
- Modify: `service-countdown/index.html` — `dates` (שלוש פונקציות חדשות), `store.blank`,
  `render.hero`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces:
  - `dates.monthsBetween(fromISO, toISO) -> number` — חודשים שלמים, יכול להיות שלילי
  - `dates.unitValue(unit, fromISO, toISO) -> number` — ערך מוחלט ליחידה
    (`'days' | 'weeks' | 'months'`)
  - `dates.unitName(unit, n) -> string` — "ימים"/"יומיים"/"חודשיים"...
  - `dates.remainderLabel(unit, fromISO, toISO) -> string` — השארית מתחת ליחידה
    (`'ו-8 ימים'`), או מחרוזת ריקה
- `store.blank()` מקבל שדה חדש `unit: 'days'`

- [ ] **Step 1: Write the failing tests**

הוסף ב-`service-countdown/test/dates.test.mjs` אחרי בלוק `progressPct`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.monthsBetween is not a function`.

- [ ] **Step 3: Implement the pure functions**

ב-`index.html`, בתוך `dates`, אחרי `progressPct`:

```js
  // Whole calendar months. Walks the calendar rather than dividing days by 30:
  // 32 months of service is not 960 days, and the headline may not disagree
  // with the release date printed under it.
  function monthsBetween(fromISO, toISO) {
    const a = parse(fromISO), b = parse(toISO);
    let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return m;
  }

  function unitValue(unit, fromISO, toISO) {
    if (unit === 'weeks')  return Math.trunc(Math.abs(daysBetween(fromISO, toISO)) / 7);
    if (unit === 'months') return Math.abs(monthsBetween(fromISO, toISO));
    return Math.abs(daysBetween(fromISO, toISO));
  }

  function unitName(unit, n) {
    const a = Math.abs(n);
    if (unit === 'weeks')  return a === 1 ? 'שבוע'  : a === 2 ? 'שבועיים'  : 'שבועות';
    if (unit === 'months') return a === 1 ? 'חודש'  : a === 2 ? 'חודשיים' : 'חודשים';
    return a === 1 ? 'יום' : a === 2 ? 'יומיים' : 'ימים';
  }

  // "15 חודשים" alone hides a week; this is the tail the unit rounded away.
  function remainderLabel(unit, fromISO, toISO) {
    if (unit === 'days') return '';
    const [a, b] = daysBetween(fromISO, toISO) < 0 ? [toISO, fromISO] : [fromISO, toISO];
    let rest;
    if (unit === 'months') rest = daysBetween(addMonths(a, monthsBetween(a, b)), b);
    else                   rest = Math.abs(daysBetween(a, b)) % 7;
    if (rest === 0) return '';
    return rest === 2 ? 'ויומיים' : `ו-${rest} ${unitName('days', rest)}`;
  }
```

והרחב את ה-`return` של `dates`:

```js
  return { parse, toISO, todayISO, daysBetween, addDays, addMonths, msUntilNextMidnight,
           monthsBetween, unitValue, unitName, remainderLabel,
           progressPct, hebrewDays, remainingLabel, formatHe };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `40 passed`.

- [ ] **Step 5: Add `unit` to the stored state**

ב-`store.blank`, החלף את השורה:

```js
    return { v: 1, profile: null, events: [], heroId: 'release', theme: 'dark', unit: 'days' };
```

`Object.assign(blank(), s)` ב-`load` כבר ימלא `unit: 'days'` לכל מצב שמור ישן, ולכן
אין צורך במיגרציה.

- [ ] **Step 6: Make the hero number switch units on tap**

ב-`render.hero`, החלף את שלוש השורות שבונות את המספר והיחידה
(`host.append(el('div', { class: 'hero-num' ...` ועד ה-`hero-unit`):

```js
    const unit = state.unit || 'days';
    const value = dates.unitValue(unit, today, ev.date);
    const num = el('button', { class: 'hero-num', id: 'heroNum', type: 'button',
      'aria-live': 'polite', 'aria-label': 'החלף יחידת ספירה' }, String(value));
    num.onclick = () => {
      const order = ['days', 'weeks', 'months'];
      state.unit = order[(order.indexOf(unit) + 1) % order.length];
      store.save(state);
      refreshHero();
    };
    host.append(num);
    const rest = dates.remainderLabel(unit, today, ev.date);
    host.append(el('div', { class: 'hero-unit' },
      past ? `${dates.unitName(unit, value)} מאז ${ev.title}`
           : (value === 0 && unit === 'days' ? 'היום!'
              : `${dates.unitName(unit, value)}${rest ? ' ' + rest : ''}`)));
```

`refreshHero` הוא הפניה לפונקציה שמצייר מחדש רק את הגיבור. הוסף אותה בראש
המודול `render`, לפני `function hero(state)`:

```js
  // The hero is the only thing a unit switch changes; re-rendering the whole
  // page would also collapse the toast and reset the scroll position.
  let heroState = null;
  function refreshHero() { if (heroState) hero(heroState); }
```

ובתחילת `function hero(state)`, מיד אחרי `const host = ...`:

```js
    heroState = state;
```

- [ ] **Step 7: Style the number as a button without looking like one**

בבלוק ה-`<style>`, אחרי הכלל `.hero-num`:

```css
.hero-num{background:none; border:0; padding:0; font-family:inherit; cursor:pointer;
  display:block; margin-inline:auto}
.hero-num:focus-visible{outline:2px solid var(--accent); outline-offset:6px; border-radius:8px}
```

- [ ] **Step 8: Verify in the browser**

Run: `node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-units.png dark 390`
Expected: `overflow=false console_errors=[]`

- [ ] **Step 9: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): tap the number to count in days, weeks or months"
```

---

## Task 6: שורת אירוע שלא נשברת ב-320px (P1-5)

**Files:**
- Modify: `service-countdown/index.html` — CSS (`.ev*`), `render.events` (מבנה השורה)

**Interfaces:** אין ממשק חדש. `render.events` ממשיך לקבל `(state, refresh)`.

- [ ] **Step 1: Replace the row CSS**

בבלוק ה-`<style>`, החלף את הכללים `.ev`, `.ev-t`, `.ev-d`, `.ev-grow`, `.ev-days`:

```css
.ev{display:flex; align-items:center; gap:.7rem; width:100%; text-align:start;
  padding:.85rem; margin-bottom:.6rem; border-radius:var(--r);
  background:var(--card); border:1px solid var(--line); box-shadow:var(--shadow);
  color:inherit; font:inherit; cursor:pointer; flex-wrap:wrap;
  transition:transform .18s var(--ease), border-color .18s var(--ease)}
.ev:hover{transform:translateY(-1px); border-color:var(--line-strong)}
.ev:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.ev.soon{border-color:color-mix(in srgb, var(--accent) 45%, var(--line))}
/* Title and date are block-level inside their own column: as inline spans they
   wrapped mid-phrase at 320px ("סוף / טירונות", "10 / ביוני / 2025"). */
.ev-grow{display:flex; flex-direction:column; gap:.15rem; flex:1 1 7rem; min-width:0}
.ev-t{font-weight:800; overflow-wrap:anywhere}
.ev-d{color:var(--muted); font-size:.85rem}
.ev-days{font-weight:800; color:var(--accent); font-variant-numeric:tabular-nums;
  white-space:nowrap; flex:0 0 auto; margin-inline-start:auto}
```

- [ ] **Step 2: Drop the leading space that faked the gap**

ב-`render.events`, החלף:

```js
      mid.append(el('span', { class: 'ev-d' }, dates.formatHe(ev.date)));
```

(היה `' ' + ...` — הרווח היה מפריד ויזואלי בין שני span-ים inline, ועכשיו הוא מיותר.)

- [ ] **Step 3: Give the delete button a real tap target**

בבלוק ה-`<style>`, החלף את `.ev-del`:

```css
.ev-del{flex:none; width:40px; height:40px; display:inline-flex; align-items:center;
  justify-content:center; border-radius:10px; border:1px solid transparent;
  background:transparent; color:var(--muted); cursor:pointer; font:inherit; opacity:.6;
  transition:opacity .18s var(--ease), border-color .18s var(--ease)}
.ev-del:hover,.ev-del:focus-visible{opacity:1; border-color:var(--line-strong); color:var(--ink)}
```

- [ ] **Step 4: Verify at the narrow width**

Run:
```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-320.png dark 320
```
Expected: `overflow=false console_errors=[]`. פתח את `/tmp/sc-320.png` וּודא ששם
האירוע והתאריך יושבים כל אחד בשורה משלו, ומספר הימים בקצה — בלי שבירה באמצע ביטוי.

- [ ] **Step 5: Commit**

```bash
git add service-countdown/index.html
git commit -m "fix(countdown): stop the event row breaking apart on narrow screens"
```

---

## Task 7: מצב ריק שאפשר לפעול ממנו + חזרה לאוסף (P1-6, P1-9)

**Files:**
- Modify: `service-countdown/index.html` — markup (`.topbar`), `render.hero` (המצב הריק)

**Interfaces:**
- Consumes: `render.wizard(state, onDone)`, `render.addSheet(state, refresh)`
- `render.hero` נדרש מעכשיו לפרמטר שני: `hero(state, refresh)`. עדכן גם את
  `refreshHero()` ממשימה 5 כך שתחזיק את שניהם.

- [ ] **Step 1: Add the home button**

ב-`index.html`, בתוך `<div class="topbar">`, כשורה הראשונה:

```html
  <a class="iconbtn" href="../" aria-label="חזרה לאוסף הכלים" id="btnHome"></a>
```

ובבלוק ה-bootstrap, אחרי `btnSettings.innerHTML = icon('settings');`:

```js
document.getElementById('btnHome').innerHTML = icon('home');
```

ועדכן את ה-`padding` הצדדי של `.hero-mini` (משימה 4) מ-`4.5rem` ל-`7rem`, כי
ה-topbar מחזיק עכשיו שלושה כפתורים.

- [ ] **Step 2: Make the empty state actionable**

ב-`render.hero`, החלף את בלוק ה-`if (!ev)` כולו:

```js
    if (!ev) {
      mini.innerHTML = '';
      const start = el('button', { class: 'btn primary', type: 'button' }, 'הגדר תאריך שחרור');
      start.onclick = () => wizard(state, refresh);
      const add = el('button', { class: 'btn', type: 'button' }, 'הוסף אירוע');
      add.onclick = () => addSheet(state, refresh);
      const row = el('div', { class: 'row', style: 'justify-content:center' });
      row.append(start, add);
      host.append(
        el('div', { class: 'chip-ico' }, icon('plus')),
        el('h1', { class: 'hero-unit' }, 'עוד אין ספירה'),
        el('p', { class: 'hero-meta' }, 'התחילו מתאריך השחרור, או מכל אבן דרך אחרת'),
        row
      );
      return;
    }
```

- [ ] **Step 3: Thread `refresh` into the hero**

ב-`render`, החלף את חתימת הגיבור ואת ה-helper ממשימה 5:

```js
  let heroState = null, heroRefresh = null;
  function refreshHero() { if (heroState) hero(heroState, heroRefresh); }

  function hero(state, refresh) {
    const host = document.getElementById('hero');
    heroState = state; heroRefresh = refresh;
```

ובבלוק ה-bootstrap, ב-`refresh()`, החלף `render.hero(state);` ב:

```js
  render.hero(state, refresh);
```

- [ ] **Step 4: Verify the empty state has buttons**

Run:
```bash
cat > /tmp/sc-empty.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const page = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
await page.goto('http://localhost:8899/service-countdown/index.html');
await page.getByText('דלג').click(); await page.waitForTimeout(300);
console.log('empty-state CTA:', await page.locator('#hero button').count(), 'buttons');
console.log('home link:', await page.locator('#btnHome').getAttribute('href'));
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-empty.mjs
```

Expected:
```
empty-state CTA: 2 buttons
home link: ../
```

- [ ] **Step 5: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): actionable empty state and a way back to the hub"
```

---

## Task 8: ציר זמן פרופורציונלי לזמן, עם אירועי המשתמש (P1-7)

**Files:**
- Modify: `service-countdown/index.html` — `dates.axisGap`, `render.timeline`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.axisGap(prevISO, dateISO, spanDays, pxTotal, minPx) -> number` —
  המרווח בפיקסלים בין שני צמתים, פרופורציונלי לזמן, עם רצפה קריאה.

- [ ] **Step 1: Write the failing test**

הוסף ב-`service-countdown/test/dates.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.axisGap is not a function`.

- [ ] **Step 3: Implement**

ב-`index.html`, בתוך `dates`, אחרי `remainderLabel`:

```js
  // Vertical distance between two nodes on the service axis. The old timeline
  // spaced nodes evenly and then drew a fill at `pct%` of the LIST's pixel
  // height -- so the fill and the "you are here" marker agreed only by
  // coincidence. Spacing by elapsed time makes the axis mean something, and the
  // floor keeps two same-week milestones from colliding.
  function axisGap(prevISO, dateISO, spanDays, pxTotal, minPx) {
    if (spanDays <= 0) return minPx;
    const d = daysBetween(prevISO, dateISO);
    if (d <= 0) return minPx;
    return Math.max(minPx, Math.round((d / spanDays) * pxTotal));
  }
```

והוסף `axisGap` ל-`return` של `dates`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `43 passed`.

- [ ] **Step 5: Rebuild the timeline renderer**

ב-`index.html`, החלף את `function timeline(state)` כולה:

```js
  function timeline(state) {
    const host = document.getElementById('timeline');
    host.innerHTML = '';
    if (!state.profile) return;                 // no profile -> no timeline

    const today = dates.todayISO();
    const p = state.profile;
    const pct = dates.progressPct(p.enlistDate, p.releaseDate, today);
    const span = dates.daysBetween(p.enlistDate, p.releaseDate);

    host.append(el('h2', {}, 'ציר השירות'));
    const tl = el('ol', { class: 'tl' });
    const fill = el('div', { class: 'tl-fill' });
    tl.append(fill);

    // Milestones, the user's own events, and "you are here" all live on one
    // axis: the spec asked for event points placed by date, and a separate
    // list of milestones was never the same thing.
    const nodes = milestones(p).map(n => ({ ...n, kind: 'milestone' }));
    for (const ev of store.allEvents(state)) {
      if (ev.id === 'release') continue;        // already a milestone
      nodes.push({ title: ev.title, date: ev.date, kind: 'event', icon: ev.icon });
    }
    nodes.push({ title: `אתה כאן · ${pct}%`, date: today, kind: 'now' });
    nodes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    let prev = nodes[0].date;
    let nowNode = null;
    for (const n of nodes) {
      const cls = n.kind === 'now' ? 'tl-node now'
                : n.date <= today ? 'tl-node done' : 'tl-node';
      const node = el('li', { class: cls + (n.kind === 'event' ? ' ev-node' : '') },
        n.kind === 'now' ? n.title : `${n.title} · ${dates.formatHe(n.date)}`);
      node.style.marginBlockStart = dates.axisGap(prev, n.date, span, 420, 14) + 'px';
      tl.append(node);
      if (n.kind === 'now') nowNode = node;
      prev = n.date;
    }

    host.append(tl);
    // Measured, not computed from a percentage: the fill now ends exactly at
    // the marker, whatever the dates are.
    if (nowNode) fill.style.height = (nowNode.offsetTop + 14) + 'px';
  }
```

- [ ] **Step 6: Update the timeline CSS**

בבלוק ה-`<style>`, החלף את הכללים `.tl` ו-`.tl-node`:

```css
.tl{position:relative; padding-inline-start:1.25rem; margin:0;
  border-inline-start:2px solid var(--line); list-style:none}
.tl-node{position:relative; color:var(--muted); font-size:.9rem}
.tl-node::before{content:""; position:absolute; inset-inline-start:-1.6rem; top:.2rem;
  width:9px; height:9px; border-radius:50%; background:var(--line-strong)}
.tl-node.ev-node::before{background:transparent;
  border:2px solid color-mix(in srgb, var(--accent) 60%, var(--line-strong))}
.tl-node.done::before{background:var(--accent)}
.tl-node.now{color:var(--ink); font-weight:800}
.tl-node.now::before{background:var(--accent); box-shadow:0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent)}
```

(ה-`padding-block` הישן הוחלף ב-`margin-block-start` מחושב, ולכן `top` של הנקודה
ירד מ-`.9rem` ל-`.2rem` כדי להתיישר עם שורת הטקסט.)

- [ ] **Step 7: Verify the fill lands on the marker**

Run:
```bash
cat > /tmp/sc-tl.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const page = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
await page.goto('http://localhost:8899/service-countdown/index.html');
await page.evaluate(() => localStorage.setItem('service-countdown.v1', JSON.stringify({
  v:1, profile:{enlistDate:'2025-03-15',releaseDate:'2027-11-15',gender:'m'},
  events:[{id:'e1',title:'מסע כומתה',date:'2026-09-01',icon:'star',source:'template'}],
  heroId:'release', theme:'dark', unit:'days' })));
await page.reload(); await page.waitForTimeout(400);
console.log(await page.evaluate(() => {
  const fill = document.querySelector('.tl-fill').getBoundingClientRect();
  const now  = document.querySelector('.tl-node.now').getBoundingClientRect();
  const tl   = document.querySelector('.tl').getBoundingClientRect();
  return { deltaPx: Math.round((fill.bottom - tl.top) - (now.top - tl.top) - 14),
           userEventOnAxis: !!document.querySelector('.tl-node.ev-node') };
}));
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-tl.mjs
```

Expected: `{ deltaPx: 0, userEventOnAxis: true }`

- [ ] **Step 8: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): time-proportional service axis with the user's own events"
```

---

## Task 9: ייצוא ליומן (‎.ics) + תג על האייקון + שיתוף (P2-13, פער ההתראות)

**Files:**
- Create: `service-countdown/test/ics.test.mjs`
- Modify: `service-countdown/index.html` — מודול `ics` חדש, `render.settings`, bootstrap

**Interfaces:**
- Produces:
  - `ics.build(events: {title, date}[], alarmDays: number) -> string` — קובץ VCALENDAR
    שלם עם `VALARM` לכל אירוע, שורות מופרדות ב-CRLF
  - `ics.filename() -> string`
  - `badge.paint(n: number|null) -> void`, `badge.enable() -> Promise<boolean>`

**רקע:** לא ניתן לתזמן התראה מקומית מ-PWA בלי שרת Push. הדרך שכן עובדת אופליין היא
לייצא אירוע יומן עם בלוק `VALARM` — יומני Apple ו-Google מכבדים אותו וההתראה מגיעה
מהמערכת. הרשאת ההתראות נדרשת רק ל-Badging API, ולכן היא **opt-in נפרד**.

- [ ] **Step 1: Write the failing test file**

צור `service-countdown/test/ics.test.mjs`:

```js
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

console.log(`${passed} passed`);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node service-countdown/test/ics.test.mjs`
Expected: FAIL — `could not find the 'ics' module in index.html`.

- [ ] **Step 3: Add the `ics` module**

ב-`index.html`, הוסף בלוק `<script>` חדש אחרי בלוק `clock`:

```html
<script>
/* ---------- ics: a calendar file is the only offline path to a real reminder ---------- */
const ics = (() => {
  // A PWA cannot schedule a local notification without a push server. What it
  // CAN do is hand the OS calendar an event with an alarm attached -- Apple
  // Calendar and Google Calendar both honour VALARM -- so the reminder comes
  // from the system, with no server and no permission prompt.
  function esc(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
                    .replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  function stamp(iso) { return iso.replace(/-/g, ''); }

  function build(events, alarmDays) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hasfira//service-countdown//HE',
                   'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    let seq = 0;
    for (const ev of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${stamp(ev.date)}-${seq++}@hasfira.local`);
      lines.push(`DTSTAMP:${stamp(dates.todayISO())}T000000Z`);
      // All-day events use an exclusive DTEND: the day after the event.
      lines.push(`DTSTART;VALUE=DATE:${stamp(ev.date)}`);
      lines.push(`DTEND;VALUE=DATE:${stamp(dates.addDays(ev.date, 1))}`);
      lines.push(`SUMMARY:${esc(ev.title)}`);
      lines.push('TRANSP:TRANSPARENT');
      if (alarmDays > 0) {
        lines.push('BEGIN:VALARM');
        lines.push(`TRIGGER;RELATED=START:-P${alarmDays}D`);
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${esc(ev.title)}`);
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  function filename() { return 'ha-sfira.ics'; }

  return { build, filename };
})();
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node service-countdown/test/ics.test.mjs`
Expected: `7 passed`.

- [ ] **Step 5: Add the badge module**

ב-`index.html`, בתוך אותו בלוק `<script>` של `ics` — אחרי סגירת המודול:

```js
/* ---------- badge: the only "widget" a PWA gets ---------- */
const badge = (() => {
  // navigator.setAppBadge works on installed home-screen web apps from
  // iOS/iPadOS 16.4 and on Chrome/Edge, but only once notification permission
  // has been granted. It is the closest thing we have to the competitor's
  // home-screen widget: the days left, readable without opening anything.
  function supported() { return 'setAppBadge' in navigator; }

  function paint(n) {
    if (!supported()) return;
    if (typeof n === 'number' && n > 0) navigator.setAppBadge(n).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  }

  async function enable() {
    if (!supported() || !('Notification' in window)) return false;
    try { return (await Notification.requestPermission()) === 'granted'; }
    catch (e) { return false; }
  }

  return { supported, paint, enable };
})();
```

- [ ] **Step 6: Paint the badge on every refresh**

ב-bootstrap, בתוך `function refresh()`, אחרי `motion.rollNumber();`:

```js
  // The badge always tracks the hero event, so the icon and the screen agree.
  const shown = store.heroEvent(state);
  badge.paint(shown ? dates.daysBetween(dates.todayISO(), shown.date) : null);
```

- [ ] **Step 7: Add the settings controls**

ב-`render.settings`, החלף את בלוק ה-`innerHTML` בין `<h2>הגדרות</h2>` לבין
שורת הייצוא/ייבוא, כך שיכיל גם:

```html
      <div class="row">
        <button class="btn" id="sIcs" type="button">הוסף ליומן עם תזכורת</button>
        <button class="btn" id="sShare" type="button">שתף את הספירה</button>
      </div>
      <p class="ev-d">"הוסף ליומן" מוריד קובץ עם כל האירועים ותזכורת יום מראש —
        ההתראה מגיעה מהיומן של המכשיר, בלי שרת ובלי חשבון.</p>
      <div class="row" id="sBadgeRow" hidden>
        <button class="btn" id="sBadge" type="button">הצג ימים על אייקון האפליקציה</button>
      </div>
```

והוסף את ה-handlers אחרי `box.querySelector('#sClose').onclick = ...`:

```js
    box.querySelector('#sIcs').onclick = () => {
      const rows = store.allEvents(state).map(e => ({ title: e.title, date: e.date }));
      if (rows.length === 0) { err.textContent = 'אין עדיין אירועים לייצא'; return; }
      const blob = new Blob([ics.build(rows, 1)], { type: 'text/calendar' });
      const a = el('a');
      a.href = URL.createObjectURL(blob);
      a.download = ics.filename();
      a.click();
      URL.revokeObjectURL(a.href);
    };

    box.querySelector('#sShare').onclick = async () => {
      const ev = store.heroEvent(state);
      if (!ev) { err.textContent = 'אין עדיין ספירה לשתף'; return; }
      const left = dates.daysBetween(dates.todayISO(), ev.date);
      const text = `${ev.title}: ${dates.remainingLabel(left)} (${dates.formatHe(ev.date)})`;
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); err.textContent = 'הועתק'; }
      } catch (e) { /* the user dismissed the share sheet */ }
    };

    if (badge.supported()) {
      box.querySelector('#sBadgeRow').hidden = false;
      box.querySelector('#sBadge').onclick = async () => {
        const ok = await badge.enable();
        err.textContent = ok ? 'התג יופיע על האייקון' : 'ההרשאה נדחתה — אין תג';
        if (ok) refresh();
      };
    }
```

- [ ] **Step 8: Run both test files and the gate**

Run:
```bash
node service-countdown/test/dates.test.mjs && node service-countdown/test/ics.test.mjs && \
  node .claude/tools/verify-all.mjs --structural
```
Expected: `43 passed`, `7 passed`, `✅ verify-all: all checks passed`

- [ ] **Step 9: Commit**

```bash
git add service-countdown/index.html service-countdown/test/ics.test.mjs
git commit -m "feat(countdown): calendar export with reminders, app badge and share"
```

---

## Task 10: היגיינת PWA — safe-area, תגי מטא, favicon (P2-10, P2-11, P2-12)

**Files:**
- Modify: `service-countdown/index.html` — `<head>`, CSS, `paintTheme`

**Interfaces:** אין ממשק חדש. `paintTheme()` מקבל אחריות נוספת: עדכון `theme-color`.

- [ ] **Step 1: Complete the `<head>`**

ב-`index.html`, החלף את הבלוק שבין `<title>` לבין `<style>`:

```html
<meta name="description" content="ספירה לאחור לשחרור ולכל אבן דרך בשירות — סוף קורס, כומתה, רגילה. עם ציר שירות ואחוז פז&quot;מ. עובד אופליין, הנתונים במכשיר בלבד.">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<!-- Inline favicon: an external /favicon.ico request is the one network call
     the page was still making, and this tool promises zero. -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e0a33c' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'/%3E%3Cpath d='M12 10v4l2 2'/%3E%3Cpath d='M9 2h6'/%3E%3C/svg%3E">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="הספירה">
<meta name="theme-color" content="#13140f" id="metaTheme">
```

שים לב: ה-SVG ב-`data:` URI משתמש במרכאות יחידות ולכן חייב לשבת בתוך מרכאות כפולות,
ו-`#` מקודד ל-`%23` — שתי מלכודות מתועדות ב-`PROJECT_LESSONS`.

- [ ] **Step 2: Keep the browser chrome in step with the theme**

ב-bootstrap, החלף את `paintTheme`:

```js
function paintTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  btnTheme.innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon');
  btnTheme.setAttribute('aria-pressed', state.theme === 'dark' ? 'true' : 'false');
  // The tool picks its own theme regardless of the system setting, so a static
  // theme-color left a light page under a dark status bar.
  document.getElementById('metaTheme')
    .setAttribute('content', state.theme === 'dark' ? '#13140f' : '#f2f1ea');
}
```

- [ ] **Step 3: Respect the safe area**

בבלוק ה-`<style>`, החלף את `.topbar` ואת ה-`padding` של `.hero`, `.panel`, `.sheet`,
`.wizard`:

```css
.hero{
  min-height:100dvh;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:.5rem; text-align:center;
  padding:calc(1.5rem + env(safe-area-inset-top)) calc(1.5rem + env(safe-area-inset-right))
          calc(1.5rem + env(safe-area-inset-bottom)) calc(1.5rem + env(safe-area-inset-left));
}
.topbar{position:fixed; inset-block-start:0; inset-inline-end:0; z-index:10;
  padding:calc(.9rem + env(safe-area-inset-top)) calc(.9rem + env(safe-area-inset-right)) .9rem .9rem;
  display:flex; gap:.4rem}
.panel{padding:1.25rem; max-width:640px; margin-inline:auto}
.panel:last-of-type{padding-block-end:calc(1.25rem + env(safe-area-inset-bottom))}
.sheet{position:fixed; inset:0; z-index:30; background:var(--bg); overflow-y:auto;
  padding:calc(1.25rem + env(safe-area-inset-top)) 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  display:flex; flex-direction:column; gap:.9rem}
.wizard{position:fixed; inset:0; z-index:20; background:var(--bg); overflow-y:auto;
  display:flex; flex-direction:column; justify-content:center; gap:1rem;
  padding:calc(1.5rem + env(safe-area-inset-top)) 1.5rem calc(1.5rem + env(safe-area-inset-bottom))}
```

- [ ] **Step 4: Verify — no console errors, no 404, both schemes**

Run:
```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-head-d.png dark 390 && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-head-l.png light 390
```
Expected: בשתי הריצות `overflow=false console_errors=[]` — כולל היעלמות ה-404
שהופיע קודם בטעינה נקייה.

- [ ] **Step 5: Commit**

```bash
git add service-countdown/index.html
git commit -m "fix(countdown): safe-area insets, full meta set, inline favicon"
```

---

## Task 11: גיליונות שמתנהגים כגיליונות + נגישות (P3-14, P3-15)

**Files:**
- Modify: `service-countdown/index.html` — `render` (helper `openSheet`), `render.addSheet`,
  `render.settings`, `render.wizard`, CSS

**Interfaces:**
- Produces: `render.openSheet(node, onClose?) -> () => void` — מצרף את הגיליון ל-DOM,
  נועל גלילה מאחוריו, קושר `Escape` וכפתור "אחורה" של הדפדפן, ומחזיר פונקציית סגירה.
  כל קריאות `box.remove()` הקיימות מוחלפות בקריאה לפונקציה המוחזרת.

- [ ] **Step 1: Add the sheet helper**

ב-`index.html`, בתוך `render`, לפני `function addSheet`:

```js
  // A full-screen overlay that ignores Escape, lets the page scroll behind it
  // and cannot be dismissed with the back gesture is not a sheet -- it is a
  // page that traps you. This wires all three, once, for every overlay.
  function openSheet(node, onClose) {
    const prevOverflow = document.body.style.overflow;
    const opener = document.activeElement;
    document.body.style.overflow = 'hidden';
    document.body.append(node);

    const close = () => {
      if (!node.isConnected) return;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prevOverflow;
      node.remove();
      if (opener && opener.focus) opener.focus();
      if (onClose) onClose();
    };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); history.back(); } };
    const onPop = () => close();

    history.pushState({ sheet: true }, '');
    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);

    // Closing through history.back() keeps the browser's own back gesture and
    // our buttons on the same path, so the stack never drifts.
    const dismiss = () => { if (node.isConnected) history.back(); };

    const x = el('button', { class: 'sheet-x', type: 'button', 'aria-label': 'סגור' },
      icon('plus'));
    x.onclick = dismiss;
    node.prepend(x);

    const first = node.querySelector('input, button:not(.sheet-x)');
    if (first) first.focus();
    return dismiss;
  }
```

והוסף `openSheet` ל-`return` של `render`.

- [ ] **Step 2: Style the close button**

בבלוק ה-`<style>`, אחרי הכלל `.sheet input[type=text]...`:

```css
.sheet-x{position:absolute; inset-block-start:calc(.9rem + env(safe-area-inset-top));
  inset-inline-end:.9rem; width:40px; height:40px; display:inline-flex;
  align-items:center; justify-content:center; border-radius:12px; cursor:pointer;
  background:transparent; border:1px solid var(--line); color:var(--muted); font:inherit;
  transform:rotate(45deg)}
.sheet-x svg{width:20px;height:20px}
.sheet-x:hover{color:var(--ink); border-color:var(--line-strong)}
```

(סיבוב 45° הופך את אייקון ה-`plus` הקיים ל-X — בלי להוסיף אייקון חדש למפה.)

- [ ] **Step 3: Route every overlay through the helper**

ב-`render.addSheet`: החלף `document.body.append(box);` ב-

```js
    const dismiss = openSheet(box);
```

והחלף כל `box.remove()` בתוך `addSheet` ב-`dismiss()`.

ב-`render.settings`: אותו דבר — `const dismiss = openSheet(box);`, וכל `box.remove()`
בתוך הפונקציה הופך ל-`dismiss()`. שים לב לשני מקומות שגם מנווטים הלאה
(`#sProfile` ו-`#sImport`): שם הסדר חייב להיות `dismiss()` **ואז** הפעולה הבאה.

ב-`render.wizard`: החלף `document.body.append(box);` ב-`const dismiss = openSheet(box);`
וכל `box.remove()` ב-`dismiss()`.

- [ ] **Step 4: Add the remaining a11y attributes**

ב-`render.timeline` הרשימה כבר `<ol>` (משימה 8). נשאר:

ב-`index.html`, ב-markup של ה-topbar, הוסף `aria-pressed="true"` לכפתור התצוגה:

```html
  <button class="iconbtn" id="btnTheme" type="button" aria-label="החלף מצב תצוגה" aria-pressed="true"></button>
```

(הערך מתעדכן ב-`paintTheme` — נוסף במשימה 10.)

ובכל אחד משלושת ה-overlays הוסף תפקיד דיאלוג. ב-`addSheet` וב-`settings`:

```js
    const box = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
```

וב-`wizard`:

```js
    const box = el('div', { class: 'wizard', id: 'wizard', role: 'dialog', 'aria-modal': 'true' });
```

- [ ] **Step 5: Verify the behaviours**

Run:
```bash
cat > /tmp/sc-sheet.mjs <<'EOF'
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')) {
    const p = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (existsSync(p)) exe = p; }
const b = await chromium.launch({ executablePath: exe });
const page = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
await page.goto('http://localhost:8899/service-countdown/index.html');
await page.evaluate(() => localStorage.setItem('service-countdown.v1', JSON.stringify({
  v:1, profile:{enlistDate:'2025-03-15',releaseDate:'2027-11-15',gender:'m'},
  events:[], heroId:'release', theme:'dark', unit:'days' })));
await page.reload(); await page.waitForTimeout(300);
await page.getByText('הוסף אירוע').click(); await page.waitForTimeout(200);
console.log('scroll locked behind sheet:', await page.evaluate(() =>
  getComputedStyle(document.body).overflow === 'hidden'));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('Escape closed it:', await page.locator('.sheet').count() === 0);
await page.getByText('הוסף אירוע').click(); await page.waitForTimeout(200);
await page.goBack(); await page.waitForTimeout(300);
console.log('back gesture closed it:', await page.locator('.sheet').count() === 0);
console.log('scroll restored:', await page.evaluate(() =>
  getComputedStyle(document.body).overflow !== 'hidden'));
await b.close();
EOF
(python3 -m http.server 8899 >/dev/null 2>&1 &) ; sleep 1; node /tmp/sc-sheet.mjs
```

Expected: ארבע שורות `true`.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "fix(countdown): sheets close on Escape and back, lock scroll, announce as dialogs"
```

---

## Task 12: הזנת אירועים — עריכה, אייקון, תבנית שחרור, ולידציה (P3-16)

**Files:**
- Modify: `service-countdown/index.html` — `TEMPLATES`, `render.addSheet` (הופכת
  ל-`eventSheet`), `render.events`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `store.validateEvent(state, {title, date, id}) -> string` — מחרוזת שגיאה
  בעברית, או `''` כשתקין. `render.eventSheet(state, refresh, existing?) -> void`
  מחליפה את `render.addSheet`; `addSheet` נשאר כ-alias כדי לא לשבור קוראים
  (המצב הריק במשימה 7 קורא לו).

- [ ] **Step 1: Write the failing tests**

הוסף ב-`service-countdown/test/dates.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `store.validateEvent is not a function`.

- [ ] **Step 3: Implement the validator**

ב-`index.html`, בתוך `store`, אחרי `restoreEvent`:

```js
  // The sheet used to accept any date at all: an event dated 1999 sat happily
  // in a 2025-2027 service and pushed the axis into nonsense.
  function validateEvent(state, draft) {
    const title = (draft.title || '').trim();
    if (!title || !draft.date) return 'צריך שם ותאריך';
    if (state.profile && draft.date < state.profile.enlistDate) {
      return 'התאריך מוקדם מתאריך הגיוס';
    }
    const clash = state.events.some(e =>
      e.id !== draft.id && e.title === title && e.date === draft.date);
    if (clash) return 'האירוע הזה כבר קיים';
    return '';
  }
```

והוסף `validateEvent` ל-`return` של `store`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `47 passed`.

- [ ] **Step 5: Add the release template**

ב-`index.html`, הוסף לראש המערך `TEMPLATES`:

```js
const TEMPLATES = [
  { title: 'שחרור',            icon: 'party-popper', profile: true },
  { title: 'סוף טירונות',      icon: 'shield' },
```

(שאר השורות נשארות כפי שהן.)

- [ ] **Step 6: Rewrite the sheet as an editor**

החלף את `function addSheet(state, refresh)` כולה:

```js
  const ICON_CHOICES = ['flag', 'shield', 'star', 'graduation-cap', 'home', 'party-popper'];

  function eventSheet(state, refresh, existing) {
    const box = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    box.innerHTML = `
      <h2>${existing ? 'עריכת אירוע' : 'אירוע חדש'}</h2>
      <div class="tpl" id="tpl"></div>
      <div>
        <label for="aTitle">שם</label>
        <input type="text" id="aTitle" placeholder="למשל: סוף קורס מפקדים">
      </div>
      <div>
        <label for="aDate">תאריך</label>
        <input type="date" id="aDate">
      </div>
      <div>
        <label>אייקון</label>
        <div class="tpl" id="icons"></div>
      </div>
      <p class="err" id="aErr"></p>
      <div class="row">
        <button class="btn primary" id="aSave" type="button">${existing ? 'שמור' : 'הוסף'}</button>
        <button class="btn ghost" id="aCancel" type="button">ביטול</button>
      </div>`;
    const dismiss = openSheet(box);

    let pickedIcon = existing ? existing.icon : 'flag';
    let source = existing ? existing.source : 'custom';
    if (existing) {
      box.querySelector('#aTitle').value = existing.title;
      box.querySelector('#aDate').value = existing.date;
    }

    const icons = box.querySelector('#icons');
    function paintIcons() {
      icons.querySelectorAll('button').forEach(b =>
        b.classList.toggle('on', b.dataset.icon === pickedIcon));
    }
    for (const name of ICON_CHOICES) {
      const b = el('button', { type: 'button', 'aria-label': name, 'data-icon': name },
        icon(name));
      b.onclick = () => { pickedIcon = name; paintIcons(); };
      icons.append(b);
    }
    paintIcons();

    const tpl = box.querySelector('#tpl');
    for (const t of TEMPLATES) {
      const b = el('button', { type: 'button' }, t.title);
      b.onclick = () => {
        // "שחרור" is not an event: it is the profile. Creating it as a row
        // would give the tool two competing release dates.
        if (t.profile) { dismiss(); wizard(state, refresh); return; }
        tpl.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        pickedIcon = t.icon; source = 'template'; paintIcons();
        box.querySelector('#aTitle').value = t.title;
      };
      tpl.append(b);
    }

    box.querySelector('#aCancel').onclick = () => dismiss();
    box.querySelector('#aSave').onclick = () => {
      const draft = {
        id: existing ? existing.id : undefined,
        title: box.querySelector('#aTitle').value.trim(),
        date: box.querySelector('#aDate').value,
      };
      const problem = store.validateEvent(state, draft);
      if (problem) { box.querySelector('#aErr').textContent = problem; return; }
      if (existing) {
        Object.assign(existing, { title: draft.title, date: draft.date, icon: pickedIcon });
      } else {
        state.events.push({ id: 'e' + Date.now().toString(36), title: draft.title,
                            date: draft.date, icon: pickedIcon, source });
      }
      store.save(state);
      dismiss();
      refresh();
    };
  }

  // Kept so the empty state and the events header can keep calling addSheet.
  function addSheet(state, refresh) { eventSheet(state, refresh); }
```

והרחב את ה-`return` של `render`:

```js
  return { hero, wizard, timeline, events, addSheet, eventSheet, settings, toast, openSheet };
```

- [ ] **Step 7: Add an edit affordance to each row**

ב-`render.events`, בתוך הלולאה, לפני יצירת `del` (בתוך אותו `if (!ev.virtual)`):

```js
        const edit = el('button', { class: 'ev-del', type: 'button',
          'aria-label': 'ערוך ' + ev.title }, icon('settings'));
        edit.onclick = () => eventSheet(state, refresh, state.events.find(x => x.id === ev.id));
        wrap.append(edit);
```

- [ ] **Step 8: Style the icon chips**

בבלוק ה-`<style>`, אחרי הכלל `.tpl button.on`:

```css
#icons button{width:44px; height:44px; display:inline-flex; align-items:center;
  justify-content:center; padding:0}
#icons svg{width:20px;height:20px}
```

- [ ] **Step 9: Verify**

Run:
```bash
node service-countdown/test/dates.test.mjs && node service-countdown/test/ics.test.mjs && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-edit.png dark 390
```
Expected: `47 passed`, `7 passed`, `overflow=false console_errors=[]`

- [ ] **Step 10: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): edit events, pick an icon, validate dates, release template"
```

---

## Task 13: אשף כן ומהיר (P3-17)

**Files:**
- Modify: `service-countdown/index.html` — `render.wizard`
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.enlistWaves(todayISO, count) -> string[]` — תאריכי גלי הגיוס
  (מרץ/אוגוסט/נובמבר) האחרונים, מהחדש לישן, כ-ISO של ה-1 בחודש.

**רקע:** אורך שירות החובה השתנה בחוק כמה פעמים בעשור (30/32/36 חודשים בתיקונים
שונים), והמקורות הפומביים סותרים זה את זה. הכלי לא אמור "לדעת" את החוק —
הוא אמור לתת ברירת מחדל נוחה, לאפשר לשנות אותה, ולומר בפירוש שהמקור הוא הצו.

- [ ] **Step 1: Write the failing test**

```js
t('enlistWaves lists recent March/August/November intakes, newest first', () => {
  const w = dates.enlistWaves('2026-08-08', 4);
  assert.deepEqual([...w], ['2026-08-01', '2026-03-01', '2025-11-01', '2025-08-01']);
});

t('enlistWaves never returns a future intake', () => {
  const w = dates.enlistWaves('2026-07-31', 2);
  assert.deepEqual([...w], ['2026-03-01', '2025-11-01']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node service-countdown/test/dates.test.mjs`
Expected: FAIL — `dates.enlistWaves is not a function`.

- [ ] **Step 3: Implement**

ב-`dates`, אחרי `axisGap`:

```js
  // Israeli conscription runs in waves; typing an enlistment date two years
  // back through a native date spinner is the slowest possible way in.
  // Months are 0-based here: 2 = March, 7 = August, 10 = November.
  function enlistWaves(todayISO, count) {
    const t = parse(todayISO);
    const out = [];
    let y = t.getFullYear();
    while (out.length < count && y > t.getFullYear() - 12) {
      for (const m of [10, 7, 2]) {
        const iso = toISO(new Date(y, m, 1));
        if (iso <= todayISO && out.length < count) out.push(iso);
      }
      y -= 1;
    }
    return out;
  }
```

והוסף `enlistWaves` ל-`return` של `dates`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node service-countdown/test/dates.test.mjs`
Expected: `49 passed`.

- [ ] **Step 5: Rebuild the wizard body**

ב-`render.wizard`, החלף את ה-`innerHTML` ואת בלוק ה-handlers של "חשב לי":

```js
    box.innerHTML = `
      <h2>נתחיל</h2>
      <div>
        <label for="wEnlist">תאריך גיוס</label>
        <input type="date" id="wEnlist">
        <div class="tpl" id="wWaves"></div>
      </div>
      <div>
        <label>אורך שירות</label>
        <div class="tpl" id="wGender"></div>
        <div class="row">
          <input type="number" id="wMonths" min="1" max="60" step="1" value="32"
                 inputmode="numeric" aria-label="מספר חודשי שירות">
          <span class="ev-d">חודשים</span>
          <button class="btn" id="wCalc" type="button">חשב תאריך שחרור</button>
        </div>
      </div>
      <div>
        <label for="wRelease">תאריך שחרור</label>
        <input type="date" id="wRelease">
      </div>
      <p class="ev-d">ברירות המחדל (32 / 24 חודשים) הן הצעה בלבד — אורך השירות
        בחוק השתנה כמה פעמים. המקור המחייב הוא התאריך שעל הצו; אפשר לדרוס כאן הכול.</p>
      <p class="err" id="wErr"></p>
      <div class="row">
        <button class="btn primary" id="wSave" type="button">שמור</button>
        <button class="btn ghost" id="wSkip" type="button">דלג</button>
      </div>`;
```

והחלף את בלוק ה-`suggest` ואת שני ה-handlers `#wCalcM`/`#wCalcF`:

```js
    const months = box.querySelector('#wMonths');
    if (state.profile && state.profile.months) months.value = state.profile.months;

    const waves = box.querySelector('#wWaves');
    for (const iso of dates.enlistWaves(dates.todayISO(), 6)) {
      const b = el('button', { type: 'button' }, dates.formatHe(iso).replace(/^1 ב/, ''));
      b.onclick = () => {
        waves.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        enlist.value = iso;
      };
      waves.append(b);
    }

    const genderBox = box.querySelector('#wGender');
    function paintGender() {
      genderBox.querySelectorAll('button').forEach(b =>
        b.classList.toggle('on', b.dataset.g === gender));
    }
    for (const g of [{ g: 'm', label: 'חייל', months: 32 }, { g: 'f', label: 'חיילת', months: 24 }]) {
      const b = el('button', { type: 'button', 'data-g': g.g }, g.label);
      b.onclick = () => { gender = g.g; months.value = g.months; paintGender(); };
      genderBox.append(b);
    }
    paintGender();

    box.querySelector('#wCalc').onclick = () => {
      if (!enlist.value) { err.textContent = 'צריך קודם תאריך גיוס'; return; }
      const n = Number(months.value);
      if (!Number.isInteger(n) || n < 1 || n > 60) {
        err.textContent = 'מספר חודשים לא הגיוני'; return;
      }
      err.textContent = '';
      release.value = dates.addMonths(enlist.value, n);
    };
```

וב-handler של `#wSave`, החלף את שורת בניית הפרופיל כך שתשמור גם את מספר החודשים:

```js
      state.profile = { enlistDate: enlist.value, releaseDate: release.value,
                        gender, months: Number(months.value) || null };
```

- [ ] **Step 6: Style the number field**

בבלוק ה-`<style>`, אחרי הכלל `.sheet input[type=text]...`:

```css
.wizard input[type=number]{width:5.5rem; padding:.85rem; border-radius:var(--r);
  font-size:1rem; font-family:inherit; text-align:center;
  background:var(--card); color:var(--ink); border:1px solid var(--line-strong)}
```

- [ ] **Step 7: Verify**

Run:
```bash
node service-countdown/test/dates.test.mjs && \
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/sc-wizard.png dark 390
```
Expected: `49 passed`, `overflow=false console_errors=[]`. פתח את הצילום וּודא
שצ'יפי גלי הגיוס, צ'יפי המין ושדה החודשים נראים כמשפחה אחת.

- [ ] **Step 8: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): wizard with intake shortcuts and an editable service length"
```

---

## Task 14: שער שחרור — באמפ SW, תיעוד, מיזוג

**Files:**
- Modify: `service-countdown/sw.js:4`, `README.md`, `.claude/PROJECT_LESSONS.md`

- [ ] **Step 1: Bump the service worker cache**

ב-`service-countdown/sw.js`, שורה 4:

```js
const CACHE = "sc-v2";
```

בלי הבאמפ הזה, כל מי שהתקין את ה-PWA ימשיך לקבל את הדף הישן מהמטמון וידווח
ש"התיקון לא עובד" למרות שהוא ב-main.

- [ ] **Step 2: Update the README entry**

ב-`README.md`, החלף את הפסקה של `service-countdown/`:

```markdown
- **service-countdown/** — "הספירה": ספירה לאחור לשחרור ולכל אבן דרך בשירות
  (סוף קורס מפקדים, כומתה, רגילה), עם גיבור מלא-מסך, כותרת דביקה בגלילה,
  ספירה בימים/שבועות/חודשים, ציר שירות פרופורציונלי לזמן ואחוז פז"מ.
  אשף שמציע תאריך שחרור מתאריך הגיוס, ייצוא ליומן עם תזכורת (‎.ics) ותג ימים
  על אייקון האפליקציה. הנתונים במכשיר בלבד, עובד אופליין.
```

ובסעיף הבדיקות, הוסף את השורה:

```bash
node service-countdown/test/ics.test.mjs                # בניית קובץ היומן (VALARM, אירוע יום־שלם)
```

- [ ] **Step 3: Update the lessons file**

ב-`.claude/PROJECT_LESSONS.md`, בסעיף "מלכודות ספציפיות לכלים", הוסף:

```markdown
- **`service-countdown` — הגיבור נופל לאירוע הקרוב, לא למוקדם.** `store.heroEvent`
  מקבל `todayISO` אופציונלי ומחזיר את האירוע הבא בזמן; `list[0]` (ברירת המחדל
  הישנה) החזיר את התאריך הישן ביותר, ומחיקת הגיבור העבירה את המסך לאירוע שכבר עבר.
- **`service-countdown` — ספירה חייבת שעון.** `clock.init(refresh)` מתזמן רינדור
  מחדש לחצות המקומית הבאה **וגם** מאזין ל-`visibilitychange`/`pageshow`: PWA במסך
  הבית מושהית ולא נסגרת, אז בלי זה המספר על המסך הוא של אתמול.
- **`service-countdown` — התראות: הדרך שכן עובדת היא `.ics` עם `VALARM`.** אי-אפשר
  לתזמן התראה מקומית מ-PWA בלי שרת Push, אבל אפשר לייצא אירוע יומן עם התראה
  והמערכת תזכיר. `navigator.setAppBadge` (iOS 16.4+ למותקנות, Chrome/Edge) נותן
  את מספר הימים על האייקון — אחרי הרשאת התראות.
```

ובסעיף "היסטוריית שינויים גדולים", בראש הרשימה:

```markdown
- **08/08/2026:** `service-countdown` v2 — אחרי ביקורת ממשק ומחקר מתחרים
  (`docs/superpowers/specs/2026-08-08-service-countdown-review.md`): שעון חי,
  נפילת-גיבור לאירוע הקרוב, ביטול מחיקה, כותרת דביקה, ספירה בימים/שבועות/חודשים,
  ציר זמן פרופורציונלי עם אירועי המשתמש, ייצוא ‎.ics עם תזכורת, תג על האייקון,
  safe-area ותגי מטא מלאים, גיליונות עם Escape/back/נעילת גלילה, עריכת אירועים
  וולידציה, ואשף עם גלי גיוס ואורך שירות נתון לעריכה.
```

- [ ] **Step 4: Run the full gate, including headless**

Run:
```bash
node service-countdown/test/dates.test.mjs && \
node service-countdown/test/ics.test.mjs && \
node .claude/tools/verify-all.mjs
```
Expected: `49 passed`, `7 passed`, ואז
`✅ verify-all: all checks passed (8 dirs: ...)` — כולל רינדור headless באור
ובחושך לכל הכלים, בלי שגיאות קונסולה ובלי גלישה אופקית.

- [ ] **Step 5: Commit and push**

```bash
git add service-countdown/sw.js README.md .claude/PROJECT_LESSONS.md
git commit -m "chore(countdown): bump SW cache, update docs and lessons for v2"
git push -u origin claude/countdown-app-improvement-plan-wm95hm
```

- [ ] **Step 6: Merge to main only after the gate is green**

```bash
git fetch origin main
git merge-base --is-ancestor origin/main claude/countdown-app-improvement-plan-wm95hm && \
  git push origin claude/countdown-app-improvement-plan-wm95hm:main
```

הפריסה רצה מ-`main` בלבד. אימות "חי" — מול
`raw.githubusercontent.com/.../main/service-countdown/index.html`, לא מול עמוד
ה-Pages (ה-edge מתעכב 1-5 דקות).

---

## Self-Review

**כיסוי מול הביקורת:** P0-1 → משימה 2 · P0-2 → משימה 1 · P0-3 → משימה 3 ·
P1-4 → משימה 4 · P1-5 → משימה 6 · P1-6 → משימה 7 · P1-7 → משימה 8 ·
P1-8 → משימה 5 · P1-9 → משימה 7 · P2-10/11/12 → משימה 10 · P2-13 → משימה 9 ·
P3-14/15 → משימה 11 · P3-16 → משימה 12 · P3-17 → משימה 13. פער ההתראות
(אפיון §6) נסגר חלקית במשימה 9. **אין ממצא בלי משימה.**

**עקביות טיפוסים:** `heroEvent(state, todayISO?)` נקרא בלי הפרמטר ב-`render.hero`
וב-bootstrap (משימה 9) — תואם. `hero(state, refresh)` — החתימה משתנה במשימה 7
ומעודכנת גם ב-`refreshHero` וגם ב-bootstrap. `addSheet` נשמר כ-alias ל-`eventSheet`
כדי שהמצב הריק (משימה 7) לא יישבר במשימה 12. `openSheet` מוגדר במשימה 11 ונצרך
במשימה 12 — סדר הביצוע חייב להישמר.

**תלויות בין משימות:** 4 ← 7 (רוחב ה-`padding` של `.hero-mini`) · 5 ← 7
(`refreshHero` מקבל `heroRefresh`) · 11 ← 12 (`openSheet`) · 8 ← 12
(אירועי משתמש על הציר משתמשים ב-`icon` שנבחר בעורך). שאר המשימות עצמאיות
ואפשר להריץ אותן בכל סדר בתוך הקבוצה שלהן.

**מה נשאר מחוץ לתוכנית, במודע:** וידג'ט מסך-בית (לא נתמך ל-PWA), אייקון אפליקציה
דינמי (אין API), שרת Push, חשבון משתמש, סנכרון ענן, וכל פיצ'ר קהילתי/מסחרי של
המתחרה. עיצוב דסקטופ ייעודי לא נכלל — הכלי mobile-first והתצוגה הרחבה קבילה כפי שהיא.
