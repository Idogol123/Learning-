# 📚 לקחי סשנים — מאגר הזיכרון של הפרויקט

הקובץ הזה הוא הזיכרון המצטבר בין סשנים (הריפו שורד; הסשן לא).

**פרוטוקול:**
1. **בתחילת כל `/project`** — קרא את הקובץ הזה במלואו ופעל לפיו. אל תגלה מחדש מה שכבר למדנו.
2. **בכל דחיפה ל-main** — עדכן כאן לקחים חדשים מהסשן (מזג/עדכן שורות קיימות, אל תכפיל). שמור תמציתי, פרקטי, ובר-פעולה. מחק לקחים שכבר לא נכונים.

---

## סביבה וכלים (איך לעבוד מהר וזול)
- **צילום מסך / בדיקת headless:** יש helper מוכן — הרץ
  `node .claude/tools/screenshot.mjs <file|url> <out.png> [light|dark] [width]`.
  הוא מדפיס `overflow=` ו-`console_errors=`, מאתר את Chromium לבד, ומטפל ב-dialogs.
  **אל תבנה סקריפט Playwright מאפס** — זה בזבז כמה ניסיונות בעבר (Playwright מותקן
  גלובלית ולא כ-node_module מקומי; import דרך `npm root -g` + default export).
- **אל תקרא את `file-search/index.html` במלואו** — יש בו blob מוטמע של ~3.3MB.
  קרא רק את בלוק ה-`<style>` ואת ה-markup (header/body), למשל עם Grep/offset.
- **פלט `mcp__github__actions_list` ענק** (מאות אלפי תווים) — סנן עם python/jq על
  הקובץ שנשמר, אל תקרא הכול לתוך ההקשר.

## מערכת העיצוב (השפה המאוחדת — אל תחזור ל"מראה זול")
תלונת-העבר: "נראה זול, AI כזה". הגורמים: אימוג'י בריבועים צבעוניים, קשת צבעים אקראית,
גופן מערכת שטוח, כרטיסים גנריים. הפתרון שכבר יושם — שמור עליו:
- **נייטרלים (בהיר):** `--bg:#f2f1ea; --card:#fbfaf5; ink/text:#1c1e16; --muted:#6b7061; --line:#e0ded2; --line-strong:#d0cebf`.
- **נייטרלים (כהה):** `--bg:#13140f; --card:#1c1e15; ink:#edefe1; --muted:#9aa08c; --line:#2c2f23; --line-strong:#3a3d2e`.
- **טוקנים משותפים:** `--shadow`/`--shadow-hover` = צל שכבתי **בגוון** (לא שחור טהור);
  `--ease:cubic-bezier(.16,1,.3,1)`; רדיוס 16px; `-webkit-font-smoothing:antialiased`.
- **אקסנט לכל כלי (מתואם, לא אקראי) — בהיר / כהה:**
  guard-duty זית `#4b5320` / `#b3c256` · file-search פלדה-טורקיז `#3d6b6b` / `#5f9a9a` ·
  portfolio טורקיז `#1e6f5c` / `#3fae90` · compound אורן `#2f7d4f` / `#4bbd7c` ·
  claude-team חמרה `#b0603a` / `#e07a52`.
- **אייקונים:** קו-inline מ-Lucide בלבד. **לא אימוג'י, לא לצייר SVG מהיד.**
  צ'יפ-אייקון = "זכוכית רכה": `color:accent; background:color-mix(in srgb, accent 12%, card);
  border:1px solid color-mix(in srgb, accent 24%, transparent)`.
- כותרות: משקל 800, `letter-spacing:-.02em`. כפתורי back/home = אייקון-קו.
- **דף הנחיתה:** כרטיסים ברשת **2 בשורה** (`grid-template-columns:repeat(2,1fr)`,
  מתקפל ל-1 מתחת ל-360px). אייקון פינה אחת + chevron בפינה הנגדית (bookends).
- כל הכלים חולקים מבנה CSS-variables → **שדרוג = החלפת ערכי `:root`** (סיכון נמוך),
  לא כתיבה מחדש. שמור על **שמות** הטוקנים הקיימים כדי לא לשבור לוגיקה.
- em-dash בעברית בתוכן המשתמש — השאר (פיסוק לגיטימי); רק אל תכניס אימוג'י חדש.

## פריסה וגיט
- **פריסה מ-main בלבד.** `deploy-pages.yml` מופעל רק על נתיבי הכלים/landing —
  שינויי `.claude/**` (כולל הקובץ הזה) **לא** מפעילים deploy. מצוין: אפשר לעדכן לקחים
  בלי לגרום פריסה מיותרת.
- **מיזוג ל-main:** `git push origin <branch>:main` (fast-forward, היסטוריה נקייה).
  לפני כן ודא ש-main הוא ancestor: `git merge-base --is-ancestor origin/main <branch>`.
- **הוספת כלי חדש = 3 מקומות יחד:** (א) תיקייה + `index.html` (+PWA), (ב) כרטיס ב-`landing/index.html`,
  (ג) `deploy-pages.yml` — גם `paths:` וגם שורת ה-cp ב-"Assemble site". **מחיקת כלי** = אותם 3 + שורה ב-`README.md`.
- אחרי push ל-main אפשר לאמת שה-Deploy עבר עם `actions_list` (מסונן).

## היסטוריית שינויים גדולים
- **14/07/2026:** הוסר הכלי `event-history` לגמרי. עוצבו מחדש כל 5 הכלים + דף הנחיתה
  לשפה המאוחדת שלמעלה. דף הנחיתה עבר ל-2-בשורה. נוצר ה-helper לצילומי מסך והמאגר הזה.
