# Builds film/src/data/*.json from the project's own evidence, so every number on screen traces to a file:
#   run.json   the featured run, from runs/1011-777bb7/state.json + report.md (runs/ is git-ignored, so the
#              derived file is committed and names its source)
#   facts.json summary counts, cfo.ai cash curves, Entire/explain details
# Run from the repo root:  python demo-video/film/make_data.py
import json, re, subprocess
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
    "checks_total": len(checks), "check_results": [bool(c["passed"]) for c in checks], "checks_failed": sum(1 for c in checks if not c["passed"]),
    "failed_checks": [{"name": c["name"], "target": c["target"], "detail": short(c["detail"], 110)} for c in checks if not c["passed"]][:9],
    "not_analysed": s["not_analysed"], "findings": findings, "competitors": comps,
    "llm": {m: {"calls": u["calls"], "tokens_out": u["tokens_out"], "latency_s": u["latency_s"], "fallback_hops": u["fallback_hops"]} for m, u in usage.items()},
    "sources": [{"company": c["name"], "category": g.get("category"), "signal": g.get("name"), "value": g.get("headcount"), "as_of": g.get("as_of"),
                 "ref": (g.get("source") or {}).get("ref")} for c in s["competitors"].values() for g in c.get("signals", [])[:2]][:8],
    "report_rows": [
        {"area": cells[0], "finding": re.sub(r"(\[\d+\])+", "", cells[1]).strip(), "refs": re.findall(r"\[(\d+)\]", cells[1]),
         "policy": cells[2], "confidence": cells[3], "audit": cells[4]}
        for cells in ([c.strip() for c in l.strip().strip("|").split("|")] for l in report if l.startswith("| ") and not l.startswith("| Area") and not l.startswith("|---"))
        if len(cells) == 5
    ],
    "report_head": report[:4], "report_lines": [l for l in report if l.startswith("| ") and "confirmed" in l][:7],
}
(OUT / "run.json").write_text(json.dumps(run, indent=1, ensure_ascii=False), encoding="utf-8")

# ── facts used across the film ──
fd = json.loads((ROOT / "evidence" / "frontend_data.json").read_text(encoding="utf-8"))
summ = {k: v for k, v in fd["summary"].items() if not isinstance(v, (list, dict))}
def latest(c):
    r = next((r for r in c["runs"] if r["run_id"] == c.get("latest_run_id")), None) or {}
    m = r.get("metrics") or {}
    return {"run_id": r.get("run_id"), "caught": m.get("planted_caught"), "total": m.get("planted_total"), "false_alarms": m.get("false_alarms")}


companies = [{"key": c["key"], "name": c["name"], "industry": c["industry"], "role": c.get("role"),
              "competitors": [x if isinstance(x, str) else x.get("name") for x in c["competitors"]], "latest": latest(c)} for c in fd["companies"]]
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


# cfo.ai: the read-only MCP export of the live workspace (business/cfoai/mcp_export_2026-10-11.json) is the source;
# the older xlsx exports are only a fallback.
mcp_path = ROOT / "business" / "cfoai" / "mcp_export_2026-10-11.json"
if mcp_path.exists():
    mcp = json.loads(mcp_path.read_text(encoding="utf-8"))
    ser = mcp["series"]
    cash = {"_source": "business/cfoai/mcp_export_2026-10-11.json (cfo.ai MCP, read-only)", "months": "Nov 2026 – Oct 2028",
            "scenarios": {k: [round(v) for v in ser[k]["Ending cash"]] for k in ser if not k.startswith("_")}}
    cash.update(base=cash["scenarios"]["Main Scenario"], growth=cash["scenarios"]["Growth"], downside=cash["scenarios"]["Downside"])
    scen = [{"name": x["name"], **{k: x["metrics"].get(k) for k in ("first_cash_flow_positive_month", "lowest_ending_cash", "lowest_ending_cash_month",
             "ending_cash_month_24", "revenue_month_24", "gross_margin_month_24", "customers_month_24")}} for x in mcp["scenarios"]]
    cfo_meta = {"scenarios": scen, "changelog_entries": mcp["history"]["total_entries"], "canvas_blocks": len(mcp["canvas_blocks"]),
                "pages": [p_.get("title") for p_ in mcp["pages"]]}
