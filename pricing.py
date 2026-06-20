"""
Data layer for the portfolio tracker.

Everything that touches the network goes through here. The two public entry
points the rest of the app should use are:

    get_price(ticker)  -> PriceResult   (one security, native currency, ILS-normalised)
    get_fx_rate()      -> FxResult       (live USD/ILS rate)

Design goals:
  * A single failed/unknown ticker must NEVER crash the caller. Failures are
    returned as a PriceResult with available=False and a human-readable error.
  * All fetches are wrapped in try/except and cached on disk for a few minutes
    so we don't hammer yfinance (which is scraping-based and rate-limited).
  * TASE gotcha: yfinance quotes Tel-Aviv stocks in agorot (ILA = 1/100 ILS).
    We detect that and divide by 100, and we surface the fact via
    `agorot_adjusted` so the user can eyeball-verify against their broker.

# TODO: fallback provider (e.g. Stooq, no API key) for when yfinance breaks.
"""

from __future__ import annotations

import json
import math
import os
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Optional

try:
    import yfinance as yf
except Exception:  # pragma: no cover - import guard so the app degrades, not crashes
    yf = None


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".price_cache.json")
CACHE_TTL_SECONDS = 15 * 60  # cache prices for 15 minutes
FX_TICKER = "ILS=X"          # USD/ILS on yfinance (1 USD -> X ILS)


# --------------------------------------------------------------------------- #
# Result types
# --------------------------------------------------------------------------- #

@dataclass
class PriceResult:
    ticker: str
    available: bool
    price_native: Optional[float] = None      # current price in the security's own currency (ILS, not agorot)
    prev_close_native: Optional[float] = None  # previous close, same currency
    currency: Optional[str] = None             # normalised currency code: "ILS" or "USD"
    is_tase: bool = False
    agorot_adjusted: bool = False              # True if we divided a TASE quote by 100
    raw_price: Optional[float] = None          # exactly what the provider returned, pre-adjustment
    raw_currency: Optional[str] = None         # exactly what the provider reported (e.g. "ILA")
    error: Optional[str] = None
    fetched_at: Optional[str] = None           # ISO timestamp
    from_cache: bool = False

    @property
    def day_change_pct(self) -> Optional[float]:
        if self.price_native is None or not self.prev_close_native:
            return None
        return (self.price_native - self.prev_close_native) / self.prev_close_native * 100.0


@dataclass
class FxResult:
    available: bool
    usd_to_ils: Optional[float] = None
    error: Optional[str] = None
    fetched_at: Optional[str] = None
    from_cache: bool = False


# --------------------------------------------------------------------------- #
# On-disk cache (plain JSON, keyed by cache key)
# --------------------------------------------------------------------------- #

def _load_cache() -> dict:
    try:
        with open(CACHE_FILE, "r") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _save_cache(cache: dict) -> None:
    try:
        tmp = CACHE_FILE + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(cache, fh)
        os.replace(tmp, CACHE_FILE)
    except Exception:
        # Caching is a nicety, never fatal.
        pass


def _cache_get(key: str) -> Optional[dict]:
    entry = _load_cache().get(key)
    if not entry:
        return None
    if time.time() - entry.get("_cached_at", 0) > CACHE_TTL_SECONDS:
        return None
    return entry


def _cache_put(key: str, payload: dict) -> None:
    cache = _load_cache()
    payload = dict(payload)
    payload["_cached_at"] = time.time()
    cache[key] = payload
    _save_cache(cache)


def clear_cache() -> None:
    """Force the next fetch to hit the network (used by the UI's Refresh button)."""
    try:
        os.remove(CACHE_FILE)
    except FileNotFoundError:
        pass
    except Exception:
        pass


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _is_tase(ticker: str) -> bool:
    return ticker.strip().upper().endswith(".TA")


def _finite(x) -> Optional[float]:
    """Return a clean float or None (yfinance loves to hand back nan)."""
    try:
        f = float(x)
        if math.isnan(f) or math.isinf(f) or f <= 0:
            return None
        return f
    except (TypeError, ValueError):
        return None


