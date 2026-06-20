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

import pandas as pd
import streamlit as st

from pricing import get_price, get_fx_rate, to_ils, clear_cache

HOLDINGS_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "holdings.csv")
HOLDINGS_COLUMNS = ["ticker", "quantity", "asset_class", "cost_basis", "account", "note"]

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
# Holdings persistence
# --------------------------------------------------------------------------- #

def load_holdings() -> pd.DataFrame:
    if os.path.exists(HOLDINGS_CSV):
        try:
            df = pd.read_csv(HOLDINGS_CSV, dtype={"ticker": str})
        except Exception as exc:
            st.error(f"Could not read holdings.csv: {exc}")
            df = pd.DataFrame(columns=HOLDINGS_COLUMNS)
    else:
        df = pd.DataFrame(columns=HOLDINGS_COLUMNS)

    # Ensure all expected columns exist.
    for col in HOLDINGS_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    df = df[HOLDINGS_COLUMNS]
    df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["cost_basis"] = pd.to_numeric(df["cost_basis"], errors="coerce")
    df = df[df["ticker"].notna() & (df["ticker"] != "") & (df["ticker"] != "NAN")]
    return df.reset_index(drop=True)


def save_holdings(df: pd.DataFrame) -> None:
    out = df.copy()
    out["ticker"] = out["ticker"].astype(str).str.strip().str.upper()
    out = out[out["ticker"].notna() & (out["ticker"] != "") & (out["ticker"] != "NAN")]
    out = out[HOLDINGS_COLUMNS]
    out.to_csv(HOLDINGS_CSV, index=False)


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
# Sidebar
# --------------------------------------------------------------------------- #

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

tab_overview, tab_alloc, tab_proj, tab_contrib, tab_edit = st.tabs(
    ["Overview", "Allocation", "Projection", "Contribution planner", "✏️ Edit holdings"]
)

holdings = load_holdings()
portfolio, warnings = build_portfolio(holdings, fx)

priced = portfolio[portfolio["mv_ils"].notna()].copy() if not portfolio.empty else portfolio
total_ils = priced["mv_ils"].sum() if not priced.empty else 0.0
total_usd = (total_ils / fx.usd_to_ils) if (fx.available and fx.usd_to_ils) else None


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
    st.caption("Edits read/write **holdings.csv**. Add rows, change quantities, set cost_basis "
               "(optional). Unknown tickers are flagged on the Overview tab.")

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
    if col1.button("💾 Save & validate"):
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
    col2.caption("Tip: hit Save, then check the Overview tab. Bad symbols never crash the app — "
                 "they're listed under 'need attention'.")
