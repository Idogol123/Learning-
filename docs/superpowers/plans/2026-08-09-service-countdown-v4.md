# "הספירה" v4 — ליטוש הליבה ונוכחות מחוץ לאפליקציה

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לסגור את פגמי הממשק שאותרו בביקורת
[`2026-08-09-service-countdown-review-v3.md`](../specs/2026-08-09-service-countdown-review-v3.md),
ולהוסיף את שלוש העקיפות ושתי ההעמקות שהופכות את הכלי לנוכח גם כשהוא סגור —
בלי שרת, בלי חשבון, בלי בקשת רשת אחת.

**Architecture:** ממשיך את המבנה של v3 בדיוק. כל לוגיקה שאפשר לבדוק בלי דפדפן
נכנסת ל-`dates`/`store`/`ics` (שלושתם נשאבים ל-`node:vm` בבדיקות הקיימות); כל
השאר ל-`render`/`motion` ולמודול חדש אחד — `wallpaper` (ציור טפט ב-canvas).
אין קבצים חדשים מלבד שני קבצי בדיקה שכבר קיימים ומורחבים.

**Tech Stack:** אותו HTML/CSS/JS יחיד ללא תלויות. APIs בשימוש (כולם עם
feature-detection ונפילה רכה): `HTMLCanvasElement.toBlob`, `navigator.canShare`,
`window.screen`, `devicePixelRatio`, `element.inert`, `Blob`/`URL.createObjectURL`.

**תלות:** התוכנית רצה **אחרי** `2026-08-08-service-countdown-v3-features.md`.
כל המשימות מניחות שקיימים: `dates.nextOccurrence/remainingLabel/unitValue/
countWeekday/progressPct`, `store.allEvents/heroEvent/removeEvent`,
`ics.build`, `render.openSheet/toast/eventSheet/settings`, `card.draw`,
`live.open`, `clock.init`, ו-`state.unit`/`state.accent`.

## Global Constraints

- **אפס בקשות רשת.** כל נכס מוטמע או מצויר מקומית. אימות ברמת ה-`context`
  של Playwright, לא ברמת ה-`page` (מאזין page לא רואה favicon).
- **אין אימוג'י ואין SVG מצויר ביד.** אייקונים מ-`ICONS` בלבד (קו Lucide);
  גרפיקה חדשה = גיאומטריה (עיגול/ריבוע/קשת) ב-SVG או ב-`canvas`.
- **גופנים:** מחסנית מערכת בלבד. אין Google Fonts, אין CDN, אין הטמעת קובץ גופן.
- **צבעים:** רק טוקני `:root` הקיימים ו-`color-mix` עליהם. סט האקסנטים
  (`amber/olive/maroon/steel/navy`) **סגור** — אין בורר צבע חופשי.
- **`prefers-reduced-motion` מכובד בכל אנימציה חדשה.**
- **עברית RTL, mobile-first.** כל מסך חייב לעבוד ב-320px רוחב.
- **חשבון תאריכים לעולם לא דרך `+ n*86400000`** — תמיד `dates.addDays`/`addMonths`.
- **מטרות מגע ≥ 44×44px** בכל כפתור חדש.
- **לפני כל commit:**
  ```bash
  node service-countdown/test/dates.test.mjs
  node service-countdown/test/ics.test.mjs
  node .claude/tools/verify-all.mjs --structural
  ```
- **`sw.js`:** באמפ יחיד ל-`sc-v4` במשימה 14 בלבד. אל תבמפ באמצע.

## File Structure

| קובץ | שינוי |
|---|---|
| `service-countdown/index.html` | מורחב — כל המשימות |
| `service-countdown/test/dates.test.mjs` | מורחב — משימות 2, 7, 10 |
| `service-countdown/test/ics.test.mjs` | מורחב — משימות 4, 5 |
| `service-countdown/manifest.webmanifest` | משימה 14 (`shortcuts`) |
| `service-countdown/sw.js` | באמפ ל-`sc-v4` — משימה 14 |
| `README.md`, `.claude/PROJECT_LESSONS.md` | משימה 14 |

**סדר לביצוע מקבילי:** משימות 4, 5 (שתיהן ב-`ics`) — סדרתיות, 4 לפני 5.
משימות 2, 7, 10 נוגעות ב-`dates`/`store` ובבדיקות שלהן — עצמאיות זו מזו, למזג
אחת-אחת. משימות 1, 3, 6 נוגעות ב-CSS/`render` — **1 לפני 3**, ו-**2 לפני 3**
(משימה 3 עורכת את `buildRow` שנוצר במשימה 2). משימות 8, 11, 13 עצמאיות לגמרי.
**משימה 12 אחרי 5, 9 ו-10** (היא מחליפה את כל ה-`innerHTML` של ההגדרות ומניחה
שכל הכפתורים שלהן קיימים), ו**משימה 12 אחרי 6** (היא מחליפה את שורת הרמז
ש-6 יצרה). משימה 14 אחרונה.

**שרת מקומי לבדיקות ויזואליות** (נדרש בכמה משימות — `file://` לא מייצג):
```bash
python3 -m http.server 8777 &
# ואז: http://localhost:8777/service-countdown/
```

---

## Task 1: סרגל אחד במקום שתי שכבות מתנגשות

**למה:** `.topbar` (z-index 10) ו-`.hero-mini` (z-index 9) הן שתי שכבות
`position:fixed` שיושבות באותם פיקסלים. מדוד: `overlapsTopbar: true`, וב-320px
נשארים למיני-בר 96px לטקסט שדורש 129px — הכותרת נחתכת. שני רכיבים קבועים על אותה
שורה = רכיב אחד.

**Files:**
- Modify: `service-countdown/index.html` — CSS (`.topbar`, `.hero-mini`),
  markup (`<main>`), `motion.init`

**Interfaces:**
- Produces: `<header class="appbar" id="appbar">` שמכיל את `#heroMini`
  (כותרת דביקה) ואת שלושת כפתורי הפעולה. `render.hero` ממשיך לכתוב
  ל-`document.getElementById('heroMini')` — **אל תשנה את ה-id**, זה מה ששומר
  את המשימה קטנה.

- [ ] **Step 1: החלף את שני בלוקי ה-CSS ברכיב אחד**

מחק את הכלל `.hero-mini` **ואת** הכלל `.hero-mini.on` (שורות שמתחילות
`.hero-mini{position:fixed;`), ומחק את הכלל `.topbar{position:fixed;`.
במקומם, מיד לפני `.iconbtn`, הוסף:

```css
/* One fixed layer, not two. The old .topbar and .hero-mini were both
   position:fixed on the same row and fought over it: the title was drawn
   UNDER the buttons, and at 320px it had 96px for text that needs 129px. */
.appbar{
  position:fixed; inset-block-start:0; inset-inline:0; z-index:10;
  display:flex; align-items:center; gap:.5rem;
  padding:calc(.7rem + env(safe-area-inset-top)) calc(.9rem + env(safe-area-inset-right))
          .7rem calc(.9rem + env(safe-area-inset-left));
  background:transparent; border-block-end:1px solid transparent;
  transition:background .2s var(--ease), border-color .2s var(--ease);
}
.appbar.on{
  background:color-mix(in srgb, var(--bg) 84%, transparent);
  -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
  border-block-end-color:var(--line);
}
.appbar-title{
  flex:1 1 auto; min-width:0; font-weight:800; font-size:.95rem;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  opacity:0; transform:translateY(-.4rem); pointer-events:none;
  transition:opacity .2s var(--ease), transform .2s var(--ease);
}
.appbar.on .appbar-title{opacity:1; transform:none}
.appbar-title b{color:var(--accent); font-variant-numeric:tabular-nums}
.appbar-title em{font-style:normal; color:var(--muted); font-weight:400}
.appbar-actions{display:flex; gap:.4rem; flex:0 0 auto}
/* Anything scrolled to must clear the bar. */
html{scroll-padding-block-start:5rem}
.panel h2{scroll-margin-block-start:5rem}
```

- [ ] **Step 2: החלף את ה-markup**

ב-`<main id="app">`, החלף את שתי השורות הראשונות (`<div class="hero-mini" ...>`
ו-`<div class="topbar">...</div>`) ב:

```html
<header class="appbar" id="appbar">
  <div class="appbar-title" id="heroMini" aria-hidden="true"></div>
  <div class="appbar-actions">
    <a class="iconbtn" href="../" aria-label="חזרה לאוסף הכלים" id="btnHome"></a>
    <button class="iconbtn" id="btnTheme" type="button" aria-label="החלף מצב תצוגה" aria-pressed="true"></button>
    <button class="iconbtn" id="btnSettings" type="button" aria-label="הגדרות"></button>
  </div>
</header>
```

- [ ] **Step 3: החלף את היעד של ה-toggle ב-`motion.init`**

ב-`motion.init`, בתוך ה-`requestAnimationFrame`, החלף את הבלוק
`const mini = document.getElementById('heroMini'); if (mini) {...}` ב:

```js
        const bar = document.getElementById('appbar');
        const mini = document.getElementById('heroMini');
        if (bar) {
          const on = t > 0.72;
          bar.classList.toggle('on', on);
          if (mini) mini.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
```

- [ ] **Step 4: הגדל את כפתורי הפעולה ל-44px**

בכלל `.iconbtn`, החלף `width:40px; height:40px` ב-`width:44px; height:44px`.

- [ ] **Step 5: מדוד שאין יותר חפיפה**

