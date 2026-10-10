"""Self-audit: try to disprove every finding before it reaches the report.

Per finding:
  1. recompute   — rerun the deterministic comparison from stored state; numbers must match
  2. sources     — every figure the finding uses must exist and carry a source
  3. contradict  — look for evidence against it (signal disagreement, layoff/freeze news for a
                   competitor in the median, vendor billed to two categories) and let the LLM judge
  4. second opinion — an independent OpenRouter :free model re-judges findings Gemini marked
                   downgrade/overturn (advisory, max N per run)
Findings that fail are downgraded or overturned and listed with both sides of the evidence.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Literal

import neatlogs
from pydantic import BaseModel

from spendradar import analysis, llm
from spendradar.models import Finding, RunState

NEWS_WORDS = ("layoff", "lay off", "laid off", "job cuts", "cuts jobs", "restructur", "hiring freeze",
              "downsiz", "reduction in force", "acquired by", "acquisition of")
NEWS_WINDOW_DAYS = 180


class Verdict(BaseModel):
    verdict: Literal["confirm", "downgrade", "overturn"]
    reason: str
    corrected_category: Literal["engineering", "ml_ai", "sales", "marketing", "infra_cloud", "none"] = "none"


def _recent_negative_news(state: RunState) -> list[dict]:
    hits = []
    for p in state.competitors.values():
        for n in p.news:
            title = (n.get("title") or "").lower()
            try:
                age = (date.today() - datetime.fromisoformat(n["date"][:10]).date()).days
            except Exception:
                continue
            if age <= NEWS_WINDOW_DAYS and any(w in title for w in NEWS_WORDS):
                hits.append({"company": p.name, **n})
    return hits


def _recompute_ok(state: RunState, f: Finding) -> tuple[bool, str]:
    if f.kind != "policy":
        return True, "internal finding: deterministic"
    rule = next((r for r in state.policy.get("rules", []) if r["category"] == f.category), None)
    ours = analysis.our_position(state.budget)
    res = analysis.compare({**ours[f.category], "_total": ours["_total"]},
                           analysis.competitor_shares(list(state.competitors.values()), f.category),
                           rule, state.salary.get(f.category, 0))
    ok = (res.get("status") == "ok" and abs(res["median_low"] - (f.theirs_low or 0)) < 1e-9
          and abs(res["median_high"] - (f.theirs_high or 0)) < 1e-9 and res["violated"] == f.policy_violated)
    return ok, "recomputed and matched" if ok else f"recompute mismatch: {res}"


def _sources_ok(state: RunState, f: Finding) -> tuple[bool, str]:
    missing = [fid for fid in f.figure_ids if fid not in state.figures or not state.figures[fid].sources]
    return not missing, "all figures sourced" if not missing else f"unsourced figures: {missing}"


def _evidence_against(state: RunState, f: Finding, news: list[dict]) -> list[str]:
    ev = []
    if f.kind == "policy":
        for p in state.competitors.values():
            r = analysis.category_range(p, f.category)
            if not r:
                continue
            sigs = [s for s in p.signals if s.category == f.category]
            ag = analysis.signal_agreement(p, f.category)
            if ag is not None and ag < 0.6:
                ev.append(f"{p.name} {f.category} signals disagree: " + "; ".join(
                    f"{s.name}={s.headcount:.0f} (as of {s.as_of})" for s in sigs))
        for n in news:
            ev.append(f"news {n['date']} {n['company']}: {n['title']} ({n['url']})")
    if "mis-categorised" in f.statement:
        vendor = f.statement.split(":")[0]
        for inv in state.invoices:
            if inv["vendor"] == vendor:
                ev.append(f"{inv['number']} cost centre '{inv['cost_centre']}' → {inv['category']}; lines: "
                          + "; ".join(line['description'] for line in inv["lines"]))
    return ev


def _judge(role: str, f: Finding, evidence: list[str], checks: list[str],
           exclude: tuple[str, ...] = ()) -> tuple[Verdict, llm.LLMResult]:
    prompt = (f"FINDING ({f.category}, confidence {f.confidence}):\n{f.statement}\n\n"
              f"DETERMINISTIC CHECKS:\n" + "\n".join(f"- {c}" for c in checks)
              + "\n\nEVIDENCE THAT MIGHT CONTRADICT IT:\n" + ("\n".join(f"- {e}" for e in evidence) or "- none found")
              + "\n\nTry to disprove the finding. 'overturn' = the evidence shows it is wrong or unsupported; "
                "'downgrade' = it may hold but the evidence weakens it materially; 'confirm' = it survives. "
                "For a mis-categorised invoice, set corrected_category to the category its line items belong to. "
                "Judge only from the evidence given; do not invent facts.")
    res = llm.complete(role, prompt, schema=Verdict, exclude=exclude,
                       system="You are a sceptical finance auditor checking an analyst's findings.")
    return res.parsed, res


def self_audit(state: RunState) -> None:
    news = _recent_negative_news(state)
    second_left = llm.CONFIG["second_opinion_max_per_run"]
    for f in state.findings:
        with neatlogs.trace(f"audit:{f.id}", kind="AGENT") as span:
            rc_ok, rc = _recompute_ok(state, f)
            src_ok, src = _sources_ok(state, f)
            evidence = _evidence_against(state, f, news)
            checks = [rc, src]
            span.set_attribute("spendradar.audit.evidence", json.dumps(evidence)[:2000])
            if not rc_ok or not src_ok:
                f.status, f.audit_notes = "overturned", [rc, src]
                span.set_attribute("spendradar.audit.verdict", "overturned (deterministic)")
                continue
            if not evidence and f.kind == "internal" and "mis-categorised" not in f.statement:
                f.status = "confirmed"
                f.audit_notes.append("deterministic internal finding; no contradicting evidence")
                span.set_attribute("spendradar.audit.verdict", "confirmed (deterministic)")
                continue
            try:
                v, res = _judge("reason", f, evidence, checks)
                _usage_add(state, res)
            except llm.LLMError as e:
                f.status = "downgraded"
                f.audit_notes.append(f"audit LLM unavailable ({str(e)[:80]}); downgraded to be safe")
                continue
            f.audit_notes.append(f"{res.model}: {v.verdict} — {v.reason}")
            final = v.verdict
            if v.verdict != "confirm" and second_left > 0:
                second_left -= 1
                try:
                    # Independent means a different model from the verdict being checked.
                    v2, res2 = _judge("second_opinion", f, evidence, checks, exclude=(res.model,))
                    _usage_add(state, res2)
                    f.audit_notes.append(f"second opinion {res2.model}: {v2.verdict} — {v2.reason}")
                    span.set_attribute("spendradar.audit.second_opinion", v2.verdict)
                    if v2.verdict == "confirm" and v.verdict == "overturn":
                        final = "downgrade"  # disagreement between providers → soften, never silently confirm
                except llm.LLMError as e:
                    f.audit_notes.append(f"second opinion unavailable: {str(e)[:80]}")
            f.status = {"confirm": "confirmed", "downgrade": "downgraded", "overturn": "overturned"}[final]
            if final != "confirm":
                f.confidence = round(f.confidence * (0.5 if final == "downgrade" else 0.0), 3)
            if "mis-categorised" in f.statement and v.corrected_category != "none":
                f.audit_notes.append(f"corrected category: {v.corrected_category}")
                f.status = "confirmed"  # the flag itself is confirmed; the correction is applied in the report
                f.confidence = 1.0 if v.verdict != "overturn" else f.confidence
            span.set_attribute("spendradar.audit.verdict", f.status)


def _usage_add(state: RunState, res: llm.LLMResult) -> None:
    from spendradar.agent import _usage

    _usage(state, res)
