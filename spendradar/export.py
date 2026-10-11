"""Export every scored run as one JSON file for a front end: evidence/frontend_data.json.

`python -m spendradar export` reads evidence/evals/*.json (committed scorecards) and, when present,
runs/<id>/state.json (local), and writes a stable structure documented in docs/frontend-data.md.
Every value is copied from a scorecard, a run's state or a ground-truth file; nothing is computed here
except counts. Bump SCHEMA_VERSION when a field changes meaning.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import yaml

SCHEMA_VERSION = 1
EVALS = Path("evidence/evals")
OUT = Path("evidence/frontend_data.json")

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
        "findings": [], "recovery": [],
    }
    if st:
        out["findings"] = [{"id": f["id"], "category": f["category"], "kind": f["kind"], "status": f["status"],
                            "confidence": f["confidence"], "statement": f["statement"],
                            "policy_violated": f.get("policy_violated"), "audit_notes": f.get("audit_notes", [])}
                           for f in st["findings"]]
        out["recovery"] = [{"task_id": d["task_id"], "chosen": d["chosen"], "rule_default": d["default"],
                            "reason": d.get("reason", "")} for d in st.get("decisions", [])]
    return out


def build() -> Path:
    companies: dict[str, dict] = {}
    latest: dict[str, tuple[dict, dict, Path]] = {}
    for p in sorted(EVALS.glob("2026*.json")):
        card = json.loads(p.read_text(encoding="utf-8"))
        for r in card.get("runs", []):
            if "planted_detail" in r:
                latest[r["run_id"]] = (r, card, p)  # a run scored twice keeps its latest scorecard
    for r, card, p in sorted(latest.values(), key=lambda x: x[1].get("created", "")):
        ds = r.get("dataset") or "acme"
        companies.setdefault(ds, _company(ds))["runs"].append(_run(r, card, p))
    order = ["acme"] + sorted(k for k in companies if k != "acme")
    data = {"schema_version": SCHEMA_VERSION, "generated_at": datetime.now().isoformat(timespec="seconds"),
            "companies": [companies[k] for k in order if k in companies],
            "business": {"plan": "business/cfoai_plan.md", "unit_costs": "business/unit_costs.md",
                         "cfoai_exports": "business/cfoai/"}}
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    return OUT