עם השרת המקומי רץ, שמור כ-`/tmp/check1.mjs` והרץ `node /tmp/check1.mjs`:

```js
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')
      && existsSync(`/opt/pw-browsers/${d}/chrome-linux/chrome`))
    exe = `/opt/pw-browsers/${d}/chrome-linux/chrome`;
const b = await chromium.launch({ executablePath: exe });
for (const w of [320, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 700 }, colorScheme: 'dark' });
  await p.addInitScript(() => localStorage.setItem('service-countdown.v1', JSON.stringify(
    { v:1, profile:{ enlistDate:'2025-03-02', releaseDate:'2027-11-02', months:32 },
      events:[], heroId:'release', theme:'dark', unit:'days', accent:'amber' })));
  await p.goto('http://localhost:8777/service-countdown/');
  await p.evaluate(() => window.scrollTo(0, 800));
  await p.waitForTimeout(500);
  console.log(w, await p.evaluate(() => {
    const t = document.getElementById('heroMini');
    const a = document.querySelector('.appbar-actions');
    const tr = t.getBoundingClientRect(), ar = a.getBoundingClientRect();
    return { clipped: t.scrollWidth > t.clientWidth + 1,
             overlap: !(tr.right <= ar.left || tr.left >= ar.right) };
  }));
  await p.close();
}
await b.close();
```

Expected: `320 { clipped: false, overlap: false }` ו-`390 { clipped: false, overlap: false }`.
(אם `clipped:true` ב-320 — זה תקין רק אם ה-ellipsis מוצג; הדרישה המחייבת היא
`overlap:false` בשני הרוחבים.)

- [ ] **Step 6: שער איכות**

```bash
node .claude/tools/verify-all.mjs --structural
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/s1.png dark 320
```
Expected: `overflow=false`, `console_errors=[]`.

- [ ] **Step 7: Commit**

```bash
git add service-countdown/index.html
git commit -m "fix(countdown): merge the two fixed top layers into one app bar"
```

---

## Task 2: קרובים קודם, עבר בקבוצה מקופלת

**למה:** מדוד — סדר האירועים בפועל הוא
`[עברו 425, עברו 353, נשארו 5, נשארו 37, נשארו 450]`. אפליקציית ספירה לאחור
שמובילה בעבר סותרת את עצמה, והאירוע הדחוף (5 ימים) קבור שלישי.

**Files:**
- Modify: `service-countdown/index.html` — `store` (פונקציה חדשה), `render.events`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `store.groupedEvents(state, todayISO?) -> { upcoming: Event[], past: Event[] }`
  — `upcoming` ממוין עולה (הקרוב ראשון), `past` ממוין יורד (האחרון ראשון).
  שתי הרשימות מכילות את אותם אובייקטים ש-`allEvents` מחזיר (כולל `baseDate`,
  `virtual`, `every`).

- [ ] **Step 1: כתוב את הבדיקה הנופלת**

הוסף בסוף `service-countdown/test/dates.test.mjs`, **לפני** שורת
`console.log(\`${passed} passed\`);`:

```js
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
```

- [ ] **Step 2: הרץ ואמת שהיא נופלת**

```bash
node service-countdown/test/dates.test.mjs
```
Expected: `FAIL: groupedEvents puts the nearest upcoming event first` עם
`store.groupedEvents is not a function`.

- [ ] **Step 3: מימוש מינימלי**

ב-`store`, מיד אחרי הפונקציה `heroEvent`, הוסף:

```js
  // Upcoming first, nearest first; the past goes into its own bucket, newest
  // first. allEvents sorts ascending, which for a soldier mid-service means
  // the screen opened on "425 days ago" -- the opposite of what a countdown is.
  function groupedEvents(state, todayISO) {
    const today = todayISO || dates.todayISO();
    const all = allEvents(state, today);
    return {
      upcoming: all.filter(e => e.date >= today),
      past: all.filter(e => e.date < today).reverse(),
    };
  }
```

ובשורת ה-`return` של `store`, הוסף `groupedEvents` אחרי `heroEvent`.

- [ ] **Step 4: הרץ ואמת שעוברת**

```bash
node service-countdown/test/dates.test.mjs
```
Expected: `64 passed` (61 + 3), ללא `FAIL`.

- [ ] **Step 5: CSS לקבוצת ההיסטוריה**

הוסף מיד אחרי הכלל `.ev-row+.ev-row`:

```css
.ev-past{margin-block-start:1.1rem}
.ev-past>summary{
  list-style:none; cursor:pointer; color:var(--muted); font-size:.9rem;
  font-weight:700; padding:.7rem .2rem; display:flex; align-items:center; gap:.4rem;
  min-height:44px;
}
.ev-past>summary::-webkit-details-marker{display:none}
.ev-past>summary .ico{width:16px; height:16px; transition:transform .18s var(--ease)}
.ev-past[open]>summary .ico{transform:rotate(180deg)}
.ev-past .ev{opacity:.72}
```

- [ ] **Step 6: הרכב את הרשימה משתי הקבוצות**

ב-`render.events`, החלף את השורה `const list = store.allEvents(state);` ב:

```js
    const { upcoming, past } = store.groupedEvents(state, today);
    const list = upcoming.concat(past);
```

החלף את הבדיקה `if (list.length === 0)` ואת הלולאה `for (const ev of list)`
במבנה הבא — שים לב שגוף הלולאה עצמו (בניית `wrap`) לא משתנה, רק הוצא לפונקציה
פנימית ונקרא פעמיים:

```js
    if (list.length === 0) {
      host.append(el('p', { class: 'ev-d' }, 'אין עדיין אירועים. הוסיפו אחד כדי להתחיל לספור.'));
      return;
    }

    // `row(ev)` is the exact body the old loop had; only the call sites moved.
    const buildRow = ev => {
      const left = dates.daysBetween(today, ev.date);
      const soon = left >= 0 && left <= 7;
      const row = el('button', { class: 'ev' + (soon ? ' soon' : ''), type: 'button' });
      row.append(el('span', { class: 'chip-ico' }, icon(ev.icon)));
      const mid = el('span', { class: 'ev-grow' });
      mid.append(el('span', { class: 'ev-t' }, ev.title));
      mid.append(el('span', { class: 'ev-d' }, dates.formatHe(ev.date)));
      if (ev.baseDate) {
        mid.append(el('span', { class: 'ev-d' },
          `חוזר כל ${dates.hebrewDays(state.events.find(x => x.id === ev.id).every)}`));
      }
      row.append(mid);
      row.append(el('span', { class: 'ev-days' }, dates.remainingLabel(left)));
      row.onclick = () => { state.heroId = ev.id; store.save(state); refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' }); };

      const wrap = el('div', { class: 'ev-row' });
      wrap.append(row);
      if (!ev.virtual) {                       // release comes from the profile
        const edit = el('button', { class: 'ev-del', type: 'button',
          'aria-label': 'ערוך ' + ev.title }, icon('settings'));
        edit.onclick = () => eventSheet(state, refresh, state.events.find(x => x.id === ev.id));
        wrap.append(edit);
        const del = el('button', { class: 'ev-del', type: 'button', 'aria-label': 'מחק ' + ev.title },
          icon('trash'));
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
        wrap.append(del);
      }
      return wrap;
    };

    for (const ev of upcoming) host.append(buildRow(ev));

    if (past.length > 0) {
      const box = el('details', { class: 'ev-past' });
      const sum = el('summary', {});
      sum.append(el('span', { class: 'ico' }, icon('chevron-down')));
      sum.append(el('span', {}, `מה שכבר עבר · ${past.length}`));
      box.append(sum);
      for (const ev of past) box.append(buildRow(ev));
      host.append(box);
    }
```

- [ ] **Step 7: אמת ויזואלית**

```bash
node .claude/tools/verify-all.mjs --structural
node service-countdown/test/dates.test.mjs
```
פתח את הכלי בשרת המקומי עם מצב מזורע ובדוק: השורה הראשונה תחת "אירועים" היא
הקרובה ביותר, וההיסטוריה מקופלת מתחת תחת "מה שכבר עבר · N".

- [ ] **Step 8: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): lead with the next event, fold the past away"
```

---

## Task 3: שורת אירוע שלא קורסת ב-320px

**למה:** `.ev` הוא `flex-wrap:wrap` עם שלושה ילדים שלא נכנסים לשורה ב-320px, אז
האייקון נשאר לבד בשורה, הטקסט בשנייה, הספירה בשלישית. וכפתורי העריכה/המחיקה
יושבים מחוץ לכרטיס, ~120px ממנו, ב-40×40 צמודים זה לזה.

**Files:**
- Modify: `service-countdown/index.html` — CSS (`.ev`, `.ev-days`, `.ev-del`, `.ev-row`)

**Interfaces:**
- Consumes: המבנה שנבנה ב-`buildRow` (משימה 2) — `.chip-ico`, `.ev-grow`, `.ev-days`.
  **אין שינוי ב-JS במשימה הזאת**, רק ב-CSS.

- [ ] **Step 1: החלף את `.ev` ל-grid דו-שורתי**

החלף את הכלל `.ev{...}` (זה שמתחיל `display:flex; align-items:center; gap:.7rem;`) ב:

```css
/* Grid, not wrapping flex: at 320px the three flex children could not share a
   row, so the icon sat alone on line 1, the text on line 2 and the count on
   line 3. The grid keeps the icon and title on one row and lets only the count
   drop, which is the one thing that may. */
