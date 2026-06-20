"""
Step-1 smoke test for the data layer.

Run:  python smoke_test.py

Fetches a few real tickers (mix of US + TASE) and the USD/ILS rate, and prints
the agorot handling so you can eyeball-verify a couple of holdings against your
broker before any UI gets built.
"""

from pricing import get_price, get_fx_rate, to_ils

TEST_TICKERS = ["VOO", "AAPL", "ESLT.TA", "TEVA.TA", "NOTAREALTICKERXYZ"]


def main() -> None:
    print("=" * 72)
    print("USD/ILS FX")
    print("=" * 72)
    fx = get_fx_rate()
    if fx.available:
        print(f"  1 USD = {fx.usd_to_ils:.4f} ILS   (from_cache={fx.from_cache})")
    else:
        print(f"  UNAVAILABLE: {fx.error}")
    print()

    print("=" * 72)
    print("PRICES")
    print("=" * 72)
    for tk in TEST_TICKERS:
        p = get_price(tk)
        if not p.available:
            print(f"  {tk:<20} UNAVAILABLE -> {p.error}")
            continue

        change = f"{p.day_change_pct:+.2f}%" if p.day_change_pct is not None else "n/a"
        ils_val = to_ils(p.price_native, p.currency, fx)
        ils_str = f"{ils_val:,.2f} ILS" if ils_val is not None else "n/a"

        print(f"  {p.ticker:<20} {p.price_native:>12,.2f} {p.currency}   "
              f"(~{ils_str})   day {change}")
        print(f"  {'':<20} raw={p.raw_price} raw_ccy={p.raw_currency} "
              f"tase={p.is_tase} agorot_adjusted={p.agorot_adjusted} cache={p.from_cache}")
    print()
    print("Verify: the per-share ILS values above should match your broker.")
    print("If a .TA holding looks 100x too big, the agorot /100 handling needs a tweak.")


if __name__ == "__main__":
    main()
