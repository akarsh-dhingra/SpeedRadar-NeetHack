"""Export every scored run as one JSON file for a front end: evidence/frontend_data.json.

`python -m spendradar export` reads evidence/evals/*.json (committed scorecards) and, when present,
runs/<id>/state.json (local), and writes a stable structure documented in docs/frontend-data.md.
Every value is copied from a scorecard, a run's state or a ground-truth file; nothing is computed here
except counts. Bump SCHEMA_VERSION when a field changes meaning.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

SCHEMA_VERSION = 1
EVALS = Path("evidence/evals")
OUT = Path("evidence/frontend_data.json")
SITE_DATA = Path("site/data.js")  # the same object for the static site, loadable from file:// without a server

# Before/after pairs as the case studies name them. Curated, not inferred: run ids and titles are copied
# from evidence/case-studies/*.md, so the site never guesses which run "fixed" which.
COMPARISONS = [
    {"title": "The audit ignored its own line-item check", "company": "acme",
     "before": ["1011-4f1f02", "1010-c2cd0c"], "after": ["1011-777bb7", "1011-5eb1a9", "1011-ac4bf5"],
     "case_study": "evidence/case-studies/04-held-out-companies.md",
     "note": "Before: 1 of 2 complete runs caught the mis-categorised invoice. After: 3 of 3."},
    {"title": "A re-sent invoice went unnoticed", "company": "kestrel",
     "before": ["1010-f3a894"], "after": ["1010-d514dc"],
     "case_study": "evidence/case-studies/04-held-out-companies.md", "note": "n = 1 per side."},
    {"title": "A re-sent invoice went unnoticed", "company": "ledgerly",
     "before": ["1010-dd2fc1"], "after": ["1010-d94102"],
     "case_study": "evidence/case-studies/04-held-out-companies.md", "note": "n = 1 per side."},
    {"title": "A one-off vendor's invoice billed to the wrong team", "company": "carebridge",
     "before": ["1010-a49f44"], "after": ["1010-da4413"],
     "case_study": "evidence/case-studies/04-held-out-companies.md",
     "note": "n = 1 per side; the after run had 1 fallback hop, so it is not a clean comparison."},
    {"title": "Windows paths hid two skipped invoices", "company": "bastion",
     "before": ["1011-ae5e18"], "after": ["1011-f679dc", "1011-257f61"],
     "case_study": "evidence/case-studies/04-held-out-companies.md",
     "note": "In both after runs the planner happened to include every file; the fix is covered by a unit test."},
    {"title": "One weak signal threw away 3 of 5 peers", "company": "acme",
     "before": ["1010-b31657"], "after": ["1010-7bf26d"],
     "case_study": "evidence/case-studies/02-competitor-substitution.md", "note": "n = 1 per side."},
]

# Headline figures from the cfo.ai plan, copied from business/cfoai_plan.md ("Results" and "Fixing the
# Team tier"). The plan itself is the source; these are here so the site can show them without parsing it.
BUSINESS_HEADLINES = {
    "source": "business/cfoai_plan.md",
    "scenarios": [
        {"name": "Base", "first_positive_month": "Jan 2028 (month 15)", "lowest_cash": "$7,149",
         "revenue_month_24": "$7,950", "gross_margin_month_24": "57.7%", "cash_month_24": "$20,739"},
        {"name": "Growth", "first_positive_month": "Jun 2027 (month 8)", "lowest_cash": "$14,615",
         "revenue_month_24": "$19,875", "gross_margin_month_24": "71.4%", "cash_month_24": "$115,486"},
    ],
    "tiers": [{"name": "Starter", "price": "$99", "runs": "8 runs", "margin_base_50pct_cached": "62.4%",
               "margin_base_uncached": "25.1%"},
              {"name": "Team", "price": "$399", "runs": "40 runs", "margin_base_50pct_cached": "53.5%",
               "margin_base_uncached": "7.1%", "margin_with_cap": "76.6%"}],
    "llm_cost_per_run": "$0.0285", "crustdata_cost_per_uncached_run": "$6.24–$9.24",
    "finding": "Competitor data is about 99% of the cost of a run, so caching it decides the margin. "
               "Capping fresh competitor-data runs at 10 a month lifts Team to 76.6% without a price change.",
}

FEATURED = {"company": "acme", "run_id": "1011-777bb7", "finding_id": "f_ml_ai"}

LABELS = {
    "budget_total_mismatch": "Budget row total does not equal the sum of its months",
    "invoice_total_mismatch": "Invoice line items do not add up to the stated total",
    "invoice_miscategorised": "Invoice billed to the wrong cost centre",
    "invoice_miscategorised_single_vendor": "Invoice billed to the wrong cost centre (vendor appears once)",
    "invoice_scanned": "Scanned invoice with no text layer",
    "invoice_corrupt": "Corrupt or empty PDF",
    "invoice_duplicate": "Same invoice sent twice",
    "fixture_sentry_marketing_x5": "Eval fixture: a competitor's headcount altered ×5",
}


IST = timezone(timedelta(hours=5, minutes=30))  # scorecards' "created" is local time on the build laptops


def _utc(stamp: str, assume: timezone = timezone.utc) -> datetime:
    t = datetime.fromisoformat(stamp)
    return (t if t.tzinfo else t.replace(tzinfo=assume)).astimezone(timezone.utc)


def _company(dataset: str) -> dict:
    truth = Path("evals/ground_truth.json" if dataset == "acme" else f"evals/ground_truth_{dataset}.json")
    t = json.loads(truth.read_text(encoding="utf-8")) if truth.exists() else {}
    comps_path = Path(f"data/{dataset}/competitors.yaml")
    comps = yaml.safe_load(comps_path.read_text(encoding="utf-8")) if comps_path.exists() else {}
    return {
        "key": dataset,
        "name": t.get("company", "Acme Observability Inc." if dataset == "acme" else dataset),
        "industry": t.get("industry", "observability SaaS" if dataset == "acme" else ""),
        "role": "development" if dataset == "acme" else "held_out",
        "fictional": True,
        "competitors": [{"name": c["name"], "domain": c["domain"]} for c in comps.get("competitors", [])],
        "negative_controls": [p["id"] for p in t.get("planted_errors", []) if p and p["type"] == "negative_control"],
        "runs": [],
    }


def _run(r: dict, card: dict, path: Path) -> dict:
    st_path = Path(f"runs/{r['run_id']}/state.json")
    st = json.loads(st_path.read_text(encoding="utf-8")) if st_path.exists() else None
    out = {
        "run_id": r["run_id"], "variant": card.get("variant", ""), "scored_at": card.get("created", ""),
        "started_at": st.get("started_at") if st else None,
        "phase": r.get("phase", "done"),  # anything but "done" = the run stopped early
        "exit_code": r.get("exit_code"),
        "git_sha": r["git_sha"], "neatlogs_trace_id": r["trace_id"], "scorecard": path.as_posix(),
        "data_mode": r.get("data_mode", "real"), "injected_faults": r.get("injected", []),
        "metrics": {
            "planted_caught": r["planted_caught"], "planted_total": r["planted_total"],
            "false_alarms": r.get("false_alarms"),  # null on scorecards written before false alarms were counted
            "unsupported_numbers_in_report": r["unsupported_numbers_in_report"],
            "findings_overturned": r["overturned"], "findings_downgraded": r["downgraded"],
            "recovery_decisions": r["recovery_decisions"], "recovery_non_default": r["recovery_non_default"],
            "llm_calls": r["llm_calls"], "llm_tokens_in": r["llm_tokens_in"], "llm_tokens_out": r["llm_tokens_out"],
            "llm_latency_s": r["llm_latency_s"], "fallback_hops": r.get("fallback_hops", 0),
            "crustdata_credits": round(r["crustdata_credits"], 2), "models": r.get("provider_mix", []),
        },
        "planted": [{"id": k, "label": LABELS.get(k, k), "caught": v} for k, v in r["planted_detail"].items()],
        "false_alarm_detail": r.get("false_alarm_detail", []),
        "report": {"markdown": f"runs/{r['run_id']}/report.md", "html": f"runs/{r['run_id']}/report.html",
                   "available_locally": st is not None},
        "findings": [], "recovery": [], "plan_rationale": None, "tasks": [],
    }
    if st:
        out["findings"] = [{"id": f["id"], "category": f["category"], "kind": f["kind"], "status": f["status"],
                            "confidence": f["confidence"], "confidence_inputs": f.get("confidence_inputs", {}),
                            "statement": f["statement"],
                            "policy_violated": f.get("policy_violated"), "audit_notes": f.get("audit_notes", [])}
                           for f in st["findings"]]
        out["recovery"] = [{"task_id": d["task_id"], "chosen": d["chosen"], "rule_default": d["default"],
                            "reason": d.get("reason", ""), "failed_check": d.get("failed_check", ""),
                            "options": d.get("options", []), "model": d.get("model", "")}
                           for d in st.get("decisions", [])]
        out["plan_rationale"] = st.get("plan_rationale")
        out["tasks"] = [{"id": t["id"], "tool": t["tool"], "status": t.get("status", ""),
                         "target": str(t.get("args", {}).get("path") or t.get("args", {}).get("domain")
                                       or t.get("args", {}).get("name") or ""),
                         "reason": t.get("reason", ""), "parent": t.get("parent"), "attempts": t.get("attempts", 1)}
                        for t in st.get("done", [])]
    return out


def build() -> Path:
    companies: dict[str, dict] = {}
    latest: dict[str, tuple[dict, dict, Path]] = {}
    first_scored: dict[str, str] = {}
    for p in sorted(EVALS.glob("2026*.json")):
        card = json.loads(p.read_text(encoding="utf-8"))
        for r in card.get("runs", []):
            if "planted_detail" in r:
                latest[r["run_id"]] = (r, card, p)  # a run scored twice keeps its latest scorecard
                first_scored.setdefault(r["run_id"], card.get("created", ""))
    for r, card, p in latest.values():
        ds = r.get("dataset") or "acme"
        companies.setdefault(ds, _company(ds))["runs"].append(_run(r, card, p))
    for c in companies.values():
        # Run order = when the run started (its state, UTC); runs without local state use the first scorecard
        # they appear in (written in IST), not a later re-score.
        c["runs"].sort(key=lambda r: _utc(r["started_at"]) if r["started_at"] else _utc(first_scored[r["run_id"]], IST))
        done = [r for r in c["runs"] if r["phase"] == "done"]
        c["latest_run_id"] = (done or c["runs"])[-1]["run_id"]
    order = ["acme"] + sorted(k for k in companies if k != "acme")
    comps = [companies[k] for k in order if k in companies]
    runs = [r for c in comps for r in c["runs"]]
    latest_runs = [next(r for r in c["runs"] if r["run_id"] == c["latest_run_id"]) for c in comps]
    data = {"schema_version": SCHEMA_VERSION, "generated_at": datetime.now().isoformat(timespec="seconds"),
            "summary": {  # counts only
                "runs_scored": len(runs),
                "runs_unfinished": sum(r["phase"] != "done" for r in runs),
                "companies": len(comps), "held_out_companies": sum(c["role"] == "held_out" for c in comps),
                "industries": sorted({c["industry"] for c in comps}),
                "latest_runs_all_caught": sum(r["metrics"]["planted_caught"] == r["metrics"]["planted_total"]
                                              for r in latest_runs),
                "latest_runs_false_alarms": sum(r["metrics"]["false_alarms"] or 0 for r in latest_runs),
                "recovery_decisions": sum(len(r["recovery"]) for r in runs),
                "recovery_overrides": sum(d["chosen"] != d["rule_default"] for r in runs for d in r["recovery"]),
                "findings_overturned": sum(f["status"] == "overturned" for r in runs for f in r["findings"]),
                "findings_downgraded": sum(f["status"] == "downgraded" for r in runs for f in r["findings"]),
                "injected_runs": [{"company": c["key"], "run_id": r["run_id"], "faults": r["injected_faults"],
                                   "planted_caught": r["metrics"]["planted_caught"],
                                   "planted_total": r["metrics"]["planted_total"]}
                                  for c in comps for r in c["runs"] if r["injected_faults"]],
            },
            "featured": FEATURED, "comparisons": COMPARISONS,
            "companies": comps,
            "business": {"plan": "business/cfoai_plan.md", "unit_costs": "business/unit_costs.md",
                         "cfoai_exports": "business/cfoai/", "headlines": BUSINESS_HEADLINES}}
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    SITE_DATA.parent.mkdir(parents=True, exist_ok=True)
    SITE_DATA.write_text("window.SPEND_RADAR_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    return OUT