.ev{display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.25rem .7rem;
  align-items:center; width:100%; text-align:start;
  padding:.85rem; border-radius:var(--r);
  background:var(--card); border:1px solid var(--line); box-shadow:var(--shadow);
  color:inherit; font:inherit; cursor:pointer;
  transition:transform .18s var(--ease), border-color .18s var(--ease)}
```

מחק את `margin-bottom:.6rem` שהיה בכלל הישן — המרווח מגיע מ-`.ev-row+.ev-row`.

- [ ] **Step 2: התאם את שלושת הילדים לגריד**

החלף את `.ev-grow` ואת `.ev-days`:

```css
.ev-grow{display:flex; flex-direction:column; gap:.15rem; min-width:0}
.ev-t{font-weight:800; overflow-wrap:anywhere}
.ev-d{color:var(--muted); font-size:.85rem}
.ev-days{font-weight:800; color:var(--accent); font-variant-numeric:tabular-nums;
  white-space:nowrap; justify-self:end}
/* Under ~360px the count moves to its own full-width row instead of squeezing
   the title into two characters per line. */
@media (max-width: 359px){
  .ev{grid-template-columns:auto minmax(0,1fr)}
  .ev-days{grid-column:1 / -1; justify-self:start; padding-inline-start:calc(38px + .7rem)}
}
```

- [ ] **Step 3: החזר את כפתורי הפעולה אל הכרטיס**

החלף את `.ev-del` ואת `.ev-row`:

```css
.ev-del{flex:none; width:44px; height:44px; display:inline-flex; align-items:center;
  justify-content:center; border-radius:12px; border:1px solid transparent;
  background:transparent; color:var(--muted); cursor:pointer; font:inherit; opacity:.65;
  transition:opacity .18s var(--ease), border-color .18s var(--ease)}
.ev-del:hover,.ev-del:focus-visible{opacity:1; border-color:var(--line-strong); color:var(--ink)}
.ev-del svg{width:18px;height:18px}
/* The actions used to sit outside the card, flush to the screen edge, ~120px
   away from the row they act on. They now hug it. */
.ev-row{display:flex; align-items:stretch; gap:.35rem}
.ev-row .ev{flex:1 1 auto; min-width:0}
.ev-row+.ev-row{margin-top:.6rem}
.ev-actions{display:flex; flex-direction:column; justify-content:center; gap:.2rem;
  flex:0 0 auto}
```

- [ ] **Step 4: עטוף את שני הכפתורים ב-`.ev-actions`**

ב-`buildRow` (משימה 2), החלף את כל בלוק `if (!ev.virtual) { ... }` בגרסה הבאה.
ההבדל היחיד: `edit` ו-`del` נכנסים ל-`.ev-actions` במקום ישירות ל-`wrap`.

```js
      if (!ev.virtual) {                       // release comes from the profile
        const edit = el('button', { class: 'ev-del', type: 'button',
          'aria-label': 'ערוך ' + ev.title }, icon('settings'));
        edit.onclick = () => eventSheet(state, refresh, state.events.find(x => x.id === ev.id));
        const del = el('button', { class: 'ev-del', type: 'button', 'aria-label': 'מחק ' + ev.title },
          icon('trash'));
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
        const actions = el('div', { class: 'ev-actions' });
        actions.append(edit, del);
        wrap.append(actions);
      }
```

- [ ] **Step 5: אמת ב-320 וב-390**

```bash
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/e320.png dark 320
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/e390.png dark 390
```
Expected: `overflow=false` בשניהם. קרא את הצילומים: האייקון והכותרת באותה שורה,
הכפתורים צמודים לכרטיס.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "fix(countdown): event rows survive 320px, actions hug the card"
```

---

## Task 4: אירוע חוזר מיוצא ליומן כאירוע חוזר

**למה:** באג. `ics.build` מקבל את הרשימה **אחרי** שהאירוע החוזר גולגל למופע הבא
היחיד, ו-`RRULE` לא נכתב בשום מקום. משתמש עם "רגילה כל 21 ימים" מייצא ליומן
ומקבל תזכורת אחת בחיים.

**Files:**
- Modify: `service-countdown/index.html` — `ics.build`, `render.settings` (`#sIcs`)
- Test: `service-countdown/test/ics.test.mjs`

**Interfaces:**
- Produces: `ics.build(events, alarmDays, untilISO?)` — `events` הוא
  `{ title: string, date: string, every?: number }[]`. כשם-`every > 0` נכתב
  `RRULE:FREQ=DAILY;INTERVAL=<every>`, ואם הועבר `untilISO` מתווסף `;UNTIL=<stamp>`.

- [ ] **Step 1: כתוב את הבדיקות הנופלות**

הוסף ב-`service-countdown/test/ics.test.mjs`, לפני `console.log`:

```js
t('build writes an RRULE for a repeating event', () => {
  const out = ics.build([{ title: 'רגילה', date: '2026-08-01', every: 21 }], 1);
  assert.ok(out.includes('RRULE:FREQ=DAILY;INTERVAL=21'), out);
});

t('build bounds the recurrence when an end date is given', () => {
  const out = ics.build([{ title: 'רגילה', date: '2026-08-01', every: 21 }], 1, '2027-11-02');
  assert.ok(out.includes('RRULE:FREQ=DAILY;INTERVAL=21;UNTIL=20271102'), out);
});

t('build writes no RRULE for a one-off event', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-02' }], 1);
  assert.ok(!out.includes('RRULE'), out);
});

t('build names the calendar', () => {
  const out = ics.build([{ title: 'שחרור', date: '2027-11-02' }], 1);
  assert.ok(out.includes('X-WR-CALNAME:הספירה'), out);
});
```

- [ ] **Step 2: הרץ ואמת שהן נופלות**

```bash
node service-countdown/test/ics.test.mjs
```
Expected: 4 שורות `FAIL`, אחת לכל בדיקה חדשה.

- [ ] **Step 3: מימוש**

ב-`ics`, החלף את חתימת `build` ואת גוף הלולאה:

