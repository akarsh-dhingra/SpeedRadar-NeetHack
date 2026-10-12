"""Deterministic checks and the computed confidence score.

confidence = checks × signals × freshness, each in [0, 1]:
  checks    = passed / total checks attached to the finding's inputs
  signals   = min(1, n_signals / 2) × agreement        (agreement = low/high of the signals; 1 if internal)
  freshness = 1.0 if the oldest input is ≤ 90 days old, falling linearly to 0.5 at 365 days (floor 0.5)
Nothing here is typed in by hand; every input comes from RunState.
"""

from __future__ import annotations

from spendradar.models import Check

TOLERANCE = 0.01  # line items must sum to the stated total within 1%


def totals_check(target: str, parts: list[float], stated: float) -> Check:
    s = sum(parts)
    diff = abs(s - stated) / abs(stated) if stated else (0 if s == 0 else 1)  # abs: credit notes are negative
    return Check(name="verify:totals", target=target, passed=diff <= TOLERANCE,
                 detail=f"line items sum {s:,.2f} vs stated {stated:,.2f} ({diff:.2%} off)")


def invoice_totals_check(target: str, parts: list[float], stated: float, commission: float | None = None,
                         net: float | None = None) -> Check:
    """Line items vs the totals PRINTED on the invoice. Agency-billed invoices (real FCC broadcast invoices,
    case study 07) often print line items net of commission and other deductions, so the items are consistent
    if they sum to the stated gross total OR to the printed net amount due (when net <= gross), within
    TOLERANCE. Gross - commission need not equal net: 9 of 24 verified FCC invoices deduct more than the
    commission. All arithmetic here, none by the LLM. Without a printed net (every fictional company), this is
    exactly totals_check."""
    chk = totals_check(target, parts, stated)
    if chk.passed or not net or abs(net) > abs(stated):
        return chk
    s = sum(parts)
    if abs(s - net) <= TOLERANCE * abs(net):
        extra = f", agency commission {commission:,.2f}" if commission is not None else ""
        return Check(name="verify:totals", target=target, passed=True,
                     detail=f"line items sum {s:,.2f} = printed net amount due {net:,.2f} (gross {stated:,.2f}{extra})")
    return chk


def freshness(days: int) -> float:
    if days <= 90:
        return 1.0
    return max(0.5, 1.0 - 0.5 * (days - 90) / (365 - 90))


def confidence(checks_passed: int, checks_total: int, n_signals: int, agreement: float | None,
               oldest_days: int) -> tuple[float, dict]:
    c = checks_passed / checks_total if checks_total else 1.0
    s = min(1.0, n_signals / 2) * (agreement if agreement is not None else (1.0 if n_signals == 0 else 0.5))
    f = freshness(oldest_days)
    inputs = {"checks": f"{checks_passed}/{checks_total}", "checks_score": round(c, 3), "n_signals": n_signals,
              "agreement": None if agreement is None else round(agreement, 3), "signals_score": round(s, 3),
              "oldest_input_days": oldest_days, "freshness_score": round(f, 3)}
    return round(c * s * f, 3), inputs
