# צוות ה‑Claude של הריפו הזה

הריפו מוגדר כ**"מערכת עם צוות שלם"**: אוסף הכישורים (Skills) מהאורג‑צ'ארט של הכלי
[`claude-team`](../../claude-team/) — כך שכשפותחים את הפרויקט ב‑Claude Code (web / CLI /
דסקטופ), Claude מקבל את היכולות האלה.

הקבצים כאן הם **קוד צד‑שלישי** שנטען כהנחיות ל‑Claude. הם ממקורות פתוחים ופומביים,
אבל כדאי להיות מודע לכך לפני הרחבת האוסף.

---

## ✅ מותקנים ומוכנים (נטענים אוטומטית)

ששת הכישורים הבאים כבר יושבים כאן ב‑`.claude/skills/` ונטענים לבד ברגע שפותחים
את הריפו ב‑Claude Code — אין מה להתקין. מקורם ב‑[`anthropics/skills`](https://github.com/anthropics/skills).

| כישור | תיקייה | מה הוא נותן |
|-------|--------|-------------|
| Skill Creator | `skill-creator/` | יצירה ושיפור של כישורים חדשים ל‑Claude |
| MCP Builder | `mcp-builder/` | בניית שרתי MCP לחיבור כלים חיצוניים |
| Webapp Testing | `webapp-testing/` | בדיקת אפליקציות ווב מקומיות עם Playwright |
| Frontend Design | `frontend-design/` | הכוונת עיצוב ממשק מובחן ומכוון |
| Web Artifacts | `web-artifacts-builder/` | בניית ארטיפקטים אינטראקטיביים מרובי‑רכיבים |
| Brand Guidelines | `brand-guidelines/` | החלת צבעי וטיפוגרפיית מותג עקביים |

בנוסף, **כל 14 כישורי ה‑Superpowers** (מ‑[`obra/superpowers`](https://github.com/obra/superpowers))
שתולים כאן ונטענים אוטומטית: `brainstorming`, `test-driven-development`,
`systematic-debugging`, `writing-plans`, `executing-plans`, `subagent-driven-development`,
`dispatching-parallel-agents`, `requesting-code-review`, `receiving-code-review`,
`using-git-worktrees`, `finishing-a-development-branch`, `verification-before-completion`,
`writing-skills`, `using-superpowers`.
הערה: כשמתקינים אותם דרך הפלאגין הרשמי מגיע גם hook שמפעיל אותם אוטומטית; כאן הם
נטענים ככישורים רגילים (Claude יבחר בהם לפי ההקשר) בלי ה‑hook.

---

## 📦 שאר הצוות — התקנה בפקודה אחת אצלך

את אלה אי אפשר היה לשתול אוטומטית: חלקם **פלאגינים**, חלקם **שרתי MCP** או **חבילות npm**,
וחלקם חבילות מתארחות ב‑`claude.com` (חסום מהסביבה שבה נבנה הריפו). ההתקנה היא צעד
אינטראקטיבי שרצים אצלך ב‑Claude Code. הפקודות נלקחו מתיעוד הפרויקטים עצמם.

### מפתחים
- **Superpowers** — ✅ כבר שתול (14 כישורים, ראה למעלה). להתקנה עם ה‑hook המלא
  אפשר גם דרך הפלאגין הרשמי: `/plugin install superpowers@claude-plugins-official`
  · מקור: https://github.com/obra/superpowers
- **Context7** — תיעוד ספריות עדכני ישר לתוך הקוד (שרת MCP)
  ```
  claude mcp add context7 -- npx -y @upstash/context7-mcp
  ```
  מקור: https://github.com/upstash/context7
- **Claude‑Mem** — זיכרון מתמשך בין שיחות
  ```
  npx claude-mem install
  ```
  מקור: https://github.com/thedotmack/claude-mem

### מעצבים
- **UI UX Pro Max** — ערכת עיצוב ממשק מקצה לקצה
  ```
  /plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
  /plugin install ui-ux-pro-max@ui-ux-pro-max-skill
  ```
  מקור: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- **Taste** — שיפוט אסתטי וליטוש עיצובי
  ```
  npx skills add https://github.com/Leonxlnx/taste-skill
  ```
  מקור: https://github.com/Leonxlnx/taste-skill
- **Transitions** — אנימציות ומעברים חלקים
  ```
  npx skills add Jakubantalik/transitions.dev
  ```
  מקור: https://github.com/Jakubantalik/transitions.dev

### חבילות מחלקה שלמות
- **שיווק** (45 כישורים)
  ```
  npx skills add coreyhaines31/marketingskills
  ```
  מקור: https://github.com/coreyhaines31/marketingskills
- **מדיה חברתית** (17 כישורים)
  ```
  /plugin marketplace add charlie947/social-media-skills
  /plugin install social-media-skills
  ```
  מקור: https://github.com/charlie947/social-media-skills
- **פיננסים** (8 כישורים) — פלאגין רשמי. פְּתח `/plugin` ב‑Claude Code והתקן מ‑
  https://claude.com/plugins/finance
- **עסק קטן** (31 כישורים) — פלאגין רשמי:
  https://claude.com/plugins/small-business
- **משפטים** (9 כישורים) — פלאגין רשמי:
  https://claude.com/plugins/legal

---

## איך לוודא שהכישורים המותקנים נטענים
ב‑Claude Code הרץ `/skills` (או פקודת רשימת הכישורים) — ששת הכישורים המקומיים
אמורים להופיע. את התרשים המלא של כל הצוות אפשר לראות בכלי החי:
https://idogol123.github.io/Learning-/claude-team/