```js
  function build(events, alarmDays, untilISO) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hasfira//service-countdown//HE',
                   'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:הספירה'];
    let seq = 0;
    for (const ev of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${stamp(ev.date)}-${seq++}@hasfira.local`);
      lines.push(`DTSTAMP:${stamp(dates.todayISO())}T000000Z`);
      // All-day events use an exclusive DTEND: the day after the event.
      lines.push(`DTSTART;VALUE=DATE:${stamp(ev.date)}`);
      lines.push(`DTEND;VALUE=DATE:${stamp(dates.addDays(ev.date, 1))}`);
      // A repeating event has to leave here as a recurrence, not as the single
      // rolled-forward occurrence the app happens to be showing today.
      if (ev.every > 0) {
        lines.push(`RRULE:FREQ=DAILY;INTERVAL=${ev.every}` +
                   (untilISO ? `;UNTIL=${stamp(untilISO)}` : ''));
      }
      lines.push(`SUMMARY:${esc(ev.title)}`);
      lines.push('TRANSP:TRANSPARENT');
      if (alarmDays > 0) {
```
(שאר הגוף — בלוק ה-`VALARM` ו-`END:VEVENT` — נשאר כמו שהוא.)

- [ ] **Step 4: הרץ ואמת שעוברות**

```bash
node service-countdown/test/ics.test.mjs
```
Expected: כל הבדיקות עוברות, `FAIL` לא מופיע.

- [ ] **Step 5: העבר את התאריך הבסיסי ואת ה-`every` מהמסך**

ב-`render.settings`, ב-handler של `#sIcs`, החלף את שורת ה-`rows` ואת בניית ה-blob:

```js
      // baseDate, not the rolled occurrence: the recurrence has to start where
      // the user actually set it, or the calendar's series is off by a cycle.
      const rows = store.allEvents(state).map(e => ({
        title: e.title, date: e.baseDate || e.date, every: e.every || 0 }));
      if (rows.length === 0) { err.textContent = 'אין עדיין אירועים לייצא'; return; }
      const until = state.profile ? state.profile.releaseDate : null;
      const blob = new Blob([ics.build(rows, 1, until)], { type: 'text/calendar' });
```

- [ ] **Step 6: שער איכות + Commit**

```bash
node service-countdown/test/ics.test.mjs
node service-countdown/test/dates.test.mjs
node .claude/tools/verify-all.mjs --structural
git add service-countdown/index.html service-countdown/test/ics.test.mjs
git commit -m "fix(countdown): export a repeating event as a real recurrence"
```

---

## Task 5: יומן ספירה יומי — ההתראה שאפשר לבנות בלי שרת

**למה:** `Notification Triggers` מעולם לא יצא מניסוי, ו-Web Push דורש שרת. אבל
אפשר לייצר קובץ יומן שבו כל אחד מ-N הימים הבאים הוא אירוע יום-שלם שהכותרת שלו
היא **המספר עצמו**. היומן של המערכת יציג "שחרור · נשארו 449 ימים" בשורת האירועים
של כל בוקר. זו התראה יומית אמיתית, אופליין, בלי הרשאה ובלי חשבון.

**Files:**
- Modify: `service-countdown/index.html` — `ics` (פונקציה חדשה), `render.settings`
- Test: `service-countdown/test/ics.test.mjs`

**Interfaces:**
- Consumes: `ics.build` (משימה 4), `dates.addDays`, `dates.daysBetween`,
  `dates.remainingLabel`.
- Produces: `ics.countdownRows(title, targetISO, fromISO, days) -> {title,date}[]`
  — שורה ליום, עוצרת ביום היעד עצמו (כולל), ולעולם לא חורגת ממנו.

- [ ] **Step 1: כתוב את הבדיקות הנופלות**

הוסף ב-`service-countdown/test/ics.test.mjs`, לפני `console.log`:

```js
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
```

- [ ] **Step 2: הרץ ואמת שהן נופלות**

```bash
node service-countdown/test/ics.test.mjs
```
Expected: `ics.countdownRows is not a function` בשלוש הבדיקות.

- [ ] **Step 3: מימוש**

ב-`ics`, מיד אחרי `build`, הוסף:

```js
  // One all-day row per day, whose SUMMARY is the count itself. A PWA cannot
  // schedule a local notification -- Notification Triggers never shipped and
  // Web Push needs a server -- but the system calendar will happily show
  // "שחרור · נשארו 449 ימים" every morning, offline and with no permission.
  function countdownRows(title, targetISO, fromISO, days) {
    const rows = [];
    for (let i = 0; i < days; i++) {
      const day = dates.addDays(fromISO, i);
      const left = dates.daysBetween(day, targetISO);
      if (left < 0) break;
      rows.push({ title: `${title} · ${dates.remainingLabel(left)}`, date: day });
    }
    return rows;
  }
```

והחלף את שורת ה-`return` של `ics` ב:

```js
  return { build, countdownRows, filename };
```

- [ ] **Step 4: הרץ ואמת שעוברות**

```bash
node service-countdown/test/ics.test.mjs
```
Expected: כל הבדיקות עוברות.

- [ ] **Step 5: חבר כפתור בהגדרות**

ב-`render.settings`, ב-`box.innerHTML`, מיד אחרי הכפתור `#sIcs`, הוסף בתוך
אותו `.row`:

```html
        <button class="btn" id="sDaily" type="button">יומן ספירה יומי</button>
```

והוסף את ה-handler מיד אחרי ה-handler של `#sIcs`:

```js
    box.querySelector('#sDaily').onclick = () => {
      const ev = store.heroEvent(state);
      if (!ev) { err.textContent = 'אין עדיין ספירה'; return; }
      const rows = ics.countdownRows(ev.title, ev.date, dates.todayISO(), 100);
      if (rows.length === 0) { err.textContent = 'האירוע כבר עבר'; return; }
      const blob = new Blob([ics.build(rows, 0)], { type: 'text/calendar' });
      const a = el('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ha-sfira-daily.ics';
      a.click();
      URL.revokeObjectURL(a.href);
      err.textContent = `נוספו ${rows.length} ימים ליומן`;
    };
```

ועדכן את פסקת ההסבר שמתחת (זו שמתחילה `"הוסף ליומן" מוריד קובץ`):

```html
      <p class="ev-d">"הוסף ליומן" מוריד את כל האירועים עם תזכורת יום מראש.
        "יומן ספירה יומי" מוסיף שורה לכל אחד מ-100 הימים הבאים, שהכותרת שלה היא
        המספר עצמו — כך רואים את הספירה בכל בוקר בלי לפתוח כלום. הכול מהיומן של
        המכשיר, בלי שרת ובלי חשבון.</p>
```

- [ ] **Step 6: אמת ידנית**

פתח את ההגדרות בשרת המקומי, לחץ "יומן ספירה יומי", ובדוק את הקובץ שירד:

```bash
grep -c 'BEGIN:VEVENT' ~/Downloads/ha-sfira-daily.ics   # או נתיב ההורדה בסביבה
head -20 ~/Downloads/ha-sfira-daily.ics
```
Expected: 100 אירועים, ה-`SUMMARY` הראשון מכיל את מספר הימים של היום.

- [ ] **Step 7: Commit**

```bash
git add service-countdown/index.html service-countdown/test/ics.test.mjs
git commit -m "feat(countdown): a daily countdown calendar, the reminder a PWA can ship"
```

---

## Task 6: מלכודת פוקוס, ניטרול הרקע, וניגודיות הרמז

**למה:** מדוד — מגיליון עם `aria-modal="true"` פתוח, אחרי 14 Tab הפוקוס יוצא
לרכיבים שמאחור. `#app` לא מקבל `inert` ולא `aria-hidden`. בנוסף, שורת הרמז
מתחת לגיבור היא 3.28:1 ב-12.8px — מתחת ל-4.5:1 — והיא בדיוק הטקסט שמלמד את שתי
המחוות הנסתרות של הכלי.

**Files:**
- Modify: `service-countdown/index.html` — `render.openSheet`, CSS (`.hero-meta`)

**Interfaces:**
- Consumes: `render.openSheet(node, onClose) -> dismiss(fn?)` — החתימה **לא משתנה**.

- [ ] **Step 1: נטרל את הרקע וללכוד את הפוקוס**

ב-`render.openSheet`, מיד אחרי `document.body.append(node);`, הוסף:

```js
    // aria-modal is a promise the DOM has to keep: without inert, Tab walks
    // straight out of the sheet into the page behind it (measured: escape on
    // the 15th Tab). `inert` also removes the background from the a11y tree.
    const app = document.getElementById('app');
    if (app) app.inert = true;
```

ובתוך `close`, מיד אחרי `node.remove();`, הוסף:

```js
      if (app) app.inert = false;
```

- [ ] **Step 2: לכידת Tab בתוך הגיליון**

החלף את `const onKey = e => { ... };` ב:

```js
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                      'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); history.back(); return; }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll(FOCUSABLE)]
        .filter(n => n.offsetParent !== null || n === document.activeElement);
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
```

> `inert` על `#app` כבר מונע יציאה בדפדפנים שתומכים בו; לולאת ה-Tab היא הרשת
> השנייה, והיא זו שמחזירה את הפוקוס אל תחילת הגיליון במקום אל סרגל הדפדפן.

- [ ] **Step 3: תקן את ניגודיות הרמז**

ב-`render.hero`, החלף את שורת הרמז:

```js
    host.append(el('div', { class: 'hero-hint' },
      'לחיצה על המספר מחליפה יחידה · לחיצה ארוכה לספירה חיה'));
```

והוסף ב-CSS, מיד אחרי `.hero-meta`:

```css
/* Was .hero-meta at opacity .6 -- an effective rgb(100,104,90) on #13140f,
   3.28:1 at 12.8px. This is the line that teaches both hidden gestures, so it
   is the last line that may be hard to read. */
.hero-hint{color:var(--muted); font-size:.85rem; margin-top:.75rem; max-width:22rem}
```

- [ ] **Step 4: אמת את מסלול ה-Tab**

שמור כ-`/tmp/check6.mjs` והרץ `node /tmp/check6.mjs`:

```js
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')
      && existsSync(`/opt/pw-browsers/${d}/chrome-linux/chrome`))
    exe = `/opt/pw-browsers/${d}/chrome-linux/chrome`;
const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await p.goto('http://localhost:8777/service-countdown/');
  await p.click('#btnSettings');
  await p.waitForTimeout(400);
  const trail = [];
  for (let i = 0; i < 30; i++) {
    await p.keyboard.press('Tab');
    trail.push(await p.evaluate(() => document.activeElement.closest('.sheet') ? 'in' : 'OUT'));
  }
  console.log('escapes:', trail.filter(x => x === 'OUT').length);
  console.log('inert:', await p.evaluate(() => document.getElementById('app').inert));
await b.close();
```
Expected: `escapes: 0` ו-`inert: true`.

- [ ] **Step 5: אמת ניגודיות**

```bash
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/h.png dark 390
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/hl.png light 390
```
`--muted` על `--bg` בלי opacity הוא 6.4:1 בחושך ו-4.9:1 באור — שניהם עוברים AA.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "fix(countdown): trap focus in sheets, inert the page, fix hint contrast"
```

---

## Task 7: "עוד N רגילות" — הסטטיסטיקה שאין לאף מתחרה

**למה:** שלושה מארבעת התאים ב"כמה כבר עשית" הם אותה עובדה בשלוש יחידות, והרביעי
("שבתות שעברו") הוא מדד שאיש לא ביקש. המספר שכל חייל מחשב בראש ואף אפליקציה לא
מציגה הוא **כמה פעמים הוא עוד יוצא הביתה**. אצלנו הוא נגזר ישירות מנתונים
שכבר קיימים: אירוע חוזר עם `every`.

**Files:**
- Modify: `service-countdown/index.html` — `dates` (פונקציה חדשה), `render.stats`
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `dates.occurrencesUntil(startISO, everyDays, fromISO, toISO) -> number`
  — כמה מופעים של מחזור קבוע נופלים בטווח `[fromISO, toISO]` כולל. מחזיר `0`
  למחזור לא חוקי או לטווח הפוך.

- [ ] **Step 1: כתוב את הבדיקות הנופלות**

הוסף ב-`service-countdown/test/dates.test.mjs`, לפני `console.log`:

```js
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
```

- [ ] **Step 2: הרץ ואמת שהן נופלות**

```bash
node service-countdown/test/dates.test.mjs
```
Expected: `dates.occurrencesUntil is not a function`.

- [ ] **Step 3: מימוש**

ב-`dates`, מיד אחרי `nextOccurrence`, הוסף:

```js
  // How many times a fixed cycle lands inside [fromISO, toISO], inclusive.
  // Built on nextOccurrence so a cycle crossing a DST boundary keeps its
  // weekday, and on daysBetween so the span is calendar days, not milliseconds.
  function occurrencesUntil(startISO, everyDays, fromISO, toISO) {
    if (!everyDays || everyDays <= 0) return 0;
    const span = daysBetween(fromISO, toISO);
    if (span < 0) return 0;
    const first = nextOccurrence(startISO, everyDays, fromISO);
    const reach = daysBetween(first, toISO);
    if (reach < 0) return 0;
    return Math.floor(reach / everyDays) + 1;
  }
```

והוסף `occurrencesUntil` לשורת ה-`return` של `dates`, אחרי `nextOccurrence`.

- [ ] **Step 4: הרץ ואמת שעוברות**

```bash
node service-countdown/test/dates.test.mjs
```
Expected: אין `FAIL`.

- [ ] **Step 5: החלף את ארבעת התאים**

ב-`render.stats`, החלף את הבלוק שמתחיל ב-`const rows = [` ומסתיים ב-`];` ב:

```js
    const pct = dates.progressPct(p.enlistDate, p.releaseDate, today);
    const rows = [
      ['ימים בשירות', String(served)],
      ['ימים שנשארו', String(left)],
      ['מהפז״מ מאחוריך', `${pct}%`],
    ];
    // The one number a soldier actually computes in their head, and no
    // competitor shows: how many times they still go home. Derived from the
    // user's own repeating event -- no assumption about their unit's cycle.
    const cycle = state.events.find(e => e.every > 0);
    if (cycle) {
      rows.push([`עוד ${cycle.title}`,
        String(dates.occurrencesUntil(cycle.date, cycle.every, today, p.releaseDate))]);
    } else {
      rows.push(['עוד שבתות', String(dates.countWeekday(today, p.releaseDate, 6))]);
    }
```

מחק את שורת `const upTo = served > 0 ? today : p.enlistDate;` — היא לא בשימוש יותר.

- [ ] **Step 6: אמת ויזואלית**

```bash
node service-countdown/test/dates.test.mjs
node .claude/tools/verify-all.mjs --structural
```
בשרת המקומי, במצב מזורע עם "רגילה הבאה · כל 21 ימים": התא הרביעי אמור לקרוא
"עוד רגילה הבאה" עם מספר דו-ספרתי. בלי אירוע חוזר — "עוד שבתות".

- [ ] **Step 7: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): count the trips home, not the same day three ways"
```

---

## Task 8: רשת הפז"מ — כל השירות בתמונה אחת

**למה:** נקודה לכל יום שירות, מלאה = יום שנעשה. זה הפריט הכי שיתופי שאפשר לייצר
מהמודל הקיים, הוא בשפה העיצובית של האוסף (גיאומטריה, לא גרפיקה), והוא נותן
תשובה רגשית לשאלה ש-450 לא נותן: **כמה מזה כבר מאחוריי.**

**Files:**
- Modify: `service-countdown/index.html` — CSS, `render` (פונקציה חדשה),
  markup (`<main>`), `refresh()`

**Interfaces:**
- Consumes: `state.profile`, `dates.daysBetween`, `dates.addDays`, `store.allEvents`.
- Produces: `render.grid(state)` — מרנדר לתוך `#grid`. יוצא מוקדם בלי פרופיל.

- [ ] **Step 1: הוסף את הסקשן ל-markup**

ב-`<main id="app">`, בין `<section class="panel" id="stats"></section>` לבין
`<section class="panel" id="events"></section>`, הוסף:

```html
  <section class="panel" id="grid"></section>
```

- [ ] **Step 2: CSS**

הוסף מיד אחרי הכלל `.stat-l`:

```css
/* One dot per day of service. auto-fill with a minimum keeps the row count
   sane from 320px to 640px without a media query, and aspect-ratio keeps the
   dots round however many land in a row. */
.pgrid{display:grid; grid-template-columns:repeat(auto-fill, minmax(7px, 1fr));
  gap:3px; padding:.9rem; border-radius:var(--r);
  background:var(--card); border:1px solid var(--line); box-shadow:var(--shadow)}
.pgrid i{display:block; aspect-ratio:1; border-radius:50%;
  background:var(--line-strong); opacity:.55}
.pgrid i.done{background:var(--accent); opacity:.85}
.pgrid i.ev{background:var(--accent); opacity:1;
  box-shadow:0 0 0 1.5px color-mix(in srgb, var(--accent) 35%, transparent)}
.pgrid i.now{background:var(--ink); opacity:1;
  box-shadow:0 0 0 2.5px color-mix(in srgb, var(--ink) 25%, transparent)}
.pgrid-legend{display:flex; flex-wrap:wrap; gap:.9rem; margin-top:.7rem;
  color:var(--muted); font-size:.8rem}
.pgrid-legend span{display:inline-flex; align-items:center; gap:.35rem}
.pgrid-legend i{width:8px; height:8px; border-radius:50%; display:inline-block}
```

- [ ] **Step 3: מימוש הרינדור**

ב-`render`, מיד אחרי הפונקציה `stats`, הוסף:

```js
  // 970-odd dots is a lot of nodes, but they are leaf <i> elements with no
  // listeners and the panel is rendered once per refresh -- cheaper than a
  // canvas that would have to be redrawn on every theme switch.
  function grid(state) {
    const host = document.getElementById('grid');
    host.innerHTML = '';
    if (!state.profile) return;
    const p = state.profile, today = dates.todayISO();
    const total = dates.daysBetween(p.enlistDate, p.releaseDate);
    if (total <= 0 || total > 4000) return;   // a nonsense range draws nothing

    const marks = new Set(store.allEvents(state).map(e => e.date));
    host.append(el('h2', {}, 'רשת הפז״מ'));
    const box = el('div', { class: 'pgrid', role: 'img',
      'aria-label': `רשת של ${total} ימי שירות, ${Math.max(0, dates.daysBetween(p.enlistDate, today))} מהם מאחוריך` });
    for (let i = 0; i <= total; i++) {
      const iso = dates.addDays(p.enlistDate, i);
      let cls = iso < today ? 'done' : '';
      if (marks.has(iso)) cls = 'ev';
      if (iso === today) cls = 'now';
      box.append(el('i', cls ? { class: cls } : {}));
    }
    host.append(box);
    const legend = el('div', { class: 'pgrid-legend' });
    for (const [cls, label] of [['done', 'נעשה'], ['now', 'היום'],
                                ['ev', 'אירוע'], ['', 'לפנינו']]) {
      const s = el('span', {});
      s.append(el('i', cls ? { class: cls } : {}), el('span', {}, label));
      legend.append(s);
    }
    host.append(legend);
  }
```

והוסף `grid` לשורת ה-`return` של `render`, אחרי `stats`.

- [ ] **Step 4: חבר ל-`refresh`**

ב-`refresh()`, אחרי `render.stats(state);`, הוסף:

```js
  render.grid(state);
```

- [ ] **Step 5: אמת**

```bash
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/g320.png dark 320
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/g390.png light 390
node .claude/tools/verify-all.mjs --structural
```
Expected: `overflow=false` ו-`console_errors=[]` בשניהם. קרא את הצילומים: הנקודות
עגולות, הנקודה של היום בולטת, האזור המלא מסתיים בה.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): the pazam grid -- one dot per day of service"
```

---

## Task 9: טפט מסך נעילה — התשובה היחידה ל"ווידג'ט" שזמינה ל-PWA

**למה:** ווידג'ט מסך-נעילה חסום ל-PWA ב-iOS, ואין לזה עקיפה ישירה. **יש** עקיפה
עקיפה: לצייר ב-canvas תמונה בגודל המסך של המשתמש, עם המספר במיקום שלא מתנגש
בשעון של iOS, ולתת לו להוריד אותה ולקבוע כטפט. איש מהמתחרים לא בנה את זה — לאפליקציה
נייטיבית יש ווידג'ט אמיתי ואין לה סיבה.

**Files:**
- Modify: `service-countdown/index.html` — מודול חדש `wallpaper`, `render.settings`

**Interfaces:**
- Consumes: `card.palette` **אינה מיוצאת** — לכן `wallpaper` מחזיק פלטה משלו,
  זהה בערכיה. `store.heroEvent`, `dates.unitValue/unitName/formatHe/progressPct`.
- Produces: `wallpaper.download(state)` — מצייר ומוריד PNG בגודל המסך.

- [ ] **Step 1: הוסף את המודול**

בבלוק ה-`<script>` שמכיל את `card`, מיד אחרי `})();` שסוגר אותו ולפני
תג ה-`</script>` שאחריו, הוסף:

```js
/* ---------- wallpaper: the closest a PWA gets to a lock-screen widget ---------- */
const wallpaper = (() => {
  // Same palette values as `card`, kept local because card does not export it.
  function palette(dark) {
    return dark
      ? { bg: '#13140f', ink: '#edefe1', muted: '#9aa08c', line: '#2c2f23', accent: '#e0a33c' }
      : { bg: '#f2f1ea', ink: '#1c1e16', muted: '#6b7061', line: '#e0ded2', accent: '#8a5a12' };
  }

  // iOS paints the clock across the top ~28% of the lock screen and the
  // shortcuts across the bottom ~12%. Everything we draw lives between them.
  function draw(opts) {
    const W = opts.w, H = opts.h;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const p = palette(opts.dark);
    const font = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", Arial, sans-serif';

    g.fillStyle = p.bg; g.fillRect(0, 0, W, H);
    g.direction = 'rtl';
    g.textAlign = 'center';

    const cy = Math.round(H * 0.52);
    const r = Math.round(Math.min(W, H) * 0.26);
    g.lineWidth = Math.max(6, Math.round(W * 0.014));
    g.lineCap = 'round';
    g.strokeStyle = p.line;
    g.beginPath(); g.arc(W / 2, cy, r, 0, Math.PI * 2); g.stroke();
    if (opts.pct > 0) {
      g.strokeStyle = p.accent;
      g.beginPath();
      g.arc(W / 2, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * opts.pct) / 100);
      g.stroke();
    }

    g.fillStyle = p.muted;
    g.font = `600 ${Math.round(W * 0.045)}px ${font}`;
    g.fillText(opts.title, W / 2, cy - r - Math.round(W * 0.05), W * 0.8);

    g.fillStyle = p.accent;
    g.font = `800 ${Math.round(W * 0.22)}px ${font}`;
    g.fillText(String(opts.value), W / 2, cy + Math.round(W * 0.07), 2 * r - W * 0.08);

    g.fillStyle = p.ink;
    g.font = `800 ${Math.round(W * 0.055)}px ${font}`;
    g.fillText(opts.unit, W / 2, cy + Math.round(W * 0.17), 2 * r - W * 0.08);

    g.fillStyle = p.muted;
    g.font = `400 ${Math.round(W * 0.035)}px ${font}`;
    g.fillText(opts.dateText, W / 2, Math.round(H * 0.84));
    return c;
  }

  function size() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round((window.screen.width || 390) * dpr);
    const h = Math.round((window.screen.height || 844) * dpr);
    // Guard against a desktop screen producing a 5120px-wide phone wallpaper.
    return { w: Math.min(w, 1600), h: Math.min(h, 3600) };
  }

  async function download(state) {
    const ev = store.heroEvent(state);
    if (!ev) return false;
    const today = dates.todayISO();
    const unit = state.unit || 'days';
    const value = dates.unitValue(unit, today, ev.date);
    const pct = state.profile
      ? dates.progressPct(state.profile.enlistDate, state.profile.releaseDate, today) : 0;
    const { w, h } = size();
    const canvas = draw({ w, h, title: ev.title, value, unit: dates.unitName(unit, value),
      dateText: dates.formatHe(ev.date), pct, dark: state.theme === 'dark' });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], 'ha-sfira-wallpaper.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return true; }
      catch (e) { return true; }            // the user dismissed the share sheet
    }
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ha-sfira-wallpaper.png';
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  return { draw, size, download };
})();
```

- [ ] **Step 2: חבר כפתור בהגדרות**

ב-`render.settings`, ב-`box.innerHTML`, ב-`.row` שמכיל את `#sShare` ו-`#sCard`,
הוסף כפתור שלישי:

