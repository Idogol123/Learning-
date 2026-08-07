# "הספירה" (`service-countdown`) — תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** כלי דפדפן אופליין באוסף `Learning-` הסופר לאחור לאירועי שירות צבאי — שחרור, סוף קורס מפקדים, כומתה — עם גיבור מלא-מסך וציר זמן שנחשף בגלילה.

**Architecture:** קובץ `index.html` עצמאי אחד המכיל ארבעה מודולים מופרדים: `dates` (חשבון תאריכים טהור), `store` (`localStorage`), `render` (בניית DOM), `motion` (גלילה וגלגול ספרות). `dates` מבודד לחלוטין כדי שניתן יהיה לבדוק אותו ב-Node ללא דפדפן, בדפוס הקיים ב-`guard-duty-scheduler/test/`.

**Tech Stack:** HTML/CSS/JS ללא תלויות, ללא שלב בנייה. `localStorage` לאחסון. Node ≥18 לבדיקות (`node:vm`, `node:assert`). Playwright/Chromium (מותקן גלובלית) לאימות headless ולייצור אייקונים.

**אפיון מקור:** `docs/superpowers/specs/2026-08-07-service-countdown-design.md` — יש לקרוא אותו לפני התחלה.

## Global Constraints

- **אפס בקשות רשת.** אין CDN, אין Google Fonts, אין תמונות מרוחקות, אין API, אין SDK של צד שלישי, אין טלמטריה. הכלי חייב לרנדר במלואו במצב טיסה.
- **גופנים:** מחסנית מערכת בלבד — `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", Arial, sans-serif`.
- **אייקונים:** Lucide כ-SVG inline בלבד. **לא אימוג'י, לא SVG מצויר ביד.**
- **עברית RTL, mobile-first.** `<html lang="he" dir="rtl">`.
- **אקסנט הכלי:** בהיר `#8a5a12` · כהה `#e0a33c`.
- **נייטרלים בהיר:** `--bg:#f2f1ea; --card:#fbfaf5; --ink:#1c1e16; --muted:#6b7061; --line:#e0ded2; --line-strong:#d0cebf`
- **נייטרלים כהה:** `--bg:#13140f; --card:#1c1e15; --ink:#edefe1; --muted:#9aa08c; --line:#2c2f23; --line-strong:#3a3d2e`
- **טוקנים משותפים:** `--ease: cubic-bezier(.16,1,.3,1)`; רדיוס `16px`; `-webkit-font-smoothing: antialiased`; צל שכבתי בגוון (לא שחור טהור).
- **כותרות:** `font-weight:800; letter-spacing:-.02em`.
- **ברירת מחדל כהה** — הכלי היחיד באוסף שנפתח כהה ללא תלות בהעדפת המערכת. מצב בהיר נתמך במלואו.
- **מפתח אחסון:** `service-countdown.v1` (מפתח יחיד, אובייקט יחיד).
- **תאריכים:** `YYYY-MM-DD` בלבד. **לעולם לא** `new Date("YYYY-MM-DD")` — הוא מפרש כ-UTC ומזיז יום באזורי זמן שליליים.
- **`prefers-reduced-motion` מכובד** בכל אנימציה.
- **אל תיגע ב-`.github/workflows/deploy-pages.yml`** — הוא מגלה כלים אוטומטית.
- **שער איכות לפני כל push:** `node .claude/tools/verify-all.mjs`.

---

## מבנה קבצים

| קובץ | אחריות |
|---|---|
| `service-countdown/index.html` | הכלי כולו — CSS, markup, ארבעת המודולים |
| `service-countdown/test/dates.test.mjs` | בדיקות יחידה למודול `dates`, מחלצות את המקור האמיתי מ-`index.html` |
| `service-countdown/manifest.webmanifest` | מניפסט PWA |
| `service-countdown/sw.js` | service worker, `CACHE = "sc-v1"` |
| `service-countdown/icon-192.png` · `icon-512.png` · `icon-maskable-512.png` · `apple-touch-icon.png` | אייקוני PWA |
| `landing/index.html` | **שינוי:** כרטיס מקשר חדש |
| `landing/sw.js` | **שינוי:** באמפ גרסת מטמון |
| `README.md` | **שינוי:** שורה לכלי החדש |
| `.claude/PROJECT_LESSONS.md` | **שינוי:** אקסנט חדש + לקחים |

---

## Task 1: מודול `dates` + בדיקות יחידה

הליבה החישובית. כל השאר נשען עליה, ולכן היא נבנית ראשונה ובבדיקה-לפני-קוד.

**Files:**
- Create: `service-countdown/index.html`
- Create: `service-countdown/test/dates.test.mjs`

**Interfaces:**
- Consumes: כלום.
- Produces: אובייקט גלובלי `dates` עם:
  - `parse(iso: string) -> Date` — חצות מקומי
  - `toISO(d: Date) -> string`
  - `todayISO() -> string`
  - `daysBetween(fromISO: string, toISO: string) -> number`
  - `addMonths(iso: string, n: number) -> string`
  - `progressPct(startISO: string, endISO: string, nowISO: string) -> number` (0–100)
  - `hebrewDays(n: number) -> string`
  - `remainingLabel(n: number) -> string`
  - `formatHe(iso: string) -> string` — "14 בנובמבר 2027"

- [ ] **Step 1: צור את שלד `index.html` עם מודול `dates` ריק**

צור `service-countdown/index.html`:

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>הספירה — ספירה לאחור לשירות</title>
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<meta name="theme-color" content="#13140f">
</head>
<body>
<script>
/* ---------- dates: pure date arithmetic, no DOM, no storage ---------- */
const dates = (() => {
  const MS_DAY = 86400000;
  return {};
})();
</script>
</body>
</html>
```

- [ ] **Step 2: כתוב את קובץ הבדיקה הנכשל**

צור `service-countdown/test/dates.test.mjs`:

```js
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
```

- [ ] **Step 3: הרץ את הבדיקה וודא שהיא נכשלת**

```bash
TZ=Asia/Jerusalem node service-countdown/test/dates.test.mjs
```

צפוי: כישלון עם `could not find the \`dates\` module` או `dates.parse is not a function` — המודול עדיין ריק.

- [ ] **Step 4: ממש את מודול `dates`**

החלף את בלוק ה-`<script>` ב-`index.html`:

