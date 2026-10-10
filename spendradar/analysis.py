"""Deterministic maths: competitor signals, people-cost estimates, policy comparison.

The LLM never computes anything that reaches the report; everything numeric is here.
"""

from __future__ import annotations

import statistics
from datetime import date, datetime

from spendradar.models import CompetitorProfile, CompetitorSignal, Source

# Crustdata role / function names → our categories. ml_ai is derived (no ML role exists).
ROLE_MAP = {"engineering": ["Engineering"], "sales": ["Sales", "Business Development"], "marketing": ["Marketing"]}


def _src(domain: str, fetched_at: str, locator: str, note: str = "") -> Source:
    return Source(kind="crustdata", ref=f"/company/enrich?domain={domain}", locator=locator,
                  fetched_at=fetched_at, note=note)


def profile_from_enrich(name: str, domain: str, cd: dict, fetched_at: str) -> CompetitorProfile:
    hc = cd.get("headcount") or {}
    prof = CompetitorProfile(name=name, domain=domain, total_headcount=hc.get("total"),
                             total_as_of=fetched_at[:10], funding={
                                 k: (cd.get("funding") or {}).get(k) for k in
                                 ("total_investment_usd", "last_round_type", "last_round_amount_usd",
                                  "last_fundraise_date")})
    roles = hc.get("by_role_absolute") or {}
    funcs = (hc.get("by_function_timeseries") or {}).get("CURRENT_FUNCTION") or {}
    for cat, names in ROLE_MAP.items():
        present = [n for n in names if n in roles]
        if present:
            prof.signals.append(CompetitorSignal(
                name="role_headcount", category=cat, headcount=float(sum(roles[n] for n in present)),
                as_of=fetched_at[:10],
                source=_src(domain, fetched_at, "headcount.by_role_absolute." + "+".join(present))))
        series = [funcs[n] for n in names if funcs.get(n)]
        if series:
            last_date = max(s[-1]["date"][:10] for s in series)
            value = sum(s[-1]["employee_count"] for s in series)
            prof.signals.append(CompetitorSignal(
                name="function_timeseries", category=cat, headcount=float(value), as_of=last_date,
                source=_src(domain, fetched_at, "headcount.by_function_timeseries.CURRENT_FUNCTION." + "+".join(
                    n for n in names if funcs.get(n)) + f"[{last_date}]")))
        if not present and not series:
            prof.missing.append(f"{cat}: no role or function headcount")
    if not (cd.get("hiring") or {}).get("recent_titles_csv"):
        prof.missing.append("hiring: no recent job titles")
    prof.news = [{"date": n.get("article_publish_date"), "title": n.get("article_title"), "url": n.get("article_url")}
                 for n in (cd.get("news") or [])[:25]]
    return prof


def recent_titles(cd: dict) -> list[str]:
    csv = ((cd.get("hiring") or {}).get("recent_titles_csv") or "")
    return [t.strip() for t in csv.split(",") if t.strip()]


def ml_share(titles: list[str], classes: dict[str, dict]) -> tuple[float, int, int] | None:
    """Share of engineering-ish titles classified ml_ai. Returns (share, ml, eng_total)."""
    labelled = [classes[t]["category"] for t in titles if t in classes]
    eng_like = [c for c in labelled if c in ("engineering", "ml_ai")]
    if len(eng_like) < 3:
        return None
    ml = sum(1 for c in eng_like if c == "ml_ai")
    return ml / len(eng_like), ml, len(eng_like)


def add_ml_signals(prof: CompetitorProfile, samples: dict[str, tuple[list[str], Source]],
                   classes: dict[str, dict]) -> None:
    """ml_ai headcount = engineering role headcount × ML share of an independent title sample."""
    eng = next((s for s in prof.signals if s.category == "engineering" and s.name == "role_headcount"), None)
    if not eng:
        prof.missing.append("ml_ai: no engineering headcount to scale")
        return
    for sample_name, (titles, src) in samples.items():
        r = ml_share(titles, classes)
        if r is None:
            prof.missing.append(f"ml_ai: too few classified titles in {sample_name}")
            continue
        share, ml, n = r
        prof.signals.append(CompetitorSignal(
            name=f"ml_share_{sample_name}", category="ml_ai", headcount=round(eng.headcount * share, 1),
            as_of=src.fetched_at[:10],
            source=Source(kind="derived", ref=src.ref, locator=src.locator,
                          fetched_at=src.fetched_at,
                          note=f"{ml}/{n} engineering titles classified ml_ai × engineering headcount {eng.headcount:.0f}")))


def category_range(prof: CompetitorProfile, cat: str) -> tuple[float, float, int] | None:
    vals = [s.headcount for s in prof.signals if s.category == cat]
    if not vals:
        return None
    return min(vals), max(vals), len(vals)


def signal_agreement(prof: CompetitorProfile, cat: str) -> float | None:
    """1.0 = signals agree exactly; low/high ratio otherwise. None if < 2 signals."""
    r = category_range(prof, cat)
    if not r or r[2] < 2 or r[1] == 0:
        return None
    return r[0] / r[1]


def days_old(as_of: str, today: date | None = None) -> int:
    d = datetime.fromisoformat(as_of[:10]).date()
    return ((today or date.today()) - d).days


def our_position(budget: dict) -> dict:
    """budget = {'headcount_end': {cat: n}, 'people_cost': {cat: usd}} from the verified spreadsheet."""
    total = sum(budget["headcount_end"].values())
    return {cat: {"headcount": hc, "share": hc / total, "people_cost": budget["people_cost"].get(cat)}
            for cat, hc in budget["headcount_end"].items()} | {"_total": total}


def competitor_shares(profiles: list[CompetitorProfile], cat: str) -> list[dict]:
    out = []
    for p in profiles:
        r = category_range(p, cat)
        if not r or not p.total_headcount:
            continue
        out.append({"name": p.name, "low": r[0] / p.total_headcount, "high": r[1] / p.total_headcount,
                    "signals": r[2]})
    return out


def compare(ours: dict, shares: list[dict], rule: dict, loaded_cost: float) -> dict:
    """Policy check on share of headcount vs competitor median, plus gap in heads and USD (estimate)."""
    if not shares:
        return {"status": "no_data"}
    med_low = statistics.median(s["low"] for s in shares)
    med_high = statistics.median(s["high"] for s in shares)
    mid = (med_low + med_high) / 2
    our_share = ours["share"]
    pct = rule["pct"] / 100
    if rule["rule"] == "within_pct_of_median":
        violated = abs(our_share - mid) > pct * mid
    elif rule["rule"] == "at_least_pct_of_median":
        violated = our_share < pct * mid
    else:
        raise ValueError(f"unknown rule {rule['rule']}")
    total = ours["_total"]
    gap_heads_low, gap_heads_high = med_low * total - ours["headcount"], med_high * total - ours["headcount"]
    return {"status": "ok", "our_share": our_share, "median_low": med_low, "median_high": med_high,
            "median_mid": mid, "violated": violated, "n_competitors": len(shares),
            "gap_heads": (gap_heads_low, gap_heads_high),
            "gap_usd": (gap_heads_low * loaded_cost, gap_heads_high * loaded_cost)}
