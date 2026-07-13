"""
Personal Portfolio Tracker — single-user local dashboard.

    streamlit run app.py

What this app DELIBERATELY refuses to do:
  1. Predict short-term returns. There is no single confident "expected return"
     number anywhere. Every projected figure is tied to an assumption you set
     and shown as a bear/base/bull range.
  2. Recommend which security to buy or sell. It describes allocation,
     concentration, and the effect of a contribution. You make the call.

All network access lives in pricing.py and degrades gracefully: missing prices,
bad tickers, or no network still load the app and flag what's unavailable.
"""

from __future__ import annotations

import os
from datetime import date

import pandas as pd
import streamlit as st

from pricing import get_price, get_fx_rate, to_ils, clear_cache

_HERE = os.path.dirname(os.path.abspath(__file__))
HOLDINGS_CSV = os.path.join(_HERE, "holdings.csv")              # gitignored; local persistence
HOLDINGS_EXAMPLE = os.path.join(_HERE, "holdings.example.csv")  # committed template
HOLDINGS_COLUMNS = ["ticker", "quantity", "asset_class", "cost_basis", "account", "note"]

SNAPSHOTS_CSV = os.path.join(_HERE, "snapshots.csv")           # gitignored; accrues over time
SNAPSHOT_CORE_COLUMNS = ["date", "total_ils", "total_usd"]     # asset-class breakdown adds ac_* columns
CONTRIBUTIONS_CSV = os.path.join(_HERE, "contributions.csv")  # gitignored; deposits you log
CONTRIBUTIONS_COLUMNS = ["date", "amount_ils", "note"]

# Placeholder assumption anchors — NOT advice. You change these on the Projection
# screen. Neutral, widely-cited long-run nominal anchors only.
DEFAULT_ASSUMPTIONS = {
    "equity": 7.0,
    "bond": 3.0,
    "reit": 6.0,
    "commodity": 4.0,
    "cash": 1.0,
    "crypto": 0.0,   # deliberately neutral; you set your own
    "other": 5.0,
}

st.set_page_config(page_title="Portfolio Tracker", page_icon="📊", layout="wide")


# --------------------------------------------------------------------------- #
# Optional password gate (defense-in-depth)
# --------------------------------------------------------------------------- #

def require_password() -> None:
    """
    If `app_password` is set in st.secrets, gate the whole app behind it. With no
    secret configured (e.g. local dev) the app is open. This is a light gate, not
    real auth — the real protection is keeping the repo private and not committing
    holdings. Pair it with Streamlit Cloud's own viewer allowlist for a private app.
    """
    try:
        configured = st.secrets.get("app_password")
    except Exception:
        configured = None
    if not configured:
        return
    if st.session_state.get("_auth_ok"):
        return

    st.title("🔒 Portfolio Tracker")
    pw = st.text_input("Password", type="password")
    if st.button("Enter"):
        if pw == configured:
            st.session_state["_auth_ok"] = True
            st.rerun()
        else:
            st.error("Wrong password.")
    st.stop()


# --------------------------------------------------------------------------- #
# Holdings persistence
#
# Priority order on load:
#   1. st.secrets["holdings"]  -> survives Streamlit Cloud's ephemeral filesystem
#   2. holdings.csv (local, gitignored) -> local dev / persisted local edits
#   3. holdings.example.csv (committed template) -> first run with nothing set up
#
# Saving writes the local CSV (great locally). On Cloud the filesystem is
# ephemeral, so the Edit tab also offers a "copy as secrets TOML" export to paste
# into the app's Secrets manager for durable persistence.
# --------------------------------------------------------------------------- #

def _normalize_holdings(df: pd.DataFrame) -> pd.DataFrame:
    for col in HOLDINGS_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    df = df[HOLDINGS_COLUMNS].copy()
    df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["cost_basis"] = pd.to_numeric(df["cost_basis"], errors="coerce")
    df = df[df["ticker"].notna() & (df["ticker"] != "") & (df["ticker"] != "NAN")]
    return df.reset_index(drop=True)


def _holdings_from_secrets() -> pd.DataFrame | None:
    try:
        if "holdings" not in st.secrets:
            return None
        rows = [dict(r) for r in st.secrets["holdings"]]
    except Exception:
        return None
    if not rows:
        return None
    return _normalize_holdings(pd.DataFrame(rows))


def load_holdings() -> pd.DataFrame:
    secret_df = _holdings_from_secrets()
    if secret_df is not None:
        return secret_df

    path = HOLDINGS_CSV if os.path.exists(HOLDINGS_CSV) else (
        HOLDINGS_EXAMPLE if os.path.exists(HOLDINGS_EXAMPLE) else None)
    if path is None:
        return pd.DataFrame(columns=HOLDINGS_COLUMNS)
    try:
        df = pd.read_csv(path, dtype={"ticker": str})
    except Exception as exc:
        st.error(f"Could not read {os.path.basename(path)}: {exc}")
        df = pd.DataFrame(columns=HOLDINGS_COLUMNS)
    return _normalize_holdings(df)


