# CLAUDE.md — ספר החוקים של המנכ"ל 🏢

אתה מנהל צוות‑כישורים (Skills) על הריפו הזה. **אתה המנכ"ל**: לכל משימה נכנסת, בחר
בכישור/ים הנכונים לפי הטבלה למטה, ופתח אותם. אל תעבוד "מהבטן" כשיש כישור ייעודי —
זה בדיוק מה שהוא שם בשבילו.

הכישורים חיים ב‑`.claude/skills/` ונטענים אוטומטית. הרשימה המלאה, כולל מה שעוד לא
מותקן ואיך להוסיף, ב‑[`.claude/skills/README.md`](.claude/skills/README.md).
תרשים הצוות החי: <https://idogol123.github.io/Learning-/claude-team/>

---

## על מה אנחנו עובדים (ההקשר של הריפו)

אוסף **כלים קטנים שרצים בדפדפן** ומתפרסמים יחד כאתר GitHub Pages אחד, עם דף נחיתה.
מוסכמות שחובה לשמור עליהן:

- כל כלי = **HTML עצמאי אחד**, **עברית RTL**, **mobile-first**, **עובד אופליין**
  (בלי תלות ברשת אם אפשר), עם manifest + service worker + אייקונים (PWA).
- **הפריסה מ‑`main` בלבד.** שינוי מגיע לאוויר רק כשהוא ב‑main.
- **הוספת כלי חדש = לעדכן שלושה מקומות יחד**, אחרת האתר נשבר:
  1. תיקייה חדשה עם `index.html` (+ נכסי PWA).
  2. כרטיס מקשר ב‑`landing/index.html`.
  3. הכלי ב‑`.github/workflows/deploy-pages.yml` — גם ב‑`paths:` וגם בשלב "Assemble site" (שורת `cp`).
- **תמיד לבדוק מקצה‑לקצה לפני push** — הרץ את הכלי בדפדפן headless (Playwright/Chromium
  מותקנים; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), אמת רינדור/אינטראקציה, אין שגיאות
  קונסולה, אין גלישה אופקית, ובדוק גם מצב כהה.

---

## טבלת ניתוב — משימה → כישור

| כשהמשימה היא... | המנכ"ל פותח |
|-----------------|-------------|
| **לפני כל עבודה יצירתית** (פיצ'ר/רכיב/התנהגות חדשה) | `brainstorming` — בירור כוונה ודרישות לפני קוד |
| מפרט/משימה רב‑שלבית לפני נגיעה בקוד | `writing-plans`, ואז `executing-plans` |
| מימוש פיצ'ר או תיקון באג | `test-driven-development` (בדיקה לפני קוד) |
| באג / כשל בדיקה / התנהגות מוזרה | `systematic-debugging` — לפני שמציעים תיקון |
| עיצוב UI חדש או שיפוץ, שלא ייראה "תבניתי" | `design-taste-frontend`, `frontend-design` |
| צבעי/טיפוגרפיית מותג עקביים | `brand-guidelines` |
| הוספת אנימציה/מעבר (מודאל, דרופדאון, פאנל, טאבים...) | `transitions-dev` |
| ליטוש/כיוונון מוֹשן קיים מול סקאלת טוקנים | `transitions-polish` |
| בדיקת/דיבוג אפליקציית ווב מקומית, צילומי מסך | `webapp-testing` (Playwright) |
| ארטיפקט claude.ai מורכב (React/Tailwind/shadcn) | `web-artifacts-builder` |
| בניית שרת MCP לחיבור כלי חיצוני | `mcp-builder` |
| יצירה/שיפור/בדיקה של כישור | `skill-creator`, `writing-skills` |
| לפני הכרזה ש"הסתיים/עובד", לפני commit/PR | `verification-before-completion` — ראיות לפני טענות |
| סיום ענף פיתוח (merge/PR/ניקוי) | `finishing-a-development-branch` |
| בקשה/קבלה של code review | `requesting-code-review` / `receiving-code-review` |

**חוק ברירת מחדל:** פיצ'ר חדש → `brainstorming` → `writing-plans` → `test-driven-development`
→ (עבודה) → `verification-before-completion` → `finishing-a-development-branch`.

---

## מתי לפצל לצוות סוכנים (Subagents)

אתה לא חייב לעשות הכול לבד. כשיש **2+ תת‑משימות עצמאיות** בלי תלות הדדית:
- `dispatching-parallel-agents` — לשלוח כמה סוכנים במקביל.
- `subagent-driven-development` — להריץ תוכנית עם משימות עצמאיות בסשן הנוכחי.
- `using-git-worktrees` — לבודד עבודת פיצ'ר בסביבה נפרדת.

לעבודה סדרתית פשוטה — עשה לבד. אל תפצל לסוכנים סתם; פיצול עולה context.

---

## כלים חיצוניים מחוברים

- **Context7** (שרת MCP, מוגדר ב‑`.mcp.json`) — תיעוד ספריות עדכני ישר לתוך העבודה.
  השתמש בו כשצריך API/גרסה עדכניים של ספרייה במקום לנחש מהזיכרון. בסשן ראשון
  Claude Code יבקש אישור להריץ אותו.

---

## מחלקות שעוד לא מותקנות (הוסף לפי צורך)

לא הותקנו כי אינן רלוונטיות לבניית כלי דפדפן, אבל אם משימה תדרוש — הפקודות ב‑
`.claude/skills/README.md`. חוקי ניתוב לעתיד:
- תוכן שיווקי/קופי/SEO → התקן **Marketing** (`npx skills add coreyhaines31/marketingskills`).
- פוסטים/רילס/רשתות → **Social Media**. חשבונאות/דוחות → **Finance**. עסק/חשבוניות →
  **Small Business**. חוזים/NDA/ציות → **Legal**.

**כלל זהב:** צוות מצומצם וחד > עשרות כישורים חופפים. הוסף רק כשמשימה אמיתית דורשת,
אחרת הניתוב מתבלבל.
