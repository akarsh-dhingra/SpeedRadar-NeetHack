"""Publish eval scorecards to neatlogs as a traced `spendradar_eval` workflow.

Scoring stays in evals.py: only we hold the ground truth. This puts the result where
the traces live: one `eval:run` span per scored run (input = run id + its trace id,
output = scores + PASS/FAIL) and one `eval:planted_error` span per planted error.
Failed checks get ERROR status, so neatlogs detections and the Execution Failed view
flag regressions without anyone opening a JSON file.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import neatlogs
from opentelemetry.trace import Status, StatusCode

from spendradar.tracing import init_tracing, set_io, shutdown_tracing


def verdict(score: dict) -> tuple[str, list[str]]:
    """PASS only if every planted error is caught, nothing unsupported, no false alarms, run finished."""
    why = []
    if score["planted_caught"] < score["planted_total"]:
        missed = [k for k, v in score["planted_detail"].items() if not v]
        why.append(f"missed planted errors: {', '.join(missed)}")
    if score["unsupported_numbers_in_report"]:
        why.append(f"{score['unsupported_numbers_in_report']} unsupported numbers in report")
    if score.get("false_alarms"):
        why.append(f"{score['false_alarms']} false alarms")
    if score["phase"] != "done":
        why.append(f"run ended in phase {score['phase']!r}")
    return ("FAIL" if why else "PASS"), why


def _fail(span, msg: str) -> None:
    span.set_status(Status(StatusCode.ERROR, msg[:200]))


def publish(card: dict, scorecard: Path) -> str:
    """Emit one eval trace for a scorecard; returns its trace id. One process = one eval trace."""
    eval_id = "eval-" + datetime.now().strftime("%m%d-%H%M%S")
    init_tracing(eval_id, [f"variant:{card['variant']}", "eval"] + (["evidence"] if card["evidence"] else []))
    try:
        with neatlogs.trace("spendradar_eval", kind="WORKFLOW", session_id=eval_id) as root:
            trace_id = format(root.get_span_context().trace_id, "032x")
            results = []
            for s in card["runs"]:
                v, why = verdict(s)
                results.append(v)
                with neatlogs.trace("eval:run", kind="GUARDRAIL") as span:
                    set_io(span, input={"run_id": s["run_id"], "run_trace_id": s["trace_id"],
                                        "dataset": s["dataset"], "data_mode": s["data_mode"],
                                        "git_sha": s["git_sha"], "ground_truth": s["ground_truth"]},
                           output={"verdict": v, "why": why,
                                   "planted_caught": f"{s['planted_caught']}/{s['planted_total']}",
                                   "false_alarms": s["false_alarms"],
                                   "unsupported_numbers_in_report": s["unsupported_numbers_in_report"],
                                   "overturned": s["overturned"], "downgraded": s["downgraded"],
                                   "recovery_non_default": s["recovery_non_default"],
                                   "fallback_hops": s["fallback_hops"], "llm_calls": s["llm_calls"],
                                   "provider_mix": s["provider_mix"], "crustdata_credits": s["crustdata_credits"]})
                    span.set_attribute("spendradar.eval.verdict", v)
                    span.set_attribute("spendradar.eval.run_trace_id", s["trace_id"] or "")
                    if v == "FAIL":
                        _fail(span, "; ".join(why))
                    for pid, caught in s["planted_detail"].items():
                        with neatlogs.trace("eval:planted_error", kind="GUARDRAIL") as p:
                            set_io(p, input={"run_id": s["run_id"], "planted_error": pid},
                                   output={"caught": caught})
                            if not caught:
                                _fail(p, f"planted error {pid} not caught")
            passed = results.count("PASS")
            set_io(root, input={"variant": card["variant"], "scorecard": scorecard.as_posix(),
                                "git_sha": card["git_sha"], "n_runs": card["n_runs"]},
                   output={"passed": f"{passed}/{len(results)}", "summary": card["summary_all_runs"]})
            if passed < len(results):
                _fail(root, f"{len(results) - passed} of {len(results)} runs failed the eval")
    finally:
        shutdown_tracing()
    return trace_id