def holdings_are_from_secrets() -> bool:
    return _holdings_from_secrets() is not None


def save_holdings(df: pd.DataFrame) -> None:
    """Persist to the local CSV. Note: ephemeral on Streamlit Cloud (use TOML export)."""
    _normalize_holdings(df).to_csv(HOLDINGS_CSV, index=False)


def holdings_to_toml(df: pd.DataFrame) -> str:
    """Render holdings as a secrets.toml block to paste into Streamlit Cloud → Secrets."""
    out = _normalize_holdings(df)
    lines = []
    for _, r in out.iterrows():
        lines.append("[[holdings]]")
        lines.append(f'ticker = "{r["ticker"]}"')
        if pd.notna(r["quantity"]):
            lines.append(f"quantity = {r['quantity']}")
        ac = r["asset_class"]
        lines.append(f'asset_class = "{ac if pd.notna(ac) else "other"}"')
        if pd.notna(r["cost_basis"]):
            lines.append(f"cost_basis = {r['cost_basis']}")
        for col in ("account", "note"):
            val = r[col]
            if pd.notna(val) and str(val) != "":
                lines.append(f'{col} = "{str(val).replace(chr(34), "")}"')
        lines.append("")
    return "\n".join(lines).strip()


# --------------------------------------------------------------------------- #
# Performance snapshots persistence
#
# A snapshot is the total portfolio value (ILS + USD) plus a per-asset-class
# breakdown, stamped with a date. Snapshots accrue over time so the Performance
# tab can plot value-over-time and separate "grew because you deposited" from
# "grew because it returned".
#
# We DELIBERATELY never backfill history: tracking starts the day you first
# press "save snapshot". Same load/normalise/save shape as holdings, same
# secrets support for Streamlit Cloud, same graceful degradation.
# --------------------------------------------------------------------------- #