```html
<script>
/* ---------- dates: pure date arithmetic, no DOM, no storage ---------- */
const dates = (() => {
  const MS_DAY = 86400000;
  const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                     'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  // "YYYY-MM-DD" -> Date at LOCAL midnight.
  // Never use new Date(iso): that parses as UTC and shifts the calendar day
  // in any negative-offset timezone.
  function parse(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function toISO(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function todayISO() { return toISO(new Date()); }

  // Whole calendar days between two local dates.
  // Rounds rather than floors: a DST boundary makes a calendar day 23 or 25
  // hours long, and flooring the raw millisecond difference is off by one
  // across those days -- directly wrong in the headline number.
  function daysBetween(fromISO, toISOStr) {
    return Math.round((parse(toISOStr) - parse(fromISO)) / MS_DAY);
  }

  // Add n months, clamping onto the last day of the target month.
  // Naive JS overflows: 31 March + 1 month lands on 1 May.
  function addMonths(iso, n) {
    const d = parse(iso);
    const day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return toISO(t);
  }

  // 0..100, clamped. An empty or inverted range reads as finished.
  function progressPct(startISO, endISO, nowISO) {
    const total = daysBetween(startISO, endISO);
    if (total <= 0) return 100;
    const done = daysBetween(startISO, nowISO);
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }

  function hebrewDays(n) {
    const a = Math.abs(n);
    if (a === 0) return 'היום';
    if (a === 1) return 'יום אחד';
    if (a === 2) return 'יומיים';
    return `${a} ימים`;
  }

  function remainingLabel(n) {
    if (n === 0) return 'היום!';
    if (n < 0) return `עברו ${hebrewDays(n)}`;
    return `${n === 1 ? 'נשאר' : 'נשארו'} ${hebrewDays(n)}`;
  }

  function formatHe(iso) {
    const d = parse(iso);
    return `${d.getDate()} ב${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
  }

  return { parse, toISO, todayISO, daysBetween, addMonths,
           progressPct, hebrewDays, remainingLabel, formatHe };
})();
</script>
```

- [ ] **Step 5: הרץ את הבדיקות וודא שהן עוברות**

```bash
TZ=Asia/Jerusalem node service-countdown/test/dates.test.mjs
```

צפוי: `16 passed`, קוד יציאה 0.

- [ ] **Step 6: ודא שהבדיקות עוברות גם ב-UTC (ברירת המחדל של CI)**

```bash
node service-countdown/test/dates.test.mjs
```

צפוי: `16 passed` — הקובץ קובע `process.env.TZ` בעצמו, כך שהוא לא תלוי בסביבה.

- [ ] **Step 7: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "Add date arithmetic for the service countdown

Rounds day differences instead of flooring them so a DST boundary
cannot shift the headline number, and clamps month addition onto
short months so a 31st does not overflow into the next month."
```

---

## Task 2: מודול `store`

**Files:**
- Modify: `service-countdown/index.html` (הוסף בלוק `<script>` אחרי `dates`)

**Interfaces:**
- Consumes: `dates.todayISO`, `dates.daysBetween`.
- Produces: אובייקט גלובלי `store` עם:
  - `KEY = 'service-countdown.v1'`
  - `load() -> State`
  - `save(state: State) -> boolean` — `false` אם האחסון חסום
  - `blank() -> State`
  - `allEvents(state) -> Array<{id,title,date,icon,source,virtual}>` — כולל השחרור הווירטואלי, ממוין מהקרוב לרחוק
  - `heroEvent(state) -> object|null` — עם נפילה חזרה
  - `exportJSON(state) -> string`
  - `importJSON(text: string) -> State` — זורק `Error` בקלט פגום

**State shape** (זהה לאפיון §3):

```js
{ v: 1, profile: null | { enlistDate, releaseDate, gender },
  events: [ { id, title, date, icon, source } ],
  heroId: 'release' | '<event id>',
  theme: 'dark' | 'light' }
```

- [ ] **Step 1: הוסף בדיקות `store` לקובץ הבדיקה**

הוסף ל-`service-countdown/test/dates.test.mjs`, לפני שורת ה-`console.log` האחרונה. שים לב שהחילוץ צריך גם את `store`, לכן החלף תחילה את בלוק החילוץ:

```js
// --- replace the single-module extraction with a two-module one ---
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
```

ואז הוסף את הבדיקות:

```js
// ---- store ----
t('blank state is valid and empty', () => {
  const s = store.blank();
  assert.equal(s.v, 1);
  assert.equal(s.profile, null);
  assert.deepEqual(s.events, []);
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
  assert.deepEqual(store.allEvents(s), []);
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
  assert.equal(store.heroEvent(s).id, 'a');

  const empty = store.blank();
  empty.heroId = 'ghost';
  assert.equal(store.heroEvent(empty), null);
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
```

- [ ] **Step 2: הרץ וודא כישלון**

```bash
node service-countdown/test/dates.test.mjs
```

צפוי: `could not find the \`store\` module in index.html`.

- [ ] **Step 3: ממש את `store`**

הוסף בלוק `<script>` חדש ב-`index.html`, מיד אחרי המודול `dates`:

```html
<script>
/* ---------- store: localStorage persistence, no DOM ---------- */
const store = (() => {
  const KEY = 'service-countdown.v1';

  function blank() {
    return { v: 1, profile: null, events: [], heroId: 'release', theme: 'dark' };
  }

  // Never throws. A corrupt or foreign payload is treated as "no data yet"
  // rather than breaking the page on open.
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || s.v !== 1) return blank();
      return Object.assign(blank(), s);
    } catch (e) {
      return blank();
    }
  }

  // Returns false when storage is unavailable (private mode, quota full) so
  // the caller can warn that nothing will persist.
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  // Release is NOT a row in `events`: it is derived from the profile so that
  // one date drives the headline, the timeline and the percentage alike.
  function releaseEvent(state) {
    if (!state.profile || !state.profile.releaseDate) return null;
    return { id: 'release', title: 'שחרור', date: state.profile.releaseDate,
             icon: 'party-popper', source: 'profile', virtual: true };
  }

  function allEvents(state) {
    const list = state.events.map(e => Object.assign({ virtual: false }, e));
    const rel = releaseEvent(state);
    if (rel) list.push(rel);
    return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // Falls back to the nearest event, then to nothing, so a deleted event or a
  // "release" id without a profile can never blank the screen.
  function heroEvent(state) {
    const list = allEvents(state);
    if (list.length === 0) return null;
    return list.find(e => e.id === state.heroId) || list[0];
  }

  function exportJSON(state) { return JSON.stringify(state, null, 2); }

  function importJSON(text) {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('קובץ לא תקין');
    if (s.v !== 1) throw new Error('גרסת קובץ לא נתמכת');
    return Object.assign(blank(), s);
  }

  return { KEY, blank, load, save, allEvents, heroEvent, exportJSON, importJSON };
})();
</script>
```

- [ ] **Step 4: הרץ וודא מעבר**

```bash
node service-countdown/test/dates.test.mjs
```

צפוי: `25 passed`.

- [ ] **Step 5: Commit**

```bash
git add service-countdown/index.html service-countdown/test/dates.test.mjs
git commit -m "Add persistence layer for the service countdown

Derives the release countdown from the profile rather than storing it as
an event row, so one date drives the headline, timeline and percentage.
Corrupt payloads and blocked storage degrade to an empty state instead
of breaking the page on open."
```

---