```html
        <button class="btn" id="sWall" type="button">טפט למסך נעילה</button>
```

והוסף handler מיד אחרי `box.querySelector('#sCard').onclick = ...`:

```js
    box.querySelector('#sWall').onclick = async () => {
      const ok = await wallpaper.download(state);
      err.textContent = ok
        ? 'נשמר. קבעו כטפט מסך נעילה — כך רואים את המספר בלי לפתוח כלום.'
        : 'אין עדיין ספירה';
    };
```

- [ ] **Step 3: אמת שהתמונה נכונה**

שמור כ-`/tmp/wall.mjs` והרץ `node /tmp/wall.mjs`:

```js
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
const g = execSync('npm root -g').toString().trim();
const { chromium } = (await import(g + '/playwright/index.js')).default;
let exe; for (const d of readdirSync('/opt/pw-browsers'))
  if (d.startsWith('chromium-') && !d.includes('headless_shell')
      && existsSync(`/opt/pw-browsers/${d}/chrome-linux/chrome`))
    exe = `/opt/pw-browsers/${d}/chrome-linux/chrome`;
const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
await p.goto('http://localhost:8777/service-countdown/');
const data = await p.evaluate(() => wallpaper.draw({ w: 1170, h: 2532, title: 'שחרור',
  value: 450, unit: 'ימים', dateText: '2 בנובמבר 2027', pct: 54, dark: true })
  .toDataURL('image/png'));
writeFileSync('/tmp/wall.png', Buffer.from(data.split(',')[1], 'base64'));
console.log('bytes:', data.length);
await b.close();
```
Expected: `bytes:` גדול מ-10000, והקובץ `/tmp/wall.png` נוצר.
קרא את `/tmp/wall.png` ואמת: המספר במרכז הטבעת, שום טקסט לא חורג, השליש העליון
פנוי לשעון.

