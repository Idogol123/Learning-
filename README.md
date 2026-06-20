# Personal Portfolio Tracker

A single-user, local Streamlit dashboard. You tell it which securities you hold
and how many units; it shows current total value (ILS + USD), per-holding
breakdown and allocation, concentration flags, an assumption-driven forward
projection, and a contribution "what-if" planner.

## What this app deliberately refuses to do — and why

1. **It does not predict short-term returns.** There is no single confident
   "expected return" number anywhere. Short-horizon prediction is mostly noise.
   Every projected figure is tied to an assumption *you* set and is shown as a
   **bear / base / bull range**. A 1-month projection is omitted on purpose.
2. **It does not tell you what to buy or sell.** It describes allocation,
   concentration, and the *effect* of a contribution on your weights. It never
   ranks, scores, or recommends a security. You make the call.

## Run

```bash
pip install -r requirements.txt
streamlit run app.py
```

Then open the URL Streamlit prints (default http://localhost:8501).

### Verify prices first (recommended)

Before trusting any totals, confirm live prices and the TASE agorot conversion
against your broker:

```bash
python smoke_test.py
```

This fetches a few real tickers (US + TASE) and the USD/ILS rate. Check that a
`.TA` holding shows the right **per-share price in shekels** (yfinance quotes
Tel-Aviv in agorot, 1/100 ILS; the app divides by 100 and flags it as
`agorot_adjusted`). If a `.TA` price looks ~100× too big, the agorot handling
needs a tweak for that symbol.

> Note: live data requires outbound access to Yahoo Finance. In a locked-down
> environment all fetches degrade to a graceful "price unavailable" state — the
> app still loads and flags what it couldn't get.

## Holdings

Holdings live in **`holdings.csv`**:

| column | meaning |
| --- | --- |
| `ticker` | US e.g. `VOO`, TASE e.g. `ESLT.TA` |
| `quantity` | units held |
| `asset_class` | equity / bond / reit / commodity / cash / crypto / other |
| `cost_basis` | per-unit cost in the security's own currency (optional → enables P/L) |
| `account` | free text (broker/account) |
| `note` | free text |

You can edit the CSV directly or use the in-app **Edit holdings** tab
(`st.data_editor`), which reads/writes the same file and validates tickers on
save.

## Screens

- **Overview** — total value (ILS + USD), today's change, and a holdings table
  with live price, market value, % of portfolio, and unrealized P/L where a
  cost basis is set.
- **Allocation** — breakdowns by holding, asset class, currency, and market
  (TASE vs US), plus a concentration flag for any holding over a threshold
  (default 20%, editable in the sidebar).
- **Projection** — you set an assumed annual nominal return per asset class
  (pre-filled with neutral placeholder anchors, *not advice*). Compounds your
  current value to 1yr and 5yr including a planned monthly contribution, shown
  as bear/base/bull (base ± an editable spread, default ±4pp).
- **Contribution planner** — enter a contribution (default ₪2000) and a target
  holding (existing or a candidate ticker you type). It describes how that
  shifts your weights and concentration — effects only, no recommendation.

## Data layer

All network access is centralised in **`pricing.py`** behind `get_price(ticker)`
and `get_fx_rate()`:

- on-disk price cache (15-min TTL) so we don't hammer yfinance;
- per-ticker "price unavailable" state so one bad symbol never crashes the app;
- TASE agorot → ILS (÷100) normalisation, surfaced via an `agorot_adjusted` flag;
- USD → ILS conversion via a live, cached `ILS=X` rate.

yfinance is scraping-based and breaks periodically. There is a
`# TODO: fallback provider (e.g. Stooq, no API key)` marker as a real-machine
resilience option for Yahoo rate-limits.

## Files

```
app.py            Streamlit UI (the four screens + holdings editor)
pricing.py        Data layer: get_price / get_fx_rate, caching, agorot, FX
holdings.csv      Your holdings (sample provided)
smoke_test.py     Offline-mockable price-layer verification
requirements.txt  Pinned dependencies
```
