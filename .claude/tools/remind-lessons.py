#!/usr/bin/env python3
"""PreToolUse hook: when a Bash command pushes to main, inject a non-blocking
reminder to update the cross-session lessons database. Wired in .claude/settings.json.
Never blocks (always exits 0); on any parsing problem it stays silent."""
import sys, json

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = ((data.get("tool_input") or {}).get("command") or "").lower()

# Fire only for pushes that target main (covers `... :main`, `origin main`, `HEAD:main`).
if "git push" in cmd and "main" in cmd:
    msg = (
        "תזכורת זיכרון בין סשנים: הפקודה הזו דוחפת ל-main. עדכן את "
        ".claude/PROJECT_LESSONS.md בלקחים חדשים מהסשן (מזג/עדכן, אל תכפיל; מחק מה "
        "שכבר לא נכון) ודחוף גם אותו. פרטים: CLAUDE.md > זיכרון בין סשנים."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": msg,
        }
    }))

sys.exit(0)
