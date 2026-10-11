# Builds film/src/data/*.json from the project's own evidence, so every number on screen traces to a file:
#   run.json   the featured run, from runs/1011-777bb7/state.json + report.md (runs/ is git-ignored, so the
#              derived file is committed and names its source)
#   facts.json summary counts, cfo.ai cash curves, Entire/explain details
# Run from the repo root:  python demo-video/film/make_data.py
import json, re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)
RUN = "1011-777bb7"

# ── the featured run ──
s = json.loads((ROOT / "runs" / RUN / "state.json").read_text(encoding="utf-8"))
short = lambda x, n=90: (x if len(x) <= n else x[: n - 1] + "…")


def target(t):
    a = t.get("args") or {}
    return a.get("path") or a.get("name") or a.get("domain") or ""


tasks = [{"id": t["id"], "tool": t["tool"], "target": target(t), "status": t["status"], "recovery": (t.get("reason") or "").startswith("recovery:") or bool(t.get("parent"))} for t in s["done"]]
decisions = [{"task": d["task_id"], "check": short(d["failed_check"], 120), "options": d["options"], "chosen": d["chosen"], "default": d["default"],
              "overrode": d["chosen"] != d["default"], "reason": short(d["reason"], 140), "model": d["model"]} for d in s["decisions"]]
checks = s["checks"]
findings = [{"id": f["id"], "category": f["category"], "status": f.get("status"), "confidence": f.get("confidence"),
             "statement": short(f["statement"], 160), "audit": [short(n, 220) for n in f.get("audit_notes", [])]} for f in s["findings"]]
comps = [{"name": c["name"], "domain": c["domain"], "headcount": c.get("total_headcount"), "as_of": c.get("total_as_of")} for c in s["competitors"].values()]
report = (ROOT / "runs" / RUN / "report.md").read_text(encoding="utf-8").splitlines()
usage = s["llm_usage"]
run = {
    "_source": f"runs/{RUN}/state.json and report.md (real data mode), exported by demo-video/film/make_data.py",
    "run_id": RUN, "company": s["company"], "trace": s["trace_id"], "sha": s["git_sha"], "data_mode": s["data_mode"],
    "goal": s["goal"], "plan": s["plan_rationale"], "tasks": tasks, "decisions": decisions,
    "checks_total": len(checks), "checks_failed": sum(1 for c in checks if not c["passed"]),
    "failed_checks": [{"name": c["name"], "target": c["target"], "detail": short(c["detail"], 110)} for c in checks if not c["passed"]][:9],
    "not_analysed": s["not_analysed"], "findings": findings, "competitors": comps,
    "llm": {m: {"calls": u["calls"], "tokens_out": u["tokens_out"], "latency_s": u["latency_s"], "fallback_hops": u["fallback_hops"]} for m, u in usage.items()},
    "report_head": report[:4], "report_lines": [l for l in report if l.startswith("| ") and "confirmed" in l][:7],
}
(OUT / "run.json").write_text(json.dumps(run, indent=1, ensure_ascii=False), encoding="utf-8")

# ── facts used across the film ──
fd = json.loads((ROOT / "evidence" / "frontend_data.json").read_text(encoding="utf-8"))
summ = {k: v for k, v in fd["summary"].items() if not isinstance(v, (list, dict))}
companies = [{"key": c["key"], "name": c["name"], "industry": c["industry"], "competitors": [x if isinstance(x, str) else x.get("name") for x in c["competitors"]]} for c in fd["companies"]]
featured_run = next(r for c in fd["companies"] for r in c["runs"] if r["run_id"] == RUN)


def series(path, sheet_hint, label):
    wb = openpyxl.load_workbook(ROOT / path, data_only=True)
    for ws in wb.worksheets:
        if sheet_hint not in ws.title:
            continue
        for row in ws.iter_rows(values_only=True):
            if row and isinstance(row[0], str) and row[0].strip() == label:
                return [round(v) for v in row[1:] if isinstance(v, (int, float))][:24]
    raise SystemExit(f"{label} not found in {path}")


cash = {
    "_source": "business/cfoai/Monthly P&L & Cash.xlsx (Main Scenario = Base), business/cfoai/round2/Summary-Base-Growth-Downside.xlsx",
    "months": "Nov 2026 – Oct 2028",
    "base": series("business/cfoai/Monthly P&L & Cash.xlsx", "Monthly", "Ending cash"),
    "growth": series("business/cfoai/round2/Summary-Base-Growth-Downside.xlsx", "key", "Ending cash > Growth"),
    "downside": series("business/cfoai/round2/Summary-Base-Growth-Downside.xlsx", "key", "Ending cash"),
}
explain = (ROOT / "evidence" / "explain" / "5fcef2f7f2f8-decide-recovery.md").read_text(encoding="utf-8")
grab = lambda pat: (re.search(pat, explain) or [None, None])[1]
facts = {
    "_source": "evidence/frontend_data.json summary; business/cfoai exports; evidence/explain; evidence/case-studies 02 and 05; git ls-remote (checkpoints)",
    "summary": summ, "injected": fd["summary"]["injected_runs"], "companies": companies,
    "featured_metrics": featured_run["metrics"], "planted": featured_run["planted"],
    "cash": cash,
    "explain": {"trace": grab(r"Explain trace `([0-9a-f]+)`"), "code": grab(r"Code: `([^`]+)`"), "commit": grab(r"Commit `([0-9a-f]+)`"),
                "checkpoint": grab(r"Entire checkpoint \[`([0-9A-Z]+)`"), "session": grab(r"session `([0-9a-f-]+)`"),
                "chosen": "narrow_range", "default": "mark_low_confidence", "model": "gpt-5-nano",
                "prompt": "/grill-me # CLAUDE.md — Spend Radar (neatHack 2026)"},
    "case02": {"peers_before": "2/5", "peers_after": "5/5", "credits_before": 26.6, "credits_after": 5.4},
    "case05": {"before": ["confirmed", "overturned", "downgraded", "overturned", "overturned"], "after": ["downgraded"] * 5},
    "checkpoints": fd["entire"]["checkpoints"],
    "trails": [{"number": t["number"], "title": t["title"], "runners": t.get("runner_result"), "findings": t.get("findings", [])} for t in fd["entire"]["trails"]],
    "cfo": {"llm_per_run": "$0.0285", "crustdata_per_uncached_run": "$9.24", "starting_cash": 25000, "starter": "$99/mo · 8 runs", "team": "$399/mo · 40 runs",
            "base_positive": "Jan 2028", "growth_positive": "Jun 2027", "downside": "runs out Dec 2027", "test_team": "$495"},
}
(OUT / "facts.json").write_text(json.dumps(facts, indent=1, ensure_ascii=False), encoding="utf-8")
print("run.json:", len(tasks), "tasks,", len(decisions), "decisions,", run["checks_total"], "checks,", run["checks_failed"], "failed")
print("facts.json: cash months", len(cash["base"]), len(cash["growth"]), len(cash["downside"]), "| explain", facts["explain"])