- [ ] **Step 4: שער איכות + Commit**

```bash
node .claude/tools/verify-all.mjs --structural
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/w.png dark 390
git add service-countdown/index.html
git commit -m "feat(countdown): draw a lock-screen wallpaper, the widget a PWA can have"
```

---

## Task 10: דחיית שחרור — הדבר שקורה באמת

**למה:** דחיית שחרור היא אירוע נפוץ, וכרגע הדרך היחידה להתמודד איתה היא לערוך את
הפרופיל ולאבד את העובדה שזה קרה. אפליקציה שמלווה 32 חודשים צריכה לזכור שהתאריך זז.

**Files:**
- Modify: `service-countdown/index.html` — `store` (פונקציה חדשה),
  `render.hero`, `render.settings`, CSS
- Test: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Produces: `store.postponeRelease(state, newISO) -> boolean` — מעדכן את
  `profile.releaseDate` ומוסיף רשומה ל-`profile.history` (מערך של
  `{ from, to }`). מחזיר `false` בלי פרופיל, בלי תאריך, או כשאין שינוי.
- Produces: `store.postponedDays(state) -> number` — סך הימים שהתאריך זז
  (חיובי = נדחה, שלילי = הוקדם). `0` כשאין היסטוריה.

- [ ] **Step 1: כתוב את הבדיקות הנופלות**

הוסף ב-`service-countdown/test/dates.test.mjs`, לפני `console.log`:

```js
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
```

- [ ] **Step 2: הרץ ואמת שהן נופלות**

```bash
node service-countdown/test/dates.test.mjs
```
Expected: `store.postponeRelease is not a function`.

- [ ] **Step 3: מימוש**

ב-`store`, מיד אחרי `restoreEvent`, הוסף:

```js
  // A postponement is a fact about the service, not a correction of a typo:
  // it gets recorded, so the tool can say "your release moved by 30 days"
  // instead of quietly showing a different number than it did yesterday.
  function postponeRelease(state, newISO) {
    if (!state.profile || !newISO) return false;
    const prev = state.profile.releaseDate;
    if (!prev || newISO === prev) return false;
    state.profile.releaseDate = newISO;
    state.profile.history = (state.profile.history || []).concat({ from: prev, to: newISO });
    return true;
  }

  function postponedDays(state) {
    const h = (state.profile && state.profile.history) || [];
    return h.reduce((sum, m) => sum + dates.daysBetween(m.from, m.to), 0);
  }
```

והוסף `postponeRelease, postponedDays` לשורת ה-`return` של `store`.

- [ ] **Step 4: הרץ ואמת שעוברות**

```bash
node service-countdown/test/dates.test.mjs
```
Expected: אין `FAIL`.

- [ ] **Step 5: הצג את העובדה בגיבור**

ב-`render.hero`, מיד אחרי הבלוק שמוסיף את ה-`moment` (אחרי הסוגר של
`if (state.profile) { const moment = ... }`), הוסף:

```js
    const moved = store.postponedDays(state);
    if (moved !== 0 && ev.id === 'release') {
      host.append(el('div', { class: 'hero-hint' },
        moved > 0 ? `השחרור נדחה ב-${dates.hebrewDays(moved)}`
                  : `השחרור הוקדם ב-${dates.hebrewDays(moved)}`));
    }
```

- [ ] **Step 6: הוסף את הפעולה להגדרות**

ב-`render.settings`, ב-`.row` הראשון (זה עם `#sProfile`), הוסף:

```html
        <button class="btn" id="sPostpone" type="button">דחיית שחרור</button>
```

ו-handler מיד אחרי `box.querySelector('#sProfile').onclick`:

```js
    box.querySelector('#sPostpone').onclick = () => {
      if (!state.profile) { err.textContent = 'צריך קודם תאריכי שירות'; return; }
      dismiss(() => postponeSheet(state, refresh));
    };
```

ומיד אחרי הפונקציה `settings`, הוסף את הגיליון עצמו:

```js
  function postponeSheet(state, refresh) {
    const box = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    box.innerHTML = `
      <h2>דחיית שחרור</h2>
      <p class="ev-d">התאריך הנוכחי נשמר בהיסטוריה, כדי שהכלי יוכל להגיד בכמה הוא זז.</p>
      <div>
        <label for="pDate">תאריך שחרור חדש</label>
        <input type="date" id="pDate">
        <div class="tpl" id="pQuick"></div>
      </div>
      <p class="err" id="pErr"></p>
      <div class="row">
        <button class="btn primary" id="pSave" type="button">שמור</button>
        <button class="btn ghost" id="pCancel" type="button">ביטול</button>
      </div>`;
    const dismiss = openSheet(box);
    const input = box.querySelector('#pDate');
    input.value = state.profile.releaseDate;
    const quick = box.querySelector('#pQuick');
    for (const n of [7, 14, 30, 60]) {
      const b = el('button', { type: 'button' }, `+${dates.hebrewDays(n)}`);
      b.onclick = () => {
        quick.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        input.value = dates.addDays(state.profile.releaseDate, n);
      };
      quick.append(b);
    }
    box.querySelector('#pCancel').onclick = () => dismiss();
    box.querySelector('#pSave').onclick = () => {
      const v = input.value;
      if (!v || dates.daysBetween(state.profile.enlistDate, v) <= 0) {
        box.querySelector('#pErr').textContent = 'התאריך חייב להיות אחרי הגיוס'; return;
      }
      if (!store.postponeRelease(state, v)) {
        box.querySelector('#pErr').textContent = 'זה כבר התאריך הנוכחי'; return;
      }
      store.save(state);
      dismiss();
      refresh();
    };
  }
```