else:
    cash = {
        "_source": "business/cfoai/Monthly P&L & Cash.xlsx (Main Scenario = Base), business/cfoai/round2/Summary-Base-Growth-Downside.xlsx",
        "months": "Nov 2026 – Oct 2028",
        "base": series("business/cfoai/Monthly P&L & Cash.xlsx", "Monthly", "Ending cash"),
        "growth": series("business/cfoai/round2/Summary-Base-Growth-Downside.xlsx", "key", "Ending cash > Growth"),
        "downside": series("business/cfoai/round2/Summary-Base-Growth-Downside.xlsx", "key", "Ending cash"),
    }
    cfo_meta = {}
explain = (ROOT / "evidence" / "explain" / "5fcef2f7f2f8-decide-recovery.md").read_text(encoding="utf-8")
grab = lambda pat: (re.search(pat, explain) or [None, None])[1]
facts = {
    "_source": "evidence/frontend_data.json summary; business/cfoai exports; evidence/explain; evidence/case-studies 02 and 05; git ls-remote (checkpoints)",
    "summary": summ, "injected": fd["summary"]["injected_runs"], "companies": companies,
    "featured_metrics": featured_run["metrics"],
    "featured_finding": next({k: f[k] for k in ("id", "category", "statement", "ours", "theirs_low", "theirs_high", "confidence", "confidence_inputs", "status", "audit_notes")}
                             for f in s["findings"] if f["id"] == "f_ml_ai"), "planted": featured_run["planted"],
    "cash": cash, "cfo_model": cfo_meta,
    "explain": {"trace": grab(r"Explain trace `([0-9a-f]+)`"), "code": grab(r"Code: `([^`]+)`"), "commit": grab(r"Commit `([0-9a-f]+)`"),
                "checkpoint": grab(r"Entire checkpoint \[`([0-9A-Z]+)`"), "session": grab(r"session `([0-9a-f-]+)`"),
                "chosen": "narrow_range", "default": "mark_low_confidence", "model": "gpt-5-nano",
                "prompt": "/grill-me # CLAUDE.md — Spend Radar (neatHack 2026)"},
    "case02": {"peers_before": "2/5", "peers_after": "5/5", "credits_before": 26.6, "credits_after": 5.4},
    "case05": {"before": ["confirmed", "overturned", "downgraded", "overturned", "overturned"], "after": ["downgraded"] * 5},
    "checkpoints": fd["entire"]["checkpoints"],
    # latest main-line commits that carry an Entire-Checkpoint trailer (hash, subject, checkpoint id)
    "commits": [dict(zip(("sha", "subject", "checkpoint"), l.split(""))) for l in subprocess.run(
        ["git", "log", "origin/main", "-n", "40", "--no-merges", "--format=%h%x1f%s%x1f%(trailers:key=Entire-Checkpoint,valueonly,separator=)"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout.splitlines() if l.split("")[-1].strip()][:9],
    "runners": fd["entire"].get("runners"),
    "trails": [{"number": t["number"], "title": t["title"], "runners": t.get("runner_result"), "findings": t.get("findings", [])} for t in fd["entire"]["trails"]],
    "cfo": {"llm_per_run": "$0.0285", "crustdata_per_uncached_run": "$9.24", "starting_cash": 25000, "starter": "$99/mo · 8 runs", "team": "$399/mo · 40 runs",
            "base_positive": "Jan 2028", "growth_positive": "Jun 2027", "downside": "runs out Dec 2027", "test_team": "$495"},
}
(OUT / "facts.json").write_text(json.dumps(facts, indent=1, ensure_ascii=False), encoding="utf-8")
print("run.json:", len(tasks), "tasks,", len(decisions), "decisions,", run["checks_total"], "checks,", run["checks_failed"], "failed")
print("facts.json: cash months", len(cash["base"]), len(cash["growth"]), len(cash["downside"]), "| explain", facts["explain"])
