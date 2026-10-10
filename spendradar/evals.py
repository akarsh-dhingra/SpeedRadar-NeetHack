"""Eval harness: score runs against evals/ground_truth.json (never shown to the agent).

`python -m spendradar eval --n 3 --variant X [--evidence]` launches n runs (one process
each, so each gets its own neatlogs tags), scores them, and writes
evidence/evals/<timestamp>-<sha>.json with mean/min/max and every trace id.
`python -m spendradar eval --score <run_id> …` scores existing runs without new LLM calls.
"""

from __future__ import annotations

import json
import re
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from spendradar.models import RunState

TRUTH = Path("evals/ground_truth.json")
OUT = Path("evidence/evals")


def _caught(state: RunState, p: dict, truth: dict) -> bool:
    t = p["type"]
    if p["id"] == "budget_total_mismatch":
        return any(c.name == "verify:totals" and c.target == f"budget:{p['category']}" and not c.passed
                   for c in state.checks)
    if t == "totals_mismatch":
        return any(c.name == "verify:totals" and c.target == p["file"] and not c.passed for c in state.checks)
    if t == "miscategorised":
        inv = next((i for i in truth["invoices"] if i["file"] == p["file"]), None)
        vendor_flagged = any(inv and inv["vendor"] in fl["target"] for fl in state.flags)
        corrected = any("mis-categorised" in f.statement and f"corrected category: {p['correct_category']}" in
                        " ".join(f.audit_notes) for f in state.findings)
        return vendor_flagged and corrected
    if t == "scanned_pdf":
        inv = next((i for i in state.invoices if i["path"] == p["file"]), None)
        return bool(inv and abs(inv["line_sum"] - p["amount"]) <= 0.01 * p["amount"])
    if t == "corrupt_file":
        return any(n["input"] == p["file"] for n in state.not_analysed)
    if t == "fixture":
        return any(f.status in ("overturned", "downgraded") and f.category == p["category"] for f in state.findings)
    return False


def _unsupported_numbers(report: str) -> int:
    """Rows of the Findings table that contain a number but cite no source."""
    rows = report.split("## Findings", 1)[-1].split("##", 1)[0].splitlines()
    return sum(1 for r in rows if r.startswith("| ") and not r.startswith("| Area") and re.search(r"\d", r)
               and not re.search(r"\[\d+\]", r) and "Internal" not in r and "Infra" not in r)


def score_run(run_id: str) -> dict:
    truth = json.loads(TRUTH.read_text())
    state = RunState.model_validate_json(Path(f"runs/{run_id}/state.json").read_text())
    report_path = Path(f"runs/{run_id}/report.md")
    report = report_path.read_text() if report_path.exists() else ""
    planted = [p for p in truth["planted_errors"] if p] + truth.get("fixtures", [])
    caught = {p["id"]: _caught(state, p, truth) for p in planted}
    errs = {}
    for cat, true_cost in truth["people_cost_fy27"].items():
        got = state.budget.get("people_cost", {}).get(cat)
        errs[cat] = None if got is None else round(100 * abs(got - true_cost) / true_cost, 3)
    inv_true = truth["invoice_totals_by_true_category"]
    inv_got: dict[str, float] = {}
    for inv in state.invoices:
        inv_got[inv["category"]] = inv_got.get(inv["category"], 0) + inv["line_sum"]
    inv_err = {c: round(100 * abs(inv_got.get(c, 0) - v) / v, 2) for c, v in inv_true.items()}
    usage = {m: u for m, u in state.llm_usage.items()}
    return {
        "run_id": run_id, "trace_id": state.trace_id, "git_sha": state.git_sha, "tags": state.tags,
        "phase": state.phase, "data_mode": state.data_mode, "injected": state.injected,
        "planted_caught": sum(caught.values()), "planted_total": len(caught), "planted_detail": caught,
        "people_cost_abs_pct_error": errs,
        "invoice_category_abs_pct_error": inv_err,
        "unsupported_numbers_in_report": _unsupported_numbers(report),
        "findings": {f.id: {"status": f.status, "confidence": f.confidence} for f in state.findings},
        "overturned": sum(f.status == "overturned" for f in state.findings),
        "downgraded": sum(f.status == "downgraded" for f in state.findings),
        "recovery_decisions": len(state.decisions),
        "recovery_non_default": sum(d.chosen != d.default for d in state.decisions),
        "llm_calls": sum(u["calls"] for u in usage.values()),
        "llm_tokens_in": sum(u["tokens_in"] for u in usage.values()),
        "llm_tokens_out": sum(u["tokens_out"] for u in usage.values()),
        "llm_latency_s": round(sum(u["latency_s"] for u in usage.values()), 1),
        "fallback_hops": sum(u.get("fallback_hops", 0) for u in usage.values()),
        "provider_mix": sorted(usage), "llm_usage": usage,
        "crustdata_credits": state.crustdata_credits,
    }


def _agg(vals: list[float]) -> dict:
    return {"mean": round(statistics.mean(vals), 3), "min": min(vals), "max": max(vals), "n": len(vals)}


def run_eval(n: int, variant: str, evidence: bool, score_only: list[str] | None = None) -> Path:
    run_ids = list(score_only or [])
    for _ in range(0 if score_only else n):
        cmd = [sys.executable, "-m", "spendradar", "run", "data/acme", "--variant", variant]
        cmd += ["--evidence"] if evidence else []
        out = subprocess.run(cmd, capture_output=True, text=True)
        m = re.search(r'"run_id": "([^"]+)"', out.stdout)
        if not m:
            print(out.stdout[-2000:], out.stderr[-2000:])
            raise SystemExit("run failed to start")
        run_ids.append(m.group(1))
    scores = [score_run(r) for r in run_ids]
    no_fallback = [s for s in scores if s["fallback_hops"] == 0]
    keys = ("planted_caught", "unsupported_numbers_in_report", "overturned", "downgraded", "recovery_decisions",
            "llm_calls", "llm_tokens_in", "llm_tokens_out", "llm_latency_s", "crustdata_credits")
    card = {
        "created": datetime.now().isoformat(timespec="seconds"), "variant": variant, "evidence": evidence,
        "git_sha": scores[0]["git_sha"] if scores else "", "n_runs": len(scores),
        "n_runs_without_fallback": len(no_fallback),
        "planted_total": scores[0]["planted_total"] if scores else 0,
        "summary_all_runs": {k: _agg([s[k] for s in scores]) for k in keys} if scores else {},
        "summary_no_fallback_runs": {k: _agg([s[k] for s in no_fallback]) for k in keys} if no_fallback else {},
        "runs": scores,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{datetime.now().strftime('%Y%m%dT%H%M%S')}-{card['git_sha']}-{variant}.json"
    path.write_text(json.dumps(card, indent=1))
    return path
