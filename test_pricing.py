"""
Unit tests for the TASE agorot normalisation in pricing.py.

Run:  python3 test_pricing.py

Pure and offline -- exercises `_normalize_tase` directly, so it needs no
network and no yfinance installed (pricing.py degrades gracefully if yfinance
is missing). Guards the rule that we only divide by 100 when confident it's
agorot, so an untagged shekel quote is never silently shrunk 100x.
"""

from pricing import _normalize_tase, AGOROT_THRESHOLD


def _check(desc, cond):
    assert cond, f"FAILED: {desc}"
    print(f"  ok - {desc}")


def main() -> None:
    print("_normalize_tase branches")

    # "ILA" -> agorot, divide by 100.
    adj, price, prev = _normalize_tase(1234.0, 1200.0, "ILA")
    _check('"ILA" is treated as agorot and divided', adj and price == 12.34 and prev == 12.0)

    # lower-case tag still recognised.
    adj, price, _ = _normalize_tase(500.0, None, "ila")
    _check('"ila" (any case) divides', adj and price == 5.0)

    # "ILS" -> already shekels, never divide (even for a big number).
    adj, price, prev = _normalize_tase(1500.0, 1490.0, "ILS")
    _check('"ILS" is NOT divided even above threshold', (not adj) and price == 1500.0 and prev == 1490.0)

    # Untagged + high price -> heuristic says agorot, divide.
    adj, price, _ = _normalize_tase(3200.0, None, "")
    _check("untagged high quote (>threshold) is divided", adj and price == 32.0)

    # Untagged + LOW price -> the case the old code got wrong: must NOT divide.
    adj, price, prev = _normalize_tase(42.5, 41.0, None)
    _check("untagged low quote (<=threshold) is left as-is", (not adj) and price == 42.5 and prev == 41.0)

    # Exactly at the threshold -> not agorot (strictly greater required).
    adj, price, _ = _normalize_tase(AGOROT_THRESHOLD, None, None)
    _check("quote exactly at threshold is not divided", (not adj) and price == AGOROT_THRESHOLD)

    # Unknown non-ILS/ILA tag falls back to the threshold heuristic.
    adj, price, _ = _normalize_tase(50.0, None, "USD")
    _check("unknown tag + low price is not divided", (not adj) and price == 50.0)

    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