## Task 3: מערכת העיצוב ומסך הגיבור

**Files:**
- Modify: `service-countdown/index.html`

**Interfaces:**
- Consumes: `dates.*`, `store.load`, `store.heroEvent`.
- Produces: `render.hero(state)`, `icon(name) -> string` (SVG inline), `el(tag, attrs, children) -> Element`.

- [ ] **Step 1: הוסף את בלוק ה-CSS ל-`<head>`**

```html
<style>
:root{
  --bg:#f2f1ea; --card:#fbfaf5; --ink:#1c1e16; --muted:#6b7061;
  --line:#e0ded2; --line-strong:#d0cebf; --accent:#8a5a12;
  --ease:cubic-bezier(.16,1,.3,1); --r:16px;
  --shadow:0 1px 2px rgba(28,30,22,.05), 0 8px 24px rgba(28,30,22,.06);
}
:root[data-theme="dark"]{
  --bg:#13140f; --card:#1c1e15; --ink:#edefe1; --muted:#9aa08c;
  --line:#2c2f23; --line-strong:#3a3d2e; --accent:#e0a33c;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:var(--bg); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Hebrew",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
h1,h2,h3{font-weight:800;letter-spacing:-.02em;margin:0}

/* ---- hero: one full viewport, one number ---- */
.hero{
  min-height:100dvh;               /* dvh, not vh: mobile browser chrome */
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:.5rem; padding:1.5rem; text-align:center;
}
.hero-label{color:var(--muted); font-size:1rem; letter-spacing:.02em}
.hero-num{
  font-size:clamp(5rem, 20vw, 11rem); font-weight:800; line-height:.9;
  letter-spacing:-.05em; color:var(--accent);
  font-variant-numeric:tabular-nums;
}
.hero-unit{font-size:1.25rem; font-weight:800; color:var(--ink)}
.hero-meta{color:var(--muted); font-size:.95rem; margin-top:.75rem}
.hero-ring{width:min(72vw,320px); height:4px; border-radius:999px;
  background:var(--line); margin-top:1rem; position:relative; overflow:hidden}
.hero-ring>i{position:absolute; inset-block:0; inset-inline-start:0;
  background:var(--accent); border-radius:999px; display:block}
.scroll-hint{margin-top:2rem; color:var(--muted); opacity:.7}
.scroll-hint svg{width:24px;height:24px}

/* ---- shared ---- */
.ico{display:inline-flex; width:20px; height:20px}
.ico svg{width:100%;height:100%}
.chip-ico{
  display:inline-flex; align-items:center; justify-content:center;
  width:38px; height:38px; border-radius:12px; color:var(--accent);
  background:color-mix(in srgb, var(--accent) 12%, var(--card));
  border:1px solid color-mix(in srgb, var(--accent) 24%, transparent);
}
@media (prefers-reduced-motion: reduce){
  *{animation-duration:.01ms !important; transition-duration:.01ms !important}
}
</style>
```

- [ ] **Step 2: הוסף את ה-markup של הגיבור ל-`<body>`**

מיד אחרי פתיחת `<body>`:

```html
<main id="app">
  <section class="hero" id="hero"></section>
</main>
```

- [ ] **Step 3: הוסף את מודול `render` עם `hero`**

בלוק `<script>` חדש אחרי `store`:

```html
<script>
/* ---------- render: state -> DOM ---------- */
const ICONS = {
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'party-popper': '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 11"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H16"/><path d="M11 2 9.9 2.44a2.03 2.03 0 0 0-1.12 2.5l.33.83c.28.7 0 1.5-.65 1.85L7 8.5"/>',
  'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  'home': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
};

function icon(name) {
  const body = ICONS[name] || ICONS.flag;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function el(tag, attrs = {}, html = '') {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else n.setAttribute(k, v);
  }
  if (html) n.innerHTML = html;
  return n;
}

const render = (() => {
  function hero(state) {
    const host = document.getElementById('hero');
    host.innerHTML = '';
    const ev = store.heroEvent(state);

    if (!ev) {
      host.append(
        el('div', { class: 'chip-ico' }, icon('plus')),
        el('h1', { class: 'hero-unit' }, 'עוד אין ספירה'),
        el('p', { class: 'hero-meta' }, 'הוסיפו תאריך שחרור או אירוע כדי להתחיל')
      );
      return;
    }

    const today = dates.todayISO();
    const left = dates.daysBetween(today, ev.date);
    const past = left < 0;

    host.append(el('div', { class: 'hero-label' }, past ? 'משוחרר' : ev.title));
    host.append(el('div', { class: 'hero-num', id: 'heroNum' }, String(Math.abs(left))));
    host.append(el('div', { class: 'hero-unit' },
      past ? `ימים מאז ${ev.title}` : (left === 0 ? 'היום!' : 'ימים')));

    if (state.profile) {
      const pct = dates.progressPct(state.profile.enlistDate, state.profile.releaseDate, today);
      const ring = el('div', { class: 'hero-ring' });
      const fill = el('i');
      fill.style.width = pct + '%';
      ring.append(fill);
      host.append(ring);
      host.append(el('div', { class: 'hero-meta' },
        `${dates.formatHe(ev.date)} · ${pct}% פז"מ`));
    } else {
      host.append(el('div', { class: 'hero-meta' }, dates.formatHe(ev.date)));
    }

    host.append(el('div', { class: 'scroll-hint' }, icon('chevron-down')));
  }

  return { hero };
})();
</script>
```

- [ ] **Step 4: הוסף את האתחול**

בלוק `<script>` אחרון לפני `</body>`:

```html
<script>
let state = store.load();
document.documentElement.setAttribute('data-theme', state.theme);
render.hero(state);
</script>
```

- [ ] **Step 5: אמת ויזואלית באור ובחושך**

```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc-dark.png dark 412
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc-light.png light 412
```

צפוי בשתי הריצות: `overflow=false console_errors=[]`. הצג את שתי התמונות למשתמש לאישור כיוון **לפני שממשיכים** — זהו עמוד העוגן, לפי `PROJECT_LESSONS`.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "Add design tokens and the full-viewport hero screen

Opens on one number and nothing else. Sized in dvh rather than vh so
mobile browser chrome cannot clip it, and falls back to a dedicated
empty state when there is no countdown yet."
```

---

## Task 4: אשף הפתיחה

**Files:**
- Modify: `service-countdown/index.html`

**Interfaces:**
- Consumes: `dates.addMonths`, `dates.daysBetween`, `store.save`, `render.hero`.
- Produces: `render.wizard(state, onDone)`; שדה `state.profile` מאוכלס.

- [ ] **Step 1: הוסף CSS לאשף**