והוסף `postponeSheet` לשורת ה-`return` של `render`.

- [ ] **Step 7: אמת ידנית + Commit**

בשרת המקומי: הגדרות → "דחיית שחרור" → `+30 ימים` → שמור. הגיבור אמור לרדת ב-30
ולהציג "השחרור נדחה ב-30 ימים".

```bash
node service-countdown/test/dates.test.mjs
node .claude/tools/verify-all.mjs --structural
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "feat(countdown): record a postponed release instead of hiding it"
```

---

## Task 11: אחרי השחרור יש פרק הבא

**למה:** המסך אחרי השחרור קופא על "משוחרר · 280 ימים מאז · 100%" לנצח. מי שהכלי
ליווה 32 חודשים ראוי לסגירת מעגל ולהצעה אחת — לא לחלון שנתקע.

**Files:**
- Modify: `service-countdown/index.html` — `render.hero`, `TEMPLATES`, CSS

**Interfaces:**
- Consumes: `render.eventSheet(state, refresh, existing?)`, `store.heroEvent`.

- [ ] **Step 1: הוסף תבניות מילואים**

ב-`TEMPLATES`, אחרי `{ title: 'הביתה', icon: 'home' }`, הוסף:

```js
  { title: 'מילואים',       icon: 'shield' },
  { title: 'סוף מילואים',   icon: 'flag' },
```

- [ ] **Step 2: הוסף סיכום ו-CTA למצב המשוחרר**

ב-`render.hero`, מיד אחרי הבלוק של `moved` (משימה 10), הוסף:

```js
    // The tool followed this person for the whole service; when it is over it
    // owes them a closing line and exactly one next step, not a frozen screen.
    if (state.profile && ev.id === 'release' && past) {
      const servedAll = dates.daysBetween(state.profile.enlistDate, state.profile.releaseDate);
      host.append(el('div', { class: 'moment' },
        `סיימת ${dates.hebrewDays(servedAll)} של שירות`));
      const next = el('button', { class: 'btn', type: 'button' }, 'התחל ספירה למילואים');
      next.onclick = () => eventSheet(state, refresh);
      const row = el('div', { class: 'row', style: 'justify-content:center' });
      row.append(next);
      host.append(row);
    }
```

- [ ] **Step 3: אמת ויזואלית**

זרע מצב משוחרר (גיוס `2023-03-02`, שחרור `2025-11-02`) ובדוק שהמסך מציג את
שורת הסיכום ואת הכפתור, ושהכפתור פותח את גיליון האירוע עם התבנית "מילואים" זמינה.

```bash
node .claude/tools/verify-all.mjs --structural
```

- [ ] **Step 4: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): close the loop after release, offer the next chapter"
```

---

## Task 12: הגדרות מסודרות + כניסה גלויה לספירה החיה

**למה:** ההגדרות הן קיר של תשע פקודות שוות-משקל, שבו הפעולה ההרסנית בולטת יותר
מ"סגור". ובמקביל, המסך היפה ביותר בכלי (הספירה החיה) נגיש רק דרך לחיצה ארוכה
של 550ms שמוסברת בשורה אחת.

**Files:**
- Modify: `service-countdown/index.html` — CSS, `render.settings`, `render.hero`

**תלות קשיחה:** המשימה מחליפה את **כל** ה-`innerHTML` של `render.settings`,
והמחרוזת החדשה כבר מכילה את `#sDaily` (משימה 5), `#sWall` (משימה 9) ו-`#sPostpone`
(משימה 10). **הרץ את המשימה הזאת אחרי שלושתן**, אחרת ה-handler-ים שלהן יקרסו
על `null`.

- [ ] **Step 1: CSS לקבוצות ולפעולה הרסנית**

הוסף מיד אחרי הכלל `.btn.ghost`:

```css
.btn.danger{color:#c0392b; border-color:color-mix(in srgb, #c0392b 35%, var(--line))}
:root[data-theme="dark"] .btn.danger{color:#ff8a75;
  border-color:color-mix(in srgb, #ff8a75 30%, var(--line))}
.sheet h3{font-size:.9rem; font-weight:800; color:var(--muted);
  letter-spacing:.02em; margin:.6rem 0 -.3rem}
.sheet hr{border:0; border-block-start:1px solid var(--line); margin:.4rem 0}
```

- [ ] **Step 2: סדר מחדש את ה-markup של ההגדרות**

ב-`render.settings`, החלף את כל `box.innerHTML = ...` ב:

```js
    box.innerHTML = `
      <h2>הגדרות</h2>

      <h3>הספירה</h3>
      <div class="row">
        <button class="btn" id="sProfile" type="button">ערוך תאריכי שירות</button>
        <button class="btn" id="sPostpone" type="button">דחיית שחרור</button>
      </div>
      <div>
        <label>צבע</label>
        <div class="row" id="sAccent"></div>
      </div>

      <hr>
      <h3>לראות את המספר בלי לפתוח</h3>
      <div class="row">
        <button class="btn" id="sIcs" type="button">הוסף ליומן עם תזכורת</button>
        <button class="btn" id="sDaily" type="button">יומן ספירה יומי</button>
      </div>
      <div class="row">
        <button class="btn" id="sWall" type="button">טפט למסך נעילה</button>
      </div>
      <div class="row" id="sBadgeRow" hidden>
        <button class="btn" id="sBadge" type="button">הצג ימים על אייקון האפליקציה</button>
      </div>
      <p class="ev-d">"הוסף ליומן" מוריד את כל האירועים עם תזכורת יום מראש.
        "יומן ספירה יומי" מוסיף שורה לכל אחד מ-100 הימים הבאים, שהכותרת שלה היא
        המספר עצמו. הטפט מצויר כאן במכשיר. הכול אופליין, בלי שרת ובלי חשבון.</p>

      <hr>
      <h3>שיתוף</h3>
      <div class="row">
        <button class="btn" id="sShare" type="button">שתף את הספירה</button>
        <button class="btn" id="sCard" type="button">שתף כתמונה</button>
      </div>

      <hr>
      <h3>נתונים</h3>
      <div class="row">
        <button class="btn" id="sExport" type="button">ייצא גיבוי</button>
        <button class="btn" id="sImport" type="button">ייבא גיבוי</button>
        <button class="btn" id="sLink" type="button">קישור העברה</button>
        <input type="file" id="sFile" accept="application/json" hidden>
      </div>
      <p class="ev-d">הגיבוי נשמר כקובץ במכשיר. אין ענן ואין חשבון — אם תחליף
        מכשיר, זו הדרך להעביר את הנתונים.</p>
      <p class="err" id="sErr"></p>

      <hr>
      <div class="row">
        <button class="btn primary" id="sClose" type="button">סגור</button>
        <button class="btn danger" id="sReset" type="button">אפס הכול</button>
      </div>`;
```

> כל ה-id-ים נשמרו בדיוק, אז אף handler קיים לא נשבר. השינוי היחיד באחריות:
> `#sClose` הפך ל-`primary` ו-`#sReset` ל-`danger`.

- [ ] **Step 3: כפתור גלוי לספירה החיה**

ב-`render.hero`, החלף את השורה שמוסיפה את `.hero-hint` (משימה 6) ב:

```js
    const hintRow = el('div', { class: 'row', style: 'justify-content:center' });
    const liveBtn = el('button', { class: 'btn ghost', type: 'button' }, 'ספירה חיה');
    liveBtn.onclick = () => live.open(ev.title, ev.date);
    hintRow.append(liveBtn);
    host.append(hintRow);
    host.append(el('div', { class: 'hero-hint' }, 'לחיצה על המספר מחליפה יחידה'));
```

הלחיצה הארוכה נשארת — היא קיצור, לא הדרך היחידה.

- [ ] **Step 4: אמת**

```bash
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/set.png dark 320
node .claude/tools/verify-all.mjs --structural
```
פתח את ההגדרות ובדוק: ארבע קבוצות עם כותרות, "סגור" מודגש, "אפס הכול" באדום.
כל כפתור עדיין עובד (בדוק לפחות: צבע, ייצוא, יומן, טפט, דחייה).

- [ ] **Step 5: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): group the settings, surface the live view"
```

---

## Task 13: קיצורי תאריך לאירוע + טקסט אשף מעודכן

**למה:** לאשף יש צ'יפים של גלי גיוס — צעד מצוין — אבל לאירוע רגיל אין "מחר /
בעוד שבוע", למרות שרוב האירועים בשירות נקבעים ביחס להיום. ובנוסף: **ביולי 2026
הכנסת אישרה שהשירות הסדיר יישאר 32 חודשים, ויחול על כל המתגייסים עד יולי 2029** —
ההסתייגות הנוכחית ("המקורות סותרים") הפכה מעורפלת מדי.

**Files:**
- Modify: `service-countdown/index.html` — `render.eventSheet`, `render.wizard`

- [ ] **Step 1: קיצורי תאריך בגיליון האירוע**

ב-`render.eventSheet`, ב-`box.innerHTML`, החלף את בלוק התאריך ב:

```html
      <div>
        <label for="aDate">תאריך</label>
        <input type="date" id="aDate">
        <div class="tpl" id="aDateQuick"></div>
      </div>