def _raw_quote(ticker: str):
    """
    Pull (last_price, prev_close, reported_currency) from yfinance using the
    cheapest reliable path, falling back to a short history pull.

    Returns a tuple (price, prev_close, currency) with Nones where unknown.
    Raises only if yfinance itself blows up in a way we want surfaced.
    """
    t = yf.Ticker(ticker)

    price = prev = None
    currency = None

    # fast_info is the lightweight path (no full .info scrape).
    try:
        fi = t.fast_info
        price = _finite(fi.get("last_price") if hasattr(fi, "get") else getattr(fi, "last_price", None))
        prev = _finite(fi.get("previous_close") if hasattr(fi, "get") else getattr(fi, "previous_close", None))
        currency = (fi.get("currency") if hasattr(fi, "get") else getattr(fi, "currency", None))
    except Exception:
        pass

    # Fallback: 2 days of history gives us last + previous close.
    if price is None or prev is None:
        try:
            hist = t.history(period="5d")
            closes = [c for c in hist["Close"].tolist() if _finite(c)]
            if closes:
                if price is None:
                    price = _finite(closes[-1])
                if prev is None and len(closes) >= 2:
                    prev = _finite(closes[-2])
        except Exception:
            pass

    # Last resort for currency: the (slower, flakier) .info dict.
    if not currency:
        try:
            currency = t.info.get("currency")
        except Exception:
            currency = None

    return price, prev, currency


# --------------------------------------------------------------------------- #
# Public: prices
# --------------------------------------------------------------------------- #

def get_price(ticker: str, use_cache: bool = True) -> PriceResult:
    """
    Fetch a single security's price, normalised to its real currency (ILS, not
    agorot, for TASE) and tagged with everything the UI needs. Never raises.
    """
    ticker = (ticker or "").strip().upper()
    is_tase = _is_tase(ticker)

    if not ticker:
        return PriceResult(ticker=ticker, available=False, error="Empty ticker", is_tase=is_tase)

    if yf is None:
        return PriceResult(ticker=ticker, available=False, is_tase=is_tase,
                           error="yfinance not installed")

    cache_key = f"price::{ticker}"
    if use_cache:
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = {k: v for k, v in cached.items() if k != "_cached_at"}
            return PriceResult(**cached, from_cache=True)

    try:
        raw_price, raw_prev, raw_currency = _raw_quote(ticker)
    except Exception as exc:  # network / parse / yfinance internals
        return PriceResult(ticker=ticker, available=False, is_tase=is_tase,
                           error=f"fetch failed: {exc}", fetched_at=_now_iso())

    if raw_price is None:
        return PriceResult(ticker=ticker, available=False, is_tase=is_tase,
                           raw_currency=raw_currency, error="price unavailable (unknown ticker?)",
                           fetched_at=_now_iso())

    # ----- Agorot / currency normalisation ------------------------------- #
    # yfinance quotes Tel-Aviv stocks in agorot (ILA = 1/100 ILS). It usually
    # reports currency "ILA", but sometimes leaves it blank. We treat a TASE
    # quote as agorot unless it is explicitly tagged "ILS", and divide by 100.
    reported = (raw_currency or "").upper()
    price_native = raw_price
    prev_native = raw_prev

    if is_tase:
        currency = "ILS"
        agorot_adjusted = reported != "ILS"  # default-assume agorot for TASE
        if agorot_adjusted:
            price_native = raw_price / 100.0
            prev_native = (raw_prev / 100.0) if raw_prev is not None else None
    else:
        currency = reported or "USD"
        agorot_adjusted = False

    result = PriceResult(
        ticker=ticker,
        available=True,
        price_native=price_native,
        prev_close_native=prev_native,
        currency=currency,
        is_tase=is_tase,
        agorot_adjusted=agorot_adjusted,
        raw_price=raw_price,
        raw_currency=raw_currency,
        error=None,
        fetched_at=_now_iso(),
    )

    if use_cache:
        _cache_put(cache_key, asdict(result))

    return result


# --------------------------------------------------------------------------- #
# Public: FX
# --------------------------------------------------------------------------- #

def get_fx_rate(use_cache: bool = True) -> FxResult:
    """Live USD->ILS rate (how many shekels one dollar buys). Never raises."""
    if yf is None:
        return FxResult(available=False, error="yfinance not installed")

    cache_key = f"fx::{FX_TICKER}"
    if use_cache:
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = {k: v for k, v in cached.items() if k != "_cached_at"}
            return FxResult(**cached, from_cache=True)

    try:
        price, _prev, _cur = _raw_quote(FX_TICKER)
    except Exception as exc:
        return FxResult(available=False, error=f"fx fetch failed: {exc}", fetched_at=_now_iso())

    if price is None:
        return FxResult(available=False, error="fx rate unavailable", fetched_at=_now_iso())

    result = FxResult(available=True, usd_to_ils=price, fetched_at=_now_iso())
    if use_cache:
        _cache_put(cache_key, asdict(result))
    return result


def to_ils(amount: float, currency: str, fx: FxResult) -> Optional[float]:
    """Convert an amount in `currency` to ILS using the given FX result."""
    if amount is None:
        return None
    cur = (currency or "").upper()
    if cur == "ILS":
        return amount
    if cur == "USD":
        if fx and fx.available and fx.usd_to_ils:
            return amount * fx.usd_to_ils
        return None
    # Unknown currency: cannot convert safely.
    return None