```css
.wizard{position:fixed; inset:0; z-index:20; background:var(--bg);
  display:flex; flex-direction:column; justify-content:center;
  padding:1.5rem; gap:1rem}
.wizard h2{font-size:1.5rem}
.wizard label{display:block; color:var(--muted); font-size:.9rem; margin-bottom:.35rem}
.wizard input[type=date]{
  width:100%; padding:.85rem; border-radius:var(--r); font-size:1rem;
  background:var(--card); color:var(--ink); border:1px solid var(--line-strong);
  font-family:inherit;
}
.row{display:flex; gap:.5rem; align-items:center; flex-wrap:wrap}
.btn{padding:.8rem 1.1rem; border-radius:var(--r); border:1px solid var(--line-strong);
  background:var(--card); color:var(--ink); font:inherit; font-weight:700; cursor:pointer}
.btn.primary{background:var(--accent); border-color:var(--accent); color:var(--bg)}
.btn.ghost{background:transparent; border-color:transparent; color:var(--muted)}
.err{color:#c0392b; font-size:.9rem; min-height:1.2em}
:root[data-theme="dark"] .err{color:#ff8a75}
```

- [ ] **Step 2: הוסף את `render.wizard`**

בתוך ה-IIFE של `render`, לפני ה-`return`:

```js
function wizard(state, onDone) {
  const box = el('div', { class: 'wizard', id: 'wizard' });
  box.innerHTML = `
    <h2>נתחיל</h2>
    <div>
      <label for="wEnlist">תאריך גיוס</label>
      <input type="date" id="wEnlist">
    </div>
    <div>
      <label for="wRelease">תאריך שחרור</label>
      <input type="date" id="wRelease">
    </div>
    <div class="row">
      <button class="btn" id="wCalcM" type="button">חשב לי — חייל (32 ח׳)</button>
      <button class="btn" id="wCalcF" type="button">חיילת (24 ח׳)</button>
    </div>
    <p class="err" id="wErr"></p>
    <div class="row">
      <button class="btn primary" id="wSave" type="button">שמור</button>
      <button class="btn ghost" id="wSkip" type="button">דלג</button>
    </div>`;
  document.body.append(box);

  const enlist = box.querySelector('#wEnlist');
  const release = box.querySelector('#wRelease');
  const err = box.querySelector('#wErr');
  let gender = null;

  function suggest(months, g) {
    if (!enlist.value) { err.textContent = 'צריך קודם תאריך גיוס'; return; }
    err.textContent = '';
    gender = g;
    release.value = dates.addMonths(enlist.value, months);
  }
  box.querySelector('#wCalcM').onclick = () => suggest(32, 'm');
  box.querySelector('#wCalcF').onclick = () => suggest(24, 'f');

  box.querySelector('#wSave').onclick = () => {
    if (!enlist.value || !release.value) { err.textContent = 'צריך שני תאריכים'; return; }
    if (dates.daysBetween(enlist.value, release.value) <= 0) {
      err.textContent = 'תאריך השחרור חייב להיות אחרי הגיוס'; return;
    }
    state.profile = { enlistDate: enlist.value, releaseDate: release.value, gender };
    state.heroId = 'release';
    if (!store.save(state)) err.textContent = 'שים לב: הנתונים לא יישמרו במכשיר הזה';
    box.remove();
    onDone();
  };

  box.querySelector('#wSkip').onclick = () => { box.remove(); onDone(); };
}
```

עדכן את ה-`return` של `render` ל-`return { hero, wizard };`.

- [ ] **Step 3: חבר את האשף לאתחול**

החלף את בלוק האתחול:

```js
let state = store.load();
document.documentElement.setAttribute('data-theme', state.theme);

function refresh() { render.hero(state); }

if (!state.profile && state.events.length === 0) {
  render.wizard(state, refresh);
} else {
  refresh();
}
```

- [ ] **Step 4: אמת headless**

```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc-wizard.png dark 412
```

צפוי: `overflow=false console_errors=[]`, והתמונה מציגה את האשף (אין נתונים שמורים ב-`file://`).

- [ ] **Step 5: בדוק ידנית את מסלול "חשב לי"**

הרץ שרת מקומי (`localStorage` לא אמין ב-`file://`):

```bash
python3 -m http.server 8123 --directory service-countdown &
```

פתח `http://localhost:8123/`, הזן גיוס `2025-03-15`, לחץ "חשב לי — חייל" וּודא שהשחרור מתמלא `2027-11-15`. שמור, ורענן — הגיבור צריך להישאר. עצור את השרת בסיום.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "Add the onboarding wizard

Suggests a release date from the enlistment date and the statutory term
but never overwrites what the user typed, since the real date often
differs. Rejects a release date that precedes enlistment, and warns
when storage is unavailable instead of silently losing the profile."
```

---

## Task 5: ציר הזמן, רצועת האירועים והוספת אירוע

**Files:**
- Modify: `service-countdown/index.html`

**Interfaces:**
- Consumes: `store.allEvents`, `dates.progressPct`, `dates.daysBetween`, `dates.remainingLabel`.
- Produces: `render.timeline(state)`, `render.events(state, refresh)`, `render.addSheet(state, refresh)`, `TEMPLATES` (מערך `{title, icon}`).

- [ ] **Step 1: הוסף markup ו-CSS**

הוסף ל-`<main>` אחרי `.hero`:

```html
<section class="panel" id="timeline"></section>
<section class="panel" id="events"></section>
```

CSS:

```css
.panel{padding:1.25rem; max-width:640px; margin-inline:auto}
.panel h2{font-size:1.15rem; margin-bottom:.9rem}
.tl{position:relative; padding-inline-start:1.25rem; border-inline-start:2px solid var(--line)}
.tl-fill{position:absolute; inset-block-start:0; inset-inline-start:-2px; width:2px;
  background:var(--accent); border-radius:2px}
.tl-node{position:relative; padding-block:.55rem; color:var(--muted); font-size:.9rem}
.tl-node::before{content:""; position:absolute; inset-inline-start:-1.6rem; top:.9rem;
  width:9px; height:9px; border-radius:50%; background:var(--line-strong)}
.tl-node.done::before{background:var(--accent)}
.tl-node.now{color:var(--ink); font-weight:800}
.tl-node.now::before{background:var(--accent); box-shadow:0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent)}
.ev{display:flex; align-items:center; gap:.75rem; width:100%; text-align:start;
  padding:.85rem; margin-bottom:.6rem; border-radius:var(--r);
  background:var(--card); border:1px solid var(--line); box-shadow:var(--shadow);
  color:inherit; font:inherit; cursor:pointer;
  transition:transform .18s var(--ease), border-color .18s var(--ease)}
.ev:hover{transform:translateY(-1px); border-color:var(--line-strong)}
.ev.soon{border-color:color-mix(in srgb, var(--accent) 45%, var(--line))}
.ev-t{font-weight:800}
.ev-d{color:var(--muted); font-size:.85rem}
.ev-grow{flex:1; min-width:0}
.ev-days{font-weight:800; color:var(--accent); font-variant-numeric:tabular-nums}
.sheet{position:fixed; inset:0; z-index:30; background:var(--bg); overflow-y:auto;
  padding:1.25rem; display:flex; flex-direction:column; gap:.9rem}