def _normalize_snapshots(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in SNAPSHOT_CORE_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    # Asset-class breakdown columns are dynamic (ac_equity, ac_bond, ...).
    ac_cols = [c for c in df.columns if str(c).startswith("ac_")]
    df = df[SNAPSHOT_CORE_COLUMNS + ac_cols].copy()
    df["date"] = df["date"].astype(str).str.strip()
    df["total_ils"] = pd.to_numeric(df["total_ils"], errors="coerce")
    df["total_usd"] = pd.to_numeric(df["total_usd"], errors="coerce")
    for c in ac_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df[df["date"].notna() & (df["date"] != "") & (df["date"] != "NAN")]
    # One row per date; last write wins if somehow duplicated.
    df = df.drop_duplicates(subset="date", keep="last")
    return df.sort_values("date").reset_index(drop=True)


def _snapshots_from_secrets() -> pd.DataFrame | None:
    try:
        if "snapshots" not in st.secrets:
            return None
        rows = [dict(r) for r in st.secrets["snapshots"]]
    except Exception:
        return None
    if not rows:
        return None
    return _normalize_snapshots(pd.DataFrame(rows))


def load_snapshots() -> pd.DataFrame:
    secret_df = _snapshots_from_secrets()
    if secret_df is not None:
        return secret_df
    if not os.path.exists(SNAPSHOTS_CSV):
        return pd.DataFrame(columns=SNAPSHOT_CORE_COLUMNS)
    try:
        df = pd.read_csv(SNAPSHOTS_CSV, dtype={"date": str})
    except Exception as exc:
        st.error(f"Could not read {os.path.basename(SNAPSHOTS_CSV)}: {exc}")
        return pd.DataFrame(columns=SNAPSHOT_CORE_COLUMNS)
    return _normalize_snapshots(df)


def save_snapshots(df: pd.DataFrame) -> None:
    """Persist to the local CSV. Ephemeral on Streamlit Cloud (mirror to secrets)."""
    _normalize_snapshots(df).to_csv(SNAPSHOTS_CSV, index=False)


def upsert_snapshot(date_str: str, total_ils: float, total_usd,
                    class_breakdown: dict) -> pd.DataFrame:
    """
    Insert (or overwrite) today's snapshot, then persist. If a row already
    exists for `date_str` it is updated in place rather than duplicated.
    Returns the saved frame.
    """
    df = load_snapshots()
    row = {"date": date_str, "total_ils": total_ils, "total_usd": total_usd}
    for cls, val in class_breakdown.items():
        row[f"ac_{cls}"] = val

    # Rebuild from records (drop any existing row for this date, then add the
    # new one). Avoids pandas' empty/all-NA concat dtype warning when a fresh
    # snapshot lacks an asset class that earlier ones had.
    kept = [r for r in df.to_dict("records") if r.get("date") != date_str] if not df.empty else []
    df = _normalize_snapshots(pd.DataFrame(kept + [row]))
    save_snapshots(df)
    return df


# --------------------------------------------------------------------------- #
# Contributions persistence (deposits you log, to separate return from deposits)
# --------------------------------------------------------------------------- #

def _normalize_contributions(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in CONTRIBUTIONS_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    df = df[CONTRIBUTIONS_COLUMNS].copy()
    df["date"] = df["date"].astype(str).str.strip()
    df["amount_ils"] = pd.to_numeric(df["amount_ils"], errors="coerce")
    df = df[df["date"].notna() & (df["date"] != "") & (df["date"] != "NAN")]
    df = df[df["amount_ils"].notna()]
    return df.sort_values("date").reset_index(drop=True)


def _contributions_from_secrets() -> pd.DataFrame | None:
    try:
        if "contributions" not in st.secrets:
            return None
        rows = [dict(r) for r in st.secrets["contributions"]]
    except Exception:
        return None
    if not rows:
        return None
    return _normalize_contributions(pd.DataFrame(rows))


def load_contributions() -> pd.DataFrame:
    secret_df = _contributions_from_secrets()
    if secret_df is not None:
        return secret_df
    if not os.path.exists(CONTRIBUTIONS_CSV):
        return pd.DataFrame(columns=CONTRIBUTIONS_COLUMNS)
    try:
        df = pd.read_csv(CONTRIBUTIONS_CSV, dtype={"date": str})
    except Exception as exc:
        st.error(f"Could not read {os.path.basename(CONTRIBUTIONS_CSV)}: {exc}")
        return pd.DataFrame(columns=CONTRIBUTIONS_COLUMNS)
    return _normalize_contributions(df)


def contributions_are_from_secrets() -> bool:
    return _contributions_from_secrets() is not None


def save_contributions(df: pd.DataFrame) -> None:
    """Persist to the local CSV. Ephemeral on Streamlit Cloud (use TOML export)."""
    _normalize_contributions(df).to_csv(CONTRIBUTIONS_CSV, index=False)


def contributions_to_toml(df: pd.DataFrame) -> str:
    """Render contributions as a secrets.toml block for Streamlit Cloud persistence."""
    out = _normalize_contributions(df)
    lines = []
    for _, r in out.iterrows():
        lines.append("[[contributions]]")
        lines.append(f'date = "{r["date"]}"')
        lines.append(f"amount_ils = {r['amount_ils']}")
        note = r["note"]
        if pd.notna(note) and str(note) != "":
            lines.append(f'note = "{str(note).replace(chr(34), "")}"')
        lines.append("")
    return "\n".join(lines).strip()


# --------------------------------------------------------------------------- #
# Pricing -> enriched holdings frame
# --------------------------------------------------------------------------- #

@st.cache_data(ttl=600, show_spinner=False)
def _cached_fx():
    return get_fx_rate()


@st.cache_data(ttl=600, show_spinner=False)
def _cached_price(ticker: str):
    return get_price(ticker)


def build_portfolio(holdings: pd.DataFrame, fx):
    """
    Returns (rows_df, warnings). rows_df has one row per holding enriched with
    live price/value in native currency and ILS. Bad/unknown tickers are kept
    with available=False so nothing silently disappears.
    """
    rows = []
    warnings = []

    for _, h in holdings.iterrows():
        ticker = str(h["ticker"]).strip().upper()
        qty = h["quantity"]
        p = _cached_price(ticker)

        row = {
            "ticker": ticker,
            "asset_class": (str(h["asset_class"]).strip().lower()
                            if pd.notna(h["asset_class"]) else "other"),
            "account": h["account"] if pd.notna(h["account"]) else "",
            "quantity": qty,
            "available": p.available,
            "currency": p.currency,
            "price_native": p.price_native,
            "day_change_pct": p.day_change_pct,
            "is_tase": p.is_tase,
            "agorot_adjusted": p.agorot_adjusted,
            "cost_basis": h["cost_basis"] if pd.notna(h["cost_basis"]) else None,
            "note": h["note"] if pd.notna(h["note"]) else "",
            "error": p.error,
        }

        if not p.available:
            warnings.append(f"⚠️ **{ticker}** — {p.error}")
            row["market"] = "TASE" if p.is_tase else ("US" if ticker else "?")
            row["mv_native"] = None
            row["mv_ils"] = None
            row["pl_ils"] = None
            rows.append(row)
            continue

        if pd.isna(qty):
            warnings.append(f"⚠️ **{ticker}** — missing/invalid quantity; excluded from totals.")
            qty = None

        mv_native = (p.price_native * qty) if qty is not None else None
        mv_ils = to_ils(mv_native, p.currency, fx) if mv_native is not None else None
        if mv_native is not None and mv_ils is None:
            warnings.append(f"⚠️ **{ticker}** — could not convert {p.currency} to ILS "
                            f"(FX unavailable); excluded from ILS total.")

        cost_native = (row["cost_basis"] * qty) if (row["cost_basis"] is not None and qty is not None) else None
        cost_ils = to_ils(cost_native, p.currency, fx) if cost_native is not None else None
        pl_ils = (mv_ils - cost_ils) if (mv_ils is not None and cost_ils is not None) else None

        row["market"] = "TASE" if p.is_tase else "US"
        row["mv_native"] = mv_native
        row["mv_ils"] = mv_ils
        row["pl_ils"] = pl_ils
        rows.append(row)

    return pd.DataFrame(rows), warnings


def fmt_money(x, suffix="") -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return "—"
    return f"{x:,.2f}{suffix}"


# --------------------------------------------------------------------------- #
# Gate, then sidebar
# --------------------------------------------------------------------------- #

require_password()

st.sidebar.title("📊 Portfolio Tracker")
st.sidebar.caption("Single-user, local. Values in ILS unless noted.")

if st.sidebar.button("🔄 Refresh prices (clear cache)"):
    clear_cache()
    st.cache_data.clear()
    st.rerun()

conc_threshold = st.sidebar.slider(
    "Concentration flag threshold (% of portfolio)",
    min_value=5, max_value=50, value=20, step=1,
    help="Any single holding above this weight gets flagged.",
)

st.sidebar.markdown("---")
st.sidebar.markdown(
    "**This app will not:**\n\n"
    "1. Predict short-term returns (no single 'expected return' number — ranges only).\n"
    "2. Tell you what to buy or sell.\n\n"
    "Short-horizon prediction is noise; allocation is yours to decide."
)

fx = _cached_fx()
if fx.available:
    st.sidebar.success(f"USD/ILS: {fx.usd_to_ils:.4f}")
else:
    st.sidebar.error(f"USD/ILS unavailable: {fx.error}\nUSD holdings can't be converted to ILS.")


# --------------------------------------------------------------------------- #
# Tabs
# --------------------------------------------------------------------------- #

tab_overview, tab_alloc, tab_perf, tab_proj, tab_contrib, tab_edit = st.tabs(
    ["Overview", "Allocation", "📈 ביצועים", "Projection",
     "Contribution planner", "✏️ Edit holdings"]
)

holdings = load_holdings()
portfolio, warnings = build_portfolio(holdings, fx)

priced = portfolio[portfolio["mv_ils"].notna()].copy() if not portfolio.empty else portfolio
total_ils = priced["mv_ils"].sum() if not priced.empty else 0.0
total_usd = (total_ils / fx.usd_to_ils) if (fx.available and fx.usd_to_ils) else None

# Per-asset-class value (ILS) — reused by snapshots and the Performance tab.
class_breakdown_ils = (
    priced.groupby("asset_class")["mv_ils"].sum().to_dict() if not priced.empty else {}
)

# Human-friendly account label for the "By account" allocation breakdown.
if not priced.empty:
    priced["account_label"] = priced["account"].apply(
        lambda a: str(a).strip() if (pd.notna(a) and str(a).strip() != "") else "(unspecified)"
    )


# ----------------------------- Overview ------------------------------------ #
with tab_overview:
    st.header("Overview")

    if portfolio.empty:
        st.info("No holdings yet. Add some on the **Edit holdings** tab.")
    else:
        # Today's change (ILS), weighted by market value of priced holdings.
        day_delta_ils = 0.0
        have_change = False
        for _, r in priced.iterrows():
            if r["day_change_pct"] is not None and r["mv_ils"] is not None:
                prev_mv = r["mv_ils"] / (1 + r["day_change_pct"] / 100.0)
                day_delta_ils += (r["mv_ils"] - prev_mv)
                have_change = True

        c1, c2, c3 = st.columns(3)
        c1.metric("Total value (ILS)", fmt_money(total_ils, " ₪"))
        c2.metric("Total value (USD)",
                  fmt_money(total_usd, " $") if total_usd is not None else "— (FX down)")
        if have_change:
            pct = (day_delta_ils / (total_ils - day_delta_ils) * 100.0) if (total_ils - day_delta_ils) else 0.0
            c3.metric("Today's change (ILS)", fmt_money(day_delta_ils, " ₪"), f"{pct:+.2f}%")
        else:
            c3.metric("Today's change (ILS)", "—")

        # Daily snapshot capture — feeds the 📈 ביצועים tab.
        snap_col, snap_msg = st.columns([1, 3])
        if snap_col.button("📸 שמור snapshot היום", help="לוכד את שווי התיק הנוכחי לתאריך היום"):
            if priced.empty or not total_ils:
                st.warning("אין שווי מתומחר לשמור עדיין.")
            else:
                today = date.today().isoformat()
                snaps = load_snapshots()
                existed = (not snaps.empty) and (today in snaps["date"].values)
                upsert_snapshot(today, float(total_ils), total_usd, class_breakdown_ils)
                if existed:
                    st.success(f"✅ ה-snapshot של {today} עודכן (לא נוצר כפול).")
                else:
                    st.success(f"✅ נשמר snapshot ל-{today}.")
                st.rerun()
        snap_msg.caption("המעקב מתחיל מהיום שתשמור לראשונה — לא ממציאים היסטוריה. "
                         "נשמר ל-snapshots.csv (מקומי, gitignored).")

        if warnings:
            with st.expander(f"⚠️ {len(warnings)} item(s) need attention", expanded=True):
                for w in warnings:
                    st.markdown(w)

        # Holdings table.
        disp = portfolio.copy()
        disp["% of portfolio"] = disp["mv_ils"].apply(
            lambda v: (v / total_ils * 100.0) if (v is not None and total_ils) else None
        )
        view = pd.DataFrame({
            "Ticker": disp["ticker"],
            "Market": disp["market"],
            "Class": disp["asset_class"],
            "Qty": disp["quantity"],
            "Price (native)": [
                (f"{p:,.2f} {c}" if p is not None else "unavailable")
                for p, c in zip(disp["price_native"], disp["currency"])
            ],
            "Day %": [f"{d:+.2f}%" if d is not None else "—" for d in disp["day_change_pct"]],
            "Value (ILS)": [fmt_money(v) for v in disp["mv_ils"]],
            "% of port": [f"{w:.1f}%" if w is not None else "—" for w in disp["% of portfolio"]],
            "Unrealized P/L (ILS)": [fmt_money(v) for v in disp["pl_ils"]],
            "Agorot adj?": ["yes" if a else "" for a in disp["agorot_adjusted"]],
        })
        st.dataframe(view, use_container_width=True, hide_index=True)
        st.caption("TASE prices are auto-converted from agorot (÷100) to ILS where flagged. "
                   "Eyeball-verify a couple against your broker.")


# ----------------------------- Allocation ---------------------------------- #
with tab_alloc:
    st.header("Allocation")

    if priced.empty:
        st.info("No priced holdings to allocate yet.")
    else:
        def breakdown(group_col, label):
            g = priced.groupby(group_col)["mv_ils"].sum().sort_values(ascending=False)
            out = g.reset_index()
            out.columns = [label, "Value (ILS)"]
            out["Weight %"] = out["Value (ILS)"] / total_ils * 100.0
            out["Value (ILS)"] = out["Value (ILS)"].apply(lambda v: f"{v:,.2f}")
            out["Weight %"] = out["Weight %"].apply(lambda v: f"{v:.1f}%")
            return g, out

        st.subheader("Concentration")
        weights = (priced.groupby("ticker")["mv_ils"].sum() / total_ils * 100.0).sort_values(ascending=False)
        flagged = weights[weights > conc_threshold]
        if len(flagged):
            for tk, w in flagged.items():
                st.warning(f"**{tk}** is **{w:.1f}%** of the portfolio — above your "
                           f"{conc_threshold}% concentration flag.")
        else:
            st.success(f"No single holding exceeds the {conc_threshold}% concentration flag. "
                       f"Largest: {weights.index[0]} at {weights.iloc[0]:.1f}%.")

        col_a, col_b = st.columns(2)
        with col_a:
            st.subheader("By holding")
            g, t = breakdown("ticker", "Holding")
            st.bar_chart(g)
            st.dataframe(t, use_container_width=True, hide_index=True)

            st.subheader("By currency")
            _, t = breakdown("currency", "Currency")
            st.dataframe(t, use_container_width=True, hide_index=True)
        with col_b:
            st.subheader("By asset class")
            g, t = breakdown("asset_class", "Asset class")
            st.bar_chart(g)
            st.dataframe(t, use_container_width=True, hide_index=True)

            st.subheader("By market (TASE vs US)")
            _, t = breakdown("market", "Market")
            st.dataframe(t, use_container_width=True, hide_index=True)

        st.subheader("By account / broker")
        g, t = breakdown("account_label", "Account")
        st.bar_chart(g)
        st.dataframe(t, use_container_width=True, hide_index=True)
        st.caption("Set the **account** field per holding on the Edit tab to split value by broker.")


# ----------------------------- Performance --------------------------------- #
with tab_perf:
    st.header("📈 ביצועים — מעקב שווי לאורך זמן")
    st.caption("התבוננות אחורה על מה שקרה בפועל — **לא תחזית**. הנתונים מגיעים "
               "מ-snapshots ששמרת ב-Overview.")

    snaps = load_snapshots()
    contribs = load_contributions()

    if snaps.empty:
        st.info("עדיין אין snapshots. עבור ל-**Overview** ולחץ **📸 שמור snapshot היום** "
                "כדי להתחיל לצבור נתונים.\n\nהמעקב מתחיל מהיום שתשמור לראשונה — "
                "אנחנו לא ממציאים היסטוריה שלא קיימת.")
    elif len(snaps) < 2:
        only = snaps.iloc[0]
        st.info(f"יש כרגע snapshot אחד בלבד (מ-**{only['date']}**, שווי "
                f"**{float(only['total_ils']):,.0f} ₪**).\n\nצריך לפחות **2** snapshots "
                "כדי לצייר גרף ולחשב מגמה — שמור עוד snapshot ביום אחר וחזור לכאן.")
        st.caption("טיפ: שמור snapshot בערך פעם בשבוע או בחודש כדי לראות מגמה משמעותית.")
    else:
        first = snaps.iloc[0]
        last = snaps.iloc[-1]
        first_val = float(first["total_ils"])
        last_val = float(last["total_ils"])
        abs_change = last_val - first_val
        pct_change = (abs_change / first_val * 100.0) if first_val else 0.0

        st.subheader("שווי התיק לאורך זמן (₪)")
        chart = snaps.set_index("date")[["total_ils"]].rename(columns={"total_ils": "שווי (₪)"})
        st.line_chart(chart)

        c1, c2, c3 = st.columns(3)
        c1.metric("שווי ראשון", f"{first_val:,.0f} ₪", help=f"מ-{first['date']}")
        c2.metric("שווי אחרון", f"{last_val:,.0f} ₪", help=f"מ-{last['date']}")
        c3.metric("שינוי מאז ה-snapshot הראשון", f"{abs_change:,.0f} ₪", f"{pct_change:+.1f}%")

        # ---- Real return vs. deposits (money-weighted, backward-looking) ---- #
        st.subheader("כמה מהגידול הוא תשואה אמיתית — ומה סתם הפקדת?")
        if contribs.empty:
            deposited = 0.0
            st.info("לא רשמת הפקדות. אם הפקדת כסף בתקופה הזו, רשום אותן למטה בפאנל "
                    "**הפקדות** — אחרת כל הגידול מוצג כתשואה (בהנחת אפס הפקדות).")
        else:
            in_window = contribs[(contribs["date"] >= first["date"]) &
                                 (contribs["date"] <= last["date"])]
            deposited = float(in_window["amount_ils"].sum())

        real_return = abs_change - deposited
        d1, d2, d3 = st.columns(3)
        d1.metric("גידול כולל", f"{abs_change:,.0f} ₪")
        d2.metric("מתוכו: הפקדות שלך", f"{deposited:,.0f} ₪")
        d3.metric("מתוכו: תשואה אמיתית", f"{real_return:,.0f} ₪")

        invested_base = first_val + deposited
        real_pct = (real_return / invested_base * 100.0) if invested_base else 0.0
        if deposited:
            st.info(f"בין **{first['date']}** ל-**{last['date']}** התיק גדל ב-"
                    f"**{abs_change:,.0f} ₪**. מתוכם **{deposited:,.0f} ₪** הפקדת בעצמך, "
                    f"ו-**{real_return:,.0f} ₪** הם תשואה אמיתית "
                    f"(~{real_pct:+.1f}% על ההון שהיה מושקע). התבוננות אחורה, לא תחזית.")
        else:
            st.info(f"בין **{first['date']}** ל-**{last['date']}** התיק גדל ב-"
                    f"**{abs_change:,.0f} ₪** (~{pct_change:+.1f}%) — כולו תשואה בהנחת "
                    "אפס הפקדות. התבוננות אחורה, לא תחזית.")

        # ---- Optional: per-asset-class value over time --------------------- #
        ac_cols = [c for c in snaps.columns if str(c).startswith("ac_")]
        if ac_cols:
            with st.expander("פירוט שווי לפי asset class לאורך זמן"):
                ac_chart = snaps.set_index("date")[ac_cols].rename(
                    columns={c: str(c)[3:] for c in ac_cols})
                st.line_chart(ac_chart)

        with st.expander("כל ה-snapshots (טבלה גולמית)"):
            st.dataframe(snaps, use_container_width=True, hide_index=True)

    # ---- Deposits log editor (always available) --------------------------- #
    st.markdown("---")
    st.subheader("💰 הפקדות (contributions)")
    if contributions_are_from_secrets():
        st.info("ההפקדות נטענות מ-**st.secrets**. עריכה כאן **לא** תישמר בענן — ערוך, "
                "ואז השתמש ב-**Copy as secrets TOML** למטה והדבק ל-Settings → Secrets.")
    else:
        st.caption("רשום תאריך + סכום ₪ לכל הפקדה. נשמר ל-**contributions.csv** "
                   "(מקומי, gitignored). זה מה שמאפשר להפריד תשואה אמיתית מהפקדות.")

    edited_contribs = st.data_editor(
        load_contributions(),
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "date": st.column_config.TextColumn(
                "date", required=True, help="תאריך ההפקדה, פורמט YYYY-MM-DD"),
            "amount_ils": st.column_config.NumberColumn(
                "amount_ils", help="סכום ההפקדה בש\"ח", step=100.0),
            "note": st.column_config.TextColumn("note", help="אופציונלי"),
        },
        key="contributions_editor",
    )

    cc1, cc2 = st.columns([1, 4])
    if cc1.button("💾 שמור הפקדות"):
        save_contributions(edited_contribs)
        st.success("ההפקדות נשמרו ל-contributions.csv.")
        st.rerun()
    cc2.caption("שמירה מקומית בלבד — contributions.csv הוא gitignored ואפמרי ב-Streamlit Cloud. "
                "לענן, השתמש בייצוא ה-TOML למטה.")

    with st.expander("📋 Copy as secrets TOML (for Streamlit Cloud persistence)"):
        st.caption("הדבק את זה ב-Streamlit Cloud → **Settings → Secrets**. שורד restart-ים "
                   "ולא נשמר ל-repo.")
        st.code(contributions_to_toml(edited_contribs) or "# (no contributions yet)",
                language="toml")


# ----------------------------- Projection ---------------------------------- #
with tab_proj:
    st.header("Projection — your assumptions, not a forecast")
    st.warning("📌 **Projection of your assumptions — not a forecast.** "
               "These are not predicted returns. They compound the numbers *you* set, "
               "shown as a bear/base/bull range. No single 'expected return' is implied.")

    if priced.empty:
        st.info("No priced holdings to project yet.")
    else:
        classes = sorted(priced["asset_class"].unique())

        st.subheader("Your assumed annual nominal return per asset class")
        st.caption("Placeholders below are neutral long-run anchors — **placeholder, not advice.** "
                   "Change them to whatever you want to assume.")
        assumptions = {}
        cols = st.columns(min(len(classes), 4) or 1)
        for i, cls in enumerate(classes):
            default = DEFAULT_ASSUMPTIONS.get(cls, DEFAULT_ASSUMPTIONS["other"])
            assumptions[cls] = cols[i % len(cols)].number_input(
                f"{cls} (%/yr)", min_value=-20.0, max_value=40.0,
                value=float(default), step=0.5, key=f"assume_{cls}",
            )

        c1, c2 = st.columns(2)
        spread = c1.number_input("Bear/bull spread (± percentage points)",
                                 min_value=0.0, max_value=20.0, value=4.0, step=0.5,
                                 help="Base ± this. Default ±4pp.")
        monthly = c2.number_input("Planned monthly contribution (₪)",
                                  min_value=0.0, value=2000.0, step=100.0)

        st.caption("Contributions are split across asset classes in proportion to your *current* "
                   "class weights, then compounded at each scenario's rate.")

        # Current value per class (ILS) and its share of the contribution.
        class_val = priced.groupby("asset_class")["mv_ils"].sum().to_dict()
        port_val = sum(class_val.values())

        def project(years: int, scenario: str) -> float:
            total = 0.0
            n = years * 12
            for cls, v0 in class_val.items():
                base = assumptions.get(cls, 0.0)
                rate = {"bear": base - spread, "base": base, "bull": base + spread}[scenario] / 100.0
                monthly_rate = (1 + rate) ** (1 / 12) - 1
                # lump sum grows
                fv = v0 * (1 + rate) ** years
                # monthly contribution allocated to this class
                share = (v0 / port_val) if port_val else 0.0
                c = monthly * share
                if abs(monthly_rate) < 1e-9:
                    fv += c * n
                else:
                    fv += c * (((1 + monthly_rate) ** n - 1) / monthly_rate)
                total += fv
            return total

        st.subheader("Projected portfolio value (ILS)")
        proj_rows = []
        for years in (1, 5):
            proj_rows.append({
                "Horizon": f"{years} year" + ("s" if years > 1 else ""),
                "Bear": f"{project(years, 'bear'):,.0f} ₪",
                "Base": f"{project(years, 'base'):,.0f} ₪",
                "Bull": f"{project(years, 'bull'):,.0f} ₪",
            })
        st.dataframe(pd.DataFrame(proj_rows), use_container_width=True, hide_index=True)

        # Visualise the range across horizons.
        chart_df = pd.DataFrame(
            {s: [project(y, s.lower()) for y in range(0, 6)] for s in ("Bear", "Base", "Bull")},
            index=[f"{y}y" for y in range(0, 6)],
        )
        st.line_chart(chart_df)

        st.info("ℹ️ **No 1-month projection is shown.** A one-month horizon is dominated by noise "
                "and is not meaningful as a forecast, so this app omits it on purpose.")


# ------------------------- Contribution planner ---------------------------- #
with tab_contrib:
    st.header("Contribution planner — describe the effect, not a recommendation")
    st.caption("This shows how a contribution shifts your weights and concentration. "
               "It does **not** rank, score, or recommend a choice — you decide.")

    if priced.empty:
        st.info("No priced holdings to plan against yet.")
    else:
        amount = st.number_input("Next contribution (₪)", min_value=0.0, value=2000.0, step=100.0)

        existing = sorted(priced["ticker"].unique().tolist())
        choice = st.selectbox(
            "Allocate the whole contribution to…",
            existing + ["➕ a candidate ticker I'll type"],
        )
        candidate = None
        cand_class = "other"
        if choice == "➕ a candidate ticker I'll type":
            candidate = st.text_input("Candidate ticker (e.g. VTI or ESLT.TA)").strip().upper()
            cand_class = st.selectbox("Its asset class",
                                      sorted(set(list(DEFAULT_ASSUMPTIONS.keys()) + list(priced["asset_class"]))))
            target = candidate
        else:
            target = choice
            cand_class = priced[priced["ticker"] == target]["asset_class"].iloc[0]

        if target:
            # Build "after" weights.
            cur = priced.groupby("ticker")["mv_ils"].sum()
            after = cur.copy()
            after[target] = after.get(target, 0.0) + amount
            new_total = after.sum()

            before_w = (cur / total_ils * 100.0)
            after_w = (after / new_total * 100.0)

            rows = []
            for tk in sorted(set(list(cur.index) + [target])):
                b = before_w.get(tk, 0.0)
                a = after_w.get(tk, 0.0)
                rows.append({
                    "Ticker": tk,
                    "Weight before": f"{b:.1f}%",
                    "Weight after": f"{a:.1f}%",
                    "Δ": f"{a - b:+.1f} pp",
                })
            st.subheader("Effect on holding weights")
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

            # Asset-class effect (the headline "describe the effect" sentence).
            cls_before = priced.groupby("asset_class")["mv_ils"].sum()
            cls_after = cls_before.copy()
            cls_after[cand_class] = cls_after.get(cand_class, 0.0) + amount
            b_cls = cls_before.get(cand_class, 0.0) / total_ils * 100.0
            a_cls = cls_after.get(cand_class, 0.0) / cls_after.sum() * 100.0
            st.info(f"Adding **₪{amount:,.0f}** to **{target}** raises **{cand_class}** weight "
                    f"**{b_cls:.0f}% → {a_cls:.0f}%**.")

            # Concentration effect.
            top_before = before_w.max()
            top_after = after_w.max()
            top_tk_after = after_w.idxmax()
            if top_after > conc_threshold:
                st.warning(f"After this, **{top_tk_after}** would be **{top_after:.1f}%** — "
                           f"above your {conc_threshold}% concentration flag "
                           f"(largest before: {top_before:.1f}%).")
            else:
                st.success(f"After this, the largest holding would be **{top_tk_after}** at "
                           f"**{top_after:.1f}%** — within your {conc_threshold}% flag.")

            st.caption("Effects only. No ranking, no 'best' pick — the decision is yours.")


# ------------------------- Edit holdings ----------------------------------- #
with tab_edit:
    st.header("Edit holdings")
    if holdings_are_from_secrets():
        st.info("Holdings are currently loaded from **st.secrets** (the durable store on "
                "Streamlit Cloud). Editing here will **not** persist on Cloud — make changes, "
                "then use **Copy as secrets TOML** below and paste it into your app's "
                "Settings → Secrets.")
    else:
        st.caption("Edits read/write the local **holdings.csv** (gitignored). Add rows, change "
                   "quantities, set cost_basis (optional). Unknown tickers are flagged on Overview.")

    edited = st.data_editor(
        load_holdings(),
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "ticker": st.column_config.TextColumn("ticker", required=True,
                                                  help="US e.g. VOO, TASE e.g. ESLT.TA"),
            "quantity": st.column_config.NumberColumn("quantity", min_value=0.0),
            "asset_class": st.column_config.SelectboxColumn(
                "asset_class", options=sorted(DEFAULT_ASSUMPTIONS.keys())),
            "cost_basis": st.column_config.NumberColumn(
                "cost_basis", help="Per-unit cost, in the security's own currency. Optional."),
            "account": st.column_config.TextColumn("account"),
            "note": st.column_config.TextColumn("note"),
        },
        key="holdings_editor",
    )

    col1, col2 = st.columns([1, 4])
    if col1.button("💾 Save to holdings.csv & validate"):
        save_holdings(edited)
        st.cache_data.clear()
        # Validate tickers live.
        bad = []
        for tk in edited["ticker"].dropna().astype(str).str.strip().str.upper().unique():
            if tk and not get_price(tk).available:
                bad.append(tk)
        if bad:
            st.warning("Saved, but these tickers did not return a price (typo? delisted? "
                       f"network down?): **{', '.join(bad)}**")
        else:
            st.success("Saved. All tickers returned a price.")
        st.rerun()
    col2.caption("Local save only — holdings.csv is gitignored and ephemeral on Streamlit Cloud. "
                 "For Cloud, use the TOML export below.")

    with st.expander("📋 Copy as secrets TOML (for Streamlit Cloud persistence)"):
        st.caption("Paste this into your app on Streamlit Cloud → **Settings → Secrets**. "
                   "It survives restarts and is never committed to the repo.")
        st.code(holdings_to_toml(edited) or "# (no valid holdings yet)", language="toml")
