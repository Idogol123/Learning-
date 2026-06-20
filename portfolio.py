"""חישוב צמיחת תיק השקעות.

מתחילים מ-10,000 ש"ח, מוסיפים 2,000 ש"ח כל חודש,
ומדפיסים את הסכום אחרי 24 ו-36 חודשים,
בהנחות תשואה שנתית של 0%, 5% ו-8%.
"""

INITIAL = 10_000      # סכום התחלתי בש"ח
MONTHLY = 2_000       # הפקדה חודשית בש"ח

ANNUAL_RATES = [0.0, 0.05, 0.08]   # תשואות שנתיות
CHECKPOINTS = [24, 36]             # נקודות בדיקה (בחודשים)


def portfolio_value(months, annual_rate):
    """מחזיר את שווי התיק לאחר מספר חודשים בהינתן תשואה שנתית."""
    monthly_rate = annual_rate / 12
    balance = INITIAL
    for _ in range(months):
        balance = balance * (1 + monthly_rate) + MONTHLY
    return balance


def months_to_target(target, annual_rate=0.05):
    """מדפיס באיזה חודש שווי התיק חוצה את סכום היעד בהינתן תשואה שנתית."""
    monthly_rate = annual_rate / 12
    balance = INITIAL
    month = 0
    while balance < target:
        balance = balance * (1 + monthly_rate) + MONTHLY
        month += 1
    print(
        f'בתשואה שנתית {annual_rate * 100:.0f}% חוצים את היעד של '
        f'{target:,.0f} ש"ח בחודש {month} (יתרה: {balance:,.2f} ש"ח)'
    )
    return month


def main():
    print(f'סכום התחלתי: {INITIAL:,.0f} ש"ח')
    print(f'הפקדה חודשית: {MONTHLY:,.0f} ש"ח')
    print()

    for rate in ANNUAL_RATES:
        print(f'תשואה שנתית {rate * 100:.0f}%:')
        for months in CHECKPOINTS:
            value = portfolio_value(months, rate)
            print(f'  אחרי {months} חודשים: {value:,.2f} ש"ח')
        print()

    months_to_target(100_000, 0.05)


if __name__ == "__main__":
    main()