.tpl{display:flex; flex-wrap:wrap; gap:.45rem}
.tpl button{padding:.5rem .75rem; border-radius:999px; border:1px solid var(--line-strong);
  background:var(--card); color:var(--ink); font:inherit; font-size:.9rem; cursor:pointer}
.tpl button.on{background:var(--accent); border-color:var(--accent); color:var(--bg)}
.sheet input[type=text],.sheet input[type=date]{
  width:100%; padding:.85rem; border-radius:var(--r); font-size:1rem; font-family:inherit;
  background:var(--card); color:var(--ink); border:1px solid var(--line-strong)}
```

- [ ] **Step 2: הוסף את התבניות ואת שלוש פונקציות הרינדור**

בתוך ה-IIFE של `render`:

```js
const TEMPLATES = [
  { title: 'סוף טירונות',      icon: 'shield' },
  { title: 'מסע כומתה',        icon: 'star' },
  { title: 'סוף אימון מתקדם',  icon: 'shield' },
  { title: 'סוף מסלול',        icon: 'flag' },
  { title: 'קורס מפקדים',      icon: 'graduation-cap' },
  { title: 'קורס קצינים',      icon: 'graduation-cap' },
  { title: 'דרגה חדשה',        icon: 'star' },
  { title: 'רגילה הבאה',       icon: 'home' },
  { title: 'הביתה',            icon: 'home' },
];