```

והוסף מיד אחרי `const every = box.querySelector('#aEvery');`:

```js
    // Most things in the service are set relative to today, not read off a
    // calendar -- the wizard already learned this with the enlistment waves.
    const dateInput = box.querySelector('#aDate');
    const dateQuick = box.querySelector('#aDateQuick');
    for (const q of [{ n: 1, label: 'מחר' }, { n: 7, label: 'בעוד שבוע' },
                     { n: 14, label: 'בעוד שבועיים' }, { n: 30, label: 'בעוד חודש' },
                     { n: 100, label: 'בעוד 100 ימים' }]) {
      const b = el('button', { type: 'button' }, q.label);
      b.onclick = () => {
        dateQuick.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        dateInput.value = dates.addDays(dates.todayISO(), q.n);
      };
      dateQuick.append(b);
    }
```

- [ ] **Step 2: החלף את פסקת ההסתייגות באשף**

ב-`render.wizard`, החלף את הפסקה שמתחילה `<p class="ev-d">ברירות המחדל` ב:

```html
      <p class="ev-d">ברירת המחדל לגברים היא 32 חודשים — ביולי 2026 הכנסת אישרה
        שהשירות הסדיר יישאר 32 חודשים לכל המתגייסים עד יולי 2029. לנשים ברירת
        המחדל היא 24. אלה ברירות מחדל בלבד: המקור המחייב הוא התאריך שעל הצו,
        ואפשר לדרוס כאן הכול.</p>
```

- [ ] **Step 3: אמת**

```bash
node .claude/tools/screenshot.mjs http://localhost:8777/service-countdown/ /tmp/ev.png dark 320
node .claude/tools/verify-all.mjs --structural
```
פתח "הוסף אירוע", לחץ "בעוד שבוע", ואמת שהתאריך בשדה הוא היום + 7.

- [ ] **Step 4: Commit**

```bash
git add service-countdown/index.html
git commit -m "feat(countdown): relative date chips, and a service length with a source"
```

---

## Task 14: קיצורי מניפסט, באמפ SW, ותיעוד

**למה:** `shortcuts` במניפסט נותן לחיצה-ארוכה על האייקון ב-Android ובדסקטופ
(iOS מתעלם, בלי נזק) — הרווח הכי זול שנשאר. והבאמפ ל-`sc-v4` הוא מה שמבטיח
שמשתמשים עם ה-PWA מותקן יקבלו את כל מה שנבנה כאן.

**Files:**
- Modify: `service-countdown/manifest.webmanifest`, `service-countdown/sw.js`,
  `README.md`, `.claude/PROJECT_LESSONS.md`

- [ ] **Step 1: הוסף `shortcuts` למניפסט**

ב-`service-countdown/manifest.webmanifest`, מיד אחרי מערך `"icons"`, הוסף פסיק
ואז:

```json
  "shortcuts": [
    {
      "name": "הוסף אירוע",
      "short_name": "אירוע",
      "url": "./index.html#add",
      "icons": [{ "src": "icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "הגדרות",
      "short_name": "הגדרות",
      "url": "./index.html#settings",
      "icons": [{ "src": "icon-192.png", "sizes": "192x192" }]
    }
  ]
```

- [ ] **Step 2: טפל ב-hash-ים החדשים**

ב-`index.html`, בבלוק הסקריפט האחרון, מיד אחרי `refresh();` ולפני
`if (!state.profile && state.events.length === 0)`, הוסף:

```js
// Manifest shortcuts land on a hash. Handled after the first render, so the
// sheet always opens on top of a drawn page (the wizard bug of v2).
if (location.hash === '#add') {
  history.replaceState(null, '', location.pathname);
  render.eventSheet(state, refresh);
} else if (location.hash === '#settings') {
  history.replaceState(null, '', location.pathname);
  render.settings(state, refresh);
}
```

- [ ] **Step 3: באמפ ה-service worker**

ב-`service-countdown/sw.js`, החלף `const CACHE = "sc-v3";` ב-`const CACHE = "sc-v4";`.

- [ ] **Step 4: שער איכות מלא (עם דפדפן)**

```bash
node service-countdown/test/dates.test.mjs
node service-countdown/test/ics.test.mjs
node .claude/tools/verify-all.mjs
```
Expected: כל הבדיקות עוברות; `verify-all` ירוק — כולל רינדור headless באור
ובחושך, `overflow=false` ו-`console_errors=[]`.

- [ ] **Step 5: עדכן את `README.md`**

בשורת `service-countdown` בטבלת הכלים, הוסף לתיאור: "רשת פז״מ, יומן ספירה יומי,
טפט מסך נעילה, דחיית שחרור".

- [ ] **Step 6: עדכן את `.claude/PROJECT_LESSONS.md`**

תחת "מלכודות ספציפיות לכלים", הוסף:

```markdown
- **`service-countdown` — שכבה קבועה אחת, לא שתיים.** `.topbar` ו-`.hero-mini`
  היו שתי שכבות `position:fixed` על אותה שורה (z-index 10 מול 9): הכותרת צוירה
  מתחת לכפתורים, וב-320px נשארו לה 96px לטקסט שדורש 129px. מאז v4 יש
  `.appbar` יחיד. **אל תוסיף שכבה קבועה שנייה בראש המסך.**
- **`service-countdown` — `ics.build` מקבל `baseDate`, לא את המופע המגולגל.**
  `store.allEvents` מגלגל אירוע חוזר למופע הבא; להעביר את זה לייצוא היה
  מייצא תזכורת אחת במקום סדרה. הייצוא כותב `RRULE:FREQ=DAILY;INTERVAL=n`
  ומוגבל ב-`UNTIL` לתאריך השחרור.
- **`service-countdown` — התראה יומית בלי שרת = `ics.countdownRows`.**
  `Notification Triggers` לא קיים ו-Web Push דורש שרת. הפתרון: אירוע יום-שלם
  לכל אחד מ-100 הימים הבאים שהכותרת שלו היא המספר.
- **`aria-modal="true"` בלי `inert` הוא הבטחה ריקה.** נמדד: Tab יצא מהגיליון
  ל-`#app` שמאחור בלחיצה ה-15. `render.openSheet` מדליק `#app.inert` **וגם**
  לוכד Tab בתוך הגיליון.
```

בסעיף "היסטוריית שינויים גדולים", הוסף בראש:

```markdown
- **09/08/2026 (v4):** ביקורת ממשק שנייה
  (`docs/superpowers/specs/2026-08-09-service-countdown-review-v3.md`) ותוכנית
  `2026-08-09-service-countdown-v4.md`: סרגל עליון אחד, קרובים-קודם עם היסטוריה
  מקופלת, שורת אירוע ב-grid, `RRULE` בייצוא, יומן ספירה יומי, מלכודת פוקוס
  ו-`inert`, "עוד N רגילות", רשת הפז"מ, טפט מסך נעילה, דחיית שחרור, מצב מילואים,
  הגדרות מקובצות, קיצורי מניפסט.
```

- [ ] **Step 7: Commit**

```bash
git add service-countdown/manifest.webmanifest service-countdown/sw.js \
        service-countdown/index.html README.md .claude/PROJECT_LESSONS.md
git commit -m "chore(countdown): manifest shortcuts, bump SW to sc-v4, update docs"
```

---

## מה נדחה במכוון מהתוכנית הזאת

**P3-13 מהביקורת — שעה, הערה וצבע לאירוע — לא נכנס.** זה נראה כמו שדה נוסף
בטופס, אבל בפועל הוא נוגע בשלושה מקומות בבת אחת: סכימת האחסון (`v:1` → `v:2`
ומסלול מיגרציה ל-`importJSON`/`decodeState`), פורמט ה-`.ics` (`DTSTART;VALUE=DATE`
הופך ל-`DTSTART;TZID=Asia/Jerusalem`, ואיתו כל חשבון ה-`DTEND` וה-`VALARM`),
וכל מקום שמשווה `e.date >= today` כמחרוזת. **זו תוכנית נפרדת**, וההערכה היא
שהיא שווה את זה רק אם משתמשים מבקשים — "רגילה ב-16:00" הוא המקרה היחיד שבו
השעה באמת משנה, והוא כבר מכוסה סבירות על ידי אירוע חוזר יומי.

**גם לא נכנס, מסיבות שכבר הוכרעו:** ווידג'ט מסך-בית (חסום ל-PWA), אייקון דינמי
(אין API), Web Push (דורש שרת), בורר צבע חופשי (הסט סגור בכוונה), וכל תוכן
שאינו ספירה — ויקי, מדריכים, סטיקרים, טבלאות מובילים.

---

## אימות סופי (אחרי כל המשימות)

```bash
node service-countdown/test/dates.test.mjs     # צפוי: 70 passed (61 + 3 + 3 + 3)
node service-countdown/test/ics.test.mjs       # צפוי: 14 passed (7 + 4 + 3)
node .claude/tools/verify-all.mjs              # צפוי: ירוק, כולל headless
```

ובנוסף, מול השרת המקומי, סבב ידני של שמונה מסכים ב-320 וב-390, באור ובחושך:
גיבור · גלילה (סרגל אחד, בלי חפיפה) · רשת הפז"מ · סטטיסטיקות · אירועים
(קרובים ראשונים + היסטוריה מקופלת) · הגדרות (ארבע קבוצות) · גיליון אירוע
(קיצורי תאריך) · מצב משוחרר.