// Milestones derived from the profile. Not editable: they are a view of the
// service, not user data.
function milestones(p) {
  const total = dates.daysBetween(p.enlistDate, p.releaseDate);
  const at = frac => dates.toISO(
    new Date(dates.parse(p.enlistDate).getTime() + Math.round(total * frac) * 86400000));
  const out = [
    { title: 'גיוס',        date: p.enlistDate },
    { title: 'רבע פז״מ',    date: at(.25) },
    { title: 'חצי פז״מ',    date: at(.5) },
    { title: 'שלושת רבעי',  date: at(.75) },
    { title: 'שחרור',       date: p.releaseDate },
  ];
  if (total > 365)  out.splice(1, 0, { title: 'שנה בצבא',   date: dates.addMonths(p.enlistDate, 12) });
  if (total > 730)  out.splice(2, 0, { title: 'שנתיים',     date: dates.addMonths(p.enlistDate, 24) });
  if (total > 100)  out.push({ title: '100 ימים אחרונים',
    date: dates.toISO(new Date(dates.parse(p.releaseDate).getTime() - 100 * 86400000)) });
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function timeline(state) {
  const host = document.getElementById('timeline');
  host.innerHTML = '';
  if (!state.profile) return;                 // no profile -> no timeline

  const today = dates.todayISO();
  const p = state.profile;
  const pct = dates.progressPct(p.enlistDate, p.releaseDate, today);

  host.append(el('h2', {}, 'ציר השירות'));
  const tl = el('div', { class: 'tl' });
  const fill = el('div', { class: 'tl-fill' });
  fill.style.height = pct + '%';
  tl.append(fill);

  const nodes = milestones(p);
  let placedNow = false;
  for (const n of nodes) {
    if (!placedNow && n.date > today) {
      tl.append(el('div', { class: 'tl-node now' }, `אתה כאן · ${pct}%`));
      placedNow = true;
    }
    const done = n.date <= today;
    tl.append(el('div', { class: 'tl-node' + (done ? ' done' : '') },
      `${n.title} · ${dates.formatHe(n.date)}`));
  }
  if (!placedNow) tl.append(el('div', { class: 'tl-node now' }, `אתה כאן · ${pct}%`));

  host.append(tl);
}

function events(state, refresh) {
  const host = document.getElementById('events');
  host.innerHTML = '';
  const today = dates.todayISO();
  const list = store.allEvents(state);

  const head = el('div', { class: 'row' });
  head.append(el('h2', { class: 'ev-grow' }, 'אירועים'));
  const add = el('button', { class: 'btn', type: 'button' }, 'הוסף אירוע');
  add.onclick = () => addSheet(state, refresh);
  head.append(add);
  host.append(head);

  if (list.length === 0) {
    host.append(el('p', { class: 'ev-d' }, 'אין עדיין אירועים. הוסיפו אחד כדי להתחיל לספור.'));
    return;
  }

  for (const ev of list) {
    const left = dates.daysBetween(today, ev.date);
    const soon = left >= 0 && left <= 7;
    const row = el('button', { class: 'ev' + (soon ? ' soon' : ''), type: 'button' });
    row.append(el('span', { class: 'chip-ico' }, icon(ev.icon)));
    const mid = el('span', { class: 'ev-grow' });
    mid.append(el('span', { class: 'ev-t' }, ev.title));
    mid.append(el('span', { class: 'ev-d' }, ` ${dates.formatHe(ev.date)}`));
    row.append(mid);
    row.append(el('span', { class: 'ev-days' }, dates.remainingLabel(left)));
    row.onclick = () => { state.heroId = ev.id; store.save(state); refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' }); };
    host.append(row);
  }
}

function addSheet(state, refresh) {
  const box = el('div', { class: 'sheet' });
  box.innerHTML = `
    <h2>אירוע חדש</h2>
    <div class="tpl" id="tpl"></div>
    <div>
      <label for="aTitle">שם</label>
      <input type="text" id="aTitle" placeholder="למשל: סוף קורס מפקדים">
    </div>
    <div>
      <label for="aDate">תאריך</label>
      <input type="date" id="aDate">
    </div>
    <p class="err" id="aErr"></p>
    <div class="row">
      <button class="btn primary" id="aSave" type="button">הוסף</button>
      <button class="btn ghost" id="aCancel" type="button">ביטול</button>
    </div>`;
  document.body.append(box);

  let picked = null;
  const tpl = box.querySelector('#tpl');
  for (const t of TEMPLATES) {
    const b = el('button', { type: 'button' }, t.title);
    b.onclick = () => {
      tpl.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      picked = t;
      box.querySelector('#aTitle').value = t.title;
    };
    tpl.append(b);
  }

  box.querySelector('#aCancel').onclick = () => box.remove();
  box.querySelector('#aSave').onclick = () => {
    const title = box.querySelector('#aTitle').value.trim();
    const date = box.querySelector('#aDate').value;
    if (!title || !date) { box.querySelector('#aErr').textContent = 'צריך שם ותאריך'; return; }
    state.events.push({
      id: 'e' + Date.now().toString(36),
      title, date, icon: picked ? picked.icon : 'flag', source: picked ? 'template' : 'custom',
    });
    store.save(state);
    box.remove();
    refresh();
  };
}
```

עדכן את ה-`return` ל-`return { hero, wizard, timeline, events, addSheet };`.

- [ ] **Step 3: עדכן את `refresh`**

```js
function refresh() {
  render.hero(state);
  render.timeline(state);
  render.events(state, refresh);
}
```

- [ ] **Step 4: אמת headless באור ובחושך**

```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc5-dark.png dark 412
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc5-light.png light 412
```

צפוי בשתיהן: `overflow=false console_errors=[]`.

- [ ] **Step 5: בדוק ידנית שהחלפת גיבור עובדת**

עם השרת המקומי מ-Task 4: מלא פרופיל, הוסף אירוע מתבנית "קורס מפקדים", לחץ על הכרטיס שלו, וּודא שהגיבור התחלף לקורס המפקדים ושהמסך גלל למעלה.

- [ ] **Step 6: Commit**

```bash
git add service-countdown/index.html
git commit -m "Add the service timeline, event strip and template sheet

Tapping an event promotes it to the headline, so the number on screen
follows whatever the user is actually counting down to. Milestones are
derived from the profile rather than stored, keeping them consistent
with the release date."
```

---

## Task 6: מוֹשן

**Files:**
- Modify: `service-countdown/index.html`

**Interfaces:**
- Consumes: אלמנט `#hero` ו-`#heroNum` מ-Task 3.
- Produces: `motion.init()`.

- [ ] **Step 1: הוסף CSS להתכווצות**

```css
.hero{
  --t:0;                                    /* 0 = full hero, 1 = collapsed */
  transform:scale(calc(1 - var(--t) * .35));
  opacity:calc(1 - var(--t) * .55);
  transform-origin:top center;
  will-change:transform, opacity;
}
.hero-num{transition:color .3s var(--ease)}
@keyframes roll{
  from{transform:translateY(.35em); opacity:0}
  to{transform:none; opacity:1}
}
.rolling{animation:roll .45s var(--ease)}
```

- [ ] **Step 2: הוסף את מודול `motion`**

```html
<script>
/* ---------- motion: scroll-driven hero collapse + digit roll ---------- */
const motion = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Deliberately NOT animation-timeline: scroll(). That is Chromium-only and
  // this tool's primary target is an installed PWA on iOS Safari, where it
  // would silently do nothing.
  function init() {
    if (reduce) return;
    const hero = document.getElementById('hero');
    if (!hero) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const t = Math.min(1, window.scrollY / (window.innerHeight * 0.6));
        hero.style.setProperty('--t', t.toFixed(3));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function rollNumber() {
    if (reduce) return;
    const n = document.getElementById('heroNum');
    if (!n) return;
    n.classList.remove('rolling');
    void n.offsetWidth;             // force reflow so the animation restarts
    n.classList.add('rolling');
  }

  return { init, rollNumber };
})();
</script>
```

- [ ] **Step 3: חבר ל-`refresh` ולאתחול**

```js
function refresh() {
  render.hero(state);
  render.timeline(state);
  render.events(state, refresh);
  motion.rollNumber();
}
```

והוסף `motion.init();` בסוף בלוק האתחול.

- [ ] **Step 4: אמת headless (כולל reduced-motion)**

```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc6-dark.png dark 412
```

צפוי: `overflow=false console_errors=[]`. ודא שהגיבור עדיין מלא (ה-scroll הוא 0 בטעינה, כלומר `--t:0`).

- [ ] **Step 5: Commit**

```bash
git add service-countdown/index.html
git commit -m "Add scroll-driven hero collapse and digit roll

Drives the collapse from a throttled scroll listener rather than
animation-timeline, which is Chromium-only and would do nothing on the
iOS PWA this targets. Both effects are disabled under reduced motion."
```

---

## Task 7: מסך הגדרות ומחיקת אירוע

האפיון §4 דורש מסך הגדרות (מצב תצוגה, עריכת פרופיל, ייצוא/ייבוא, איפוס).
כל הלוגיקה כבר קיימת ובדוקה ב-`store` מ-Task 2 — כאן נוסף רק ה-UI.
בנוסף, בלי מחיקה אירוע עם תאריך שגוי נתקע לצמיתות.

**Files:**
- Modify: `service-countdown/index.html`

**Interfaces:**
- Consumes: `store.exportJSON`, `store.importJSON`, `store.save`, `store.blank`, `render.wizard`.
- Produces: `render.settings(state, refresh)`; כפתור מחיקה בכל שורת אירוע לא-וירטואלית.

- [ ] **Step 1: הוסף CSS**

```css
.topbar{position:fixed; inset-block-start:0; inset-inline-end:0; z-index:10;
  padding:.9rem; display:flex; gap:.4rem}
.iconbtn{width:40px; height:40px; display:inline-flex; align-items:center;
  justify-content:center; border-radius:12px; cursor:pointer; font:inherit;
  background:color-mix(in srgb, var(--card) 80%, transparent);
  border:1px solid var(--line); color:var(--ink);
  -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px)}
.ev-del{flex:none; width:32px; height:32px; display:inline-flex; align-items:center;
  justify-content:center; border-radius:10px; border:1px solid transparent;
  background:transparent; color:var(--muted); cursor:pointer; font:inherit}
.ev-del:hover{border-color:var(--line-strong); color:var(--ink)}
```

- [ ] **Step 2: הוסף אייקונים חסרים ל-`ICONS`**

```js
  'trash': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/>',
```

- [ ] **Step 3: הוסף סרגל עליון ל-`<body>`**

מיד אחרי `<main id="app">`:

```html
<div class="topbar">
  <button class="iconbtn" id="btnTheme" type="button" aria-label="החלף מצב תצוגה"></button>
  <button class="iconbtn" id="btnSettings" type="button" aria-label="הגדרות"></button>
</div>
```

- [ ] **Step 4: הוסף `render.settings` בתוך ה-IIFE של `render`**

```js
function settings(state, refresh) {
  const box = el('div', { class: 'sheet' });
  box.innerHTML = `
    <h2>הגדרות</h2>
    <div class="row">
      <button class="btn" id="sProfile" type="button">ערוך תאריכי שירות</button>
    </div>
    <div class="row">
      <button class="btn" id="sExport" type="button">ייצא גיבוי</button>
      <button class="btn" id="sImport" type="button">ייבא גיבוי</button>
      <input type="file" id="sFile" accept="application/json" hidden>
    </div>
    <p class="ev-d">הגיבוי נשמר כקובץ במכשיר. אין ענן ואין חשבון — אם תחליף מכשיר,
      זו הדרך להעביר את הנתונים.</p>
    <p class="err" id="sErr"></p>
    <div class="row">
      <button class="btn" id="sReset" type="button">אפס הכול</button>
      <button class="btn ghost" id="sClose" type="button">סגור</button>
    </div>`;
  document.body.append(box);
  const err = box.querySelector('#sErr');

  box.querySelector('#sClose').onclick = () => box.remove();

  box.querySelector('#sProfile').onclick = () => {
    box.remove();
    render.wizard(state, refresh);
  };

  box.querySelector('#sExport').onclick = () => {
    const blob = new Blob([store.exportJSON(state)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ha-sfira-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const file = box.querySelector('#sFile');
  box.querySelector('#sImport').onclick = () => file.click();
  file.onchange = () => {
    const f = file.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const next = store.importJSON(String(r.result));
        Object.assign(state, next);        // keep the same object identity
        store.save(state);
        box.remove();
        refresh();
      } catch (e) {
        err.textContent = 'הקובץ לא תקין: ' + e.message;
      }
    };
    r.readAsText(f);
  };

  box.querySelector('#sReset').onclick = () => {
    if (!confirm('למחוק את כל הנתונים? אי אפשר לבטל.')) return;
    Object.assign(state, store.blank());
    store.save(state);
    box.remove();
    refresh();
  };
}
```

עדכן את ה-`return` ל-`return { hero, wizard, timeline, events, addSheet, settings };`.

- [ ] **Step 5: הוסף כפתור מחיקה לשורת אירוע**

ב-`events()` מ-Task 5, אחרי `row.append(el('span', { class: 'ev-days' }, ...))` — כלומר לפני `host.append(row)` — החלף את הוספת השורה ב:

```js
    const wrap = el('div', { class: 'row' });
    wrap.append(row);
    if (!ev.virtual) {                       // release comes from the profile
      const del = el('button', { class: 'ev-del', type: 'button', 'aria-label': 'מחק ' + ev.title },
        icon('trash'));
      del.onclick = () => {
        state.events = state.events.filter(x => x.id !== ev.id);
        store.save(state);
        refresh();
      };
      wrap.append(del);
    }
    host.append(wrap);
```

(הסר את השורה `host.append(row);` הקודמת.)

- [ ] **Step 6: חבר את הכפתורים בסרגל**

בבלוק האתחול, לפני `motion.init()`:

```js
const btnTheme = document.getElementById('btnTheme');
const btnSettings = document.getElementById('btnSettings');

function paintTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  btnTheme.innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon');
}
btnTheme.onclick = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  store.save(state);
  paintTheme();
};
btnSettings.innerHTML = icon('settings');
btnSettings.onclick = () => render.settings(state, refresh);
paintTheme();
```

**הערה:** `paintTheme()` מחליף את השורה `document.documentElement.setAttribute('data-theme', state.theme);` מ-Task 3 — הסר את הישנה כדי שלא תהיה כפילות.

- [ ] **Step 7: אמת headless באור ובחושך**

```bash
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc7-dark.png dark 412
node .claude/tools/screenshot.mjs service-countdown/index.html /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/sc7-light.png light 412
```

צפוי בשתיהן: `overflow=false console_errors=[]`. ודא שהסרגל העליון לא חופף לגיבור.

- [ ] **Step 8: בדוק ידנית ייצוא/ייבוא**

עם השרת המקומי: ייצא גיבוי, אפס הכול, ייבא את הקובץ, וּודא שהפרופיל והאירועים חזרו. נסה גם לייבא קובץ טקסט שאינו JSON — צפויה הודעת שגיאה, והמצב הקיים לא נדרס.

- [ ] **Step 9: Commit**

```bash
git add service-countdown/index.html
git commit -m "Add settings sheet and event deletion

Manual export and import are the only backup path here, since there is
no cloud and no account, so a device change would otherwise lose
everything. A malformed import reports the error and leaves existing
data untouched."
```

---

## Task 8: נכסי PWA, שילוב בנחיתה, שער איכות ומיזוג

**Files:**
- Create: `service-countdown/manifest.webmanifest`, `service-countdown/sw.js`, ארבעת האייקונים
- Modify: `service-countdown/index.html` (רישום SW), `landing/index.html`, `landing/sw.js`, `README.md`, `.claude/PROJECT_LESSONS.md`

- [ ] **Step 1: צור את המניפסט**

`service-countdown/manifest.webmanifest`:

```json
{
  "name": "הספירה — ספירה לאחור לשירות",
  "short_name": "הספירה",
  "description": "ספירה לאחור לשחרור ולכל אבן דרך בשירות — סוף קורס, כומתה, רגילה. עם ציר שירות ואחוז פז\"מ. עובד אופליין, הנתונים במכשיר בלבד.",
  "lang": "he",
  "dir": "rtl",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#13140f",
  "theme_color": "#13140f",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: צור את ה-service worker**

העתק את `compound-calculator/sw.js` ל-`service-countdown/sw.js` והחלף **רק** את שורת המטמון:

```bash
cp compound-calculator/sw.js service-countdown/sw.js
```

ואז ערוך: `const CACHE = "cc-v2";` → `const CACHE = "sc-v1";`

- [ ] **Step 3: רשום את ה-SW ב-`index.html`**

הוסף בסוף בלוק האתחול:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
```

- [ ] **Step 4: ייצר את האייקונים**

צור קובץ מקור זמני:

```bash
cat > /tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad/icon.html <<'HTML'
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;width:256px;height:256px;overflow:hidden}
  body{background:#13140f;display:flex;align-items:center;justify-content:center}
  svg{width:150px;height:150px;color:#e0a33c}
</style>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/>
  <path d="M12 10v4l2 2"/><path d="M9 2h6"/>
</svg>
HTML
```

הרץ את ההמרות (`screenshot.mjs` משתמש ב-`deviceScaleFactor:2`, לכן רוחב הצפייה הוא חצי מגודל היעד):

```bash
SP=/tmp/claude-0/-home-user-Learning-/989f20f6-0ff2-5cb7-9a24-3340e9cc8d46/scratchpad
node .claude/tools/screenshot.mjs $SP/icon.html service-countdown/icon-512.png dark 256
sed -i 's/width:256px;height:256px/width:96px;height:96px/; s/width:150px;height:150px/width:56px;height:56px/' $SP/icon.html
node .claude/tools/screenshot.mjs $SP/icon.html service-countdown/icon-192.png dark 96
sed -i 's/width:96px;height:96px/width:90px;height:90px/; s/width:56px;height:56px/width:52px;height:52px/' $SP/icon.html
node .claude/tools/screenshot.mjs $SP/icon.html service-countdown/apple-touch-icon.png dark 90
# maskable: same art, smaller glyph so it survives the platform's safe-zone crop
sed -i 's/width:90px;height:90px/width:256px;height:256px/; s/width:52px;height:52px/width:110px;height:110px/' $SP/icon.html
node .claude/tools/screenshot.mjs $SP/icon.html service-countdown/icon-maskable-512.png dark 256
```

אמת את הגדלים:

```bash
file service-countdown/*.png
```

צפוי: `512 x 512`, `192 x 192`, `180 x 180`, `512 x 512` בהתאמה.

- [ ] **Step 5: הוסף כרטיס לדף הנחיתה**

ב-`landing/index.html`, אחרי הכרטיס של `compound-calculator` (סביב שורה 196), הוסף:

```html
    <a class="card" href="./service-countdown/" style="--c:#8a5a12">
      <span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M12 10v4l2 2"/><path d="M9 2h6"/></svg></span>
      <span class="t">הספירה</span>
      <span class="d">ספירה לאחור לשחרור ולכל אבן דרך בשירות, עם ציר שירות ואחוז פז״מ</span>
      <span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></span>
    </a>
```

- [ ] **Step 6: באמפ ל-`landing/sw.js`**

הנחיתה השתנתה, ולכן ה-PWA המותקן חייב לקבל את הגרסה החדשה. מצא את `const CACHE = "tools-hub-vN"` והעלה את `N` באחד.

```bash
grep -n 'tools-hub-v' landing/sw.js
```

- [ ] **Step 7: הוסף שורה ל-`README.md`**

ברשימת הכלים, אחרי `compound-calculator`:

```markdown
- **service-countdown/** — "הספירה": ספירה לאחור לשחרור ולכל אבן דרך בשירות
  (סוף קורס מפקדים, כומתה, רגילה), עם גיבור מלא-מסך, ציר שירות ואחוז פז"מ.
  אשף שמציע תאריך שחרור מתאריך הגיוס. הנתונים במכשיר בלבד, עובד אופליין.
```

- [ ] **Step 8: הרץ את שער האיכות המלא**

```bash
node service-countdown/test/dates.test.mjs
node .claude/tools/verify-all.mjs
```

צפוי: הבדיקות עוברות, ו-`verify-all` ירוק — כולל גילוי `service-countdown` כרשימת הכלים, מניפסט תקין, רישום SW, קישור מהנחיתה, ורינדור באור ובחושך ללא שגיאות קונסולה וללא גלישה.

**אם `verify-all` אדום — אל תמשיך לשלב הבא.** תקן, והרץ שוב.

- [ ] **Step 9: עדכן את `PROJECT_LESSONS.md`**

חובה לפי `CLAUDE.md` בכל דחיפה ל-main. הוסף לטבלת האקסנטים:

```
service-countdown ענבר `#8a5a12` / `#e0a33c` (הכלי היחיד שברירת המחדל שלו כהה)
```

והוסף תחת "מערכת העיצוב":

```markdown
- **מדיניות גופנים (הייתה לא כתובה עד 07/08/2026):** מחסנית מערכת בלבד —
  `system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Hebrew",Arial,sans-serif`.
  אין Google Fonts, אין הטמעת קובץ גופן, אין CDN.
- **ייצור אייקוני PWA בלי תלויות:** `screenshot.mjs` עם `deviceScaleFactor:2` —
  קבע ל-HTML גוף בגודל **חצי** מגודל היעד והעבר את אותו חצי כ-`width`
  (256→512, 96→192, 90→180). חוסך התקנת ספריית גרפיקה.
```

והוסף להיסטוריית השינויים:

```markdown
- **07/08/2026:** נוסף הכלי `service-countdown` ("הספירה") — ספירה לאחור
  לאירועי שירות. אפיון: `docs/superpowers/specs/2026-08-07-service-countdown-design.md`
  (כולל תיעוד דחיית מעבר לאפליקציה נייטיבית). תוכנית:
  `docs/superpowers/plans/2026-08-07-service-countdown.md`.
```

- [ ] **Step 10: Commit**

```bash
git add service-countdown landing/index.html landing/sw.js README.md .claude/PROJECT_LESSONS.md
git commit -m "Ship the service-countdown tool

Adds PWA assets, the landing card and the README entry, and bumps the
landing service worker so installed copies pick up the new card.
Records the previously-unwritten font policy and the dependency-free
icon generation trick in the lessons file."
```

- [ ] **Step 11: מזג ל-main ודחוף**

לפי `PROJECT_LESSONS` — רק אחרי ששער האיכות ירוק (Step 8).

```bash
git push -u origin claude/offline-apps-repo-t8cm5t
git merge-base --is-ancestor origin/main HEAD && echo "fast-forward OK"
git push origin claude/offline-apps-repo-t8cm5t:main
```

אם `merge-base` נכשל — `git fetch origin main` ואז rebase לפני הדחיפה. **אל תדחוף בכוח ל-main.**

- [ ] **Step 12: אמת שהפריסה עברה**

Pages מתעכב 1–5 דקות ומהמטמון של ה-proxy. **מקור אמת מיידי הוא git, לא העמוד החי:**

```bash
curl -sI https://raw.githubusercontent.com/Idogol123/Learning-/main/service-countdown/index.html | head -1
```

צפוי `HTTP/2 200`. אל תכריז "חי" על סמך fetch ל-Pages מיד אחרי הדחיפה.

---

## סקירה עצמית של התוכנית

**כיסוי האפיון:**

| סעיף באפיון | משימה |
|---|---|
| §2 זהות, אקסנט, ברירת מחדל כהה | Task 3 (טוקנים), Task 8 (מניפסט, כרטיס) |
| §3 ארבעת המודולים | Tasks 1, 2, 3, 6 |
| §3 מודל הנתונים, שחרור וירטואלי, נפילת `heroId` | Task 2 |
| §3 אפס משאבים חיצוניים | Global Constraints; נאכף ב-Task 8 Step 8 |
| §4 אשף | Task 4 |
| §4 גיבור | Task 3 |
| §4 ציר זמן + אבני דרך | Task 5 |
| §4 רצועת אירועים + החלפת גיבור | Task 5 |
| §4 הוספת אירוע + תבניות | Task 5 |
| §4 הגדרות (תצוגה, פרופיל, ייצוא/ייבוא, איפוס) | Task 7 |
| §5 מוֹשן + reduced-motion | Task 6 |
| §6 קצוות (DST, גלישת חודש, ניסוח, מצבים ריקים) | Tasks 1, 2, 3, 5 |
| §6 `localStorage` חסום · ייבוא פגום | Tasks 2, 4, 7 |
| §7 בדיקות | Tasks 1, 2, 8 |
| §8 פריסה | Task 8 |

**מה במודע מחוץ לתוכנית:** עריכת אירוע קיים (בניגוד למחיקה, שנוספה ב-Task 7).
אירוע עם תאריך שגוי נמחק ונוצר מחדש — שתי לחיצות, ולא מצדיק מסך עריכה נפרד.
`heroId` שמצביע על אירוע שנמחק כבר מטופל בנפילה חזרה של `store.heroEvent` (Task 2).

**עקביות טיפוסים:** `dates.*` (Task 1) נצרך בזהות ב-Tasks 2–6. `store.allEvents` מחזיר תמיד `{id,title,date,icon,source,virtual}` — הצורה שבה משתמשים `render.events` ו-`render.hero`. `refresh()` מוגדר ב-Task 4 ומורחב ב-Tasks 5 ו-6 באותה חתימה (ללא ארגומנטים).
