"""Real-invoice check: the agent's own invoice reader on real, public invoices with verified totals.

    uv run python -m evals.real_invoices [--limit N]

Source: 12 clean FCC broadcast-advertising invoices from amazon/ConfBench (public records, CC BY-NC 4.0,
evaluation use only), listed with their verified totals in evals/real_invoices_gt.json. The PDFs are
downloaded to cache/real_invoices/ (git-ignored), never committed.

Each invoice goes through the same path an agent run takes: the text parser first and, on a ToolError,
the `reparse_alt` recovery (the LLM PDF reader). Scored: does the extracted stated total match the verified
GrossTotal within 1%? Also recorded: whether the agent's own totals check (line items vs stated total)
passes. Public data only, so the free-tier LLM fallbacks are allowed (CLAUDE.md rule 10).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

GT = Path("evals/real_invoices_gt.json")
CACHE = Path("cache/real_invoices")
OUT = Path("evidence/real-invoices")


def _download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as r:  # noqa: S310 (fixed https host from the GT file)
        dest.write_bytes(r.read())


def _read(path: Path) -> dict:
    from spendradar.tools.files import ToolError, read_pdf

    try:
        return {"route": "text", **read_pdf(str(path), "text")}
    except ToolError as e:
        first_error = str(e)
    try:
        return {"route": "text -> reparse_alt (llm)", "text_error": first_error, **read_pdf(str(path), "llm")}
    except ToolError as e:
        return {"route": "text -> reparse_alt (llm)", "text_error": first_error, "error": str(e)}


def main(argv: list[str] | None = None) -> None:
    load_dotenv(".env")
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args(argv)
    os.environ["SPENDRADAR_LLM_CACHE"] = "0"  # real model calls, as in an evidence run

    import neatlogs

    from spendradar.tracing import git_sha, init_tracing, shutdown_tracing
    from spendradar.verify import TOLERANCE, totals_check

    gt = json.loads(GT.read_text(encoding="utf-8"))
    items = gt["invoices"][: args.limit] if args.limit else gt["invoices"]
    run_id = "real-" + datetime.now().strftime("%m%d-%H%M%S")
    init_tracing(run_id, ["variant:real-invoices", "evidence", "real-data:public"])
    results = []
    with neatlogs.trace("spendradar_real_invoices", kind="WORKFLOW", session_id=run_id) as root:
        trace_id = format(root.get_span_context().trace_id, "032x")
        for inv in items:
            path = CACHE / inv["file"]
            _download(gt["pdf_url"].format(file=inv["file"]), path)
            with neatlogs.trace(f"real_invoice:{inv['file'][:8]}", kind="AGENT") as span:
                r = _read(path)
                ex = r.get("extract")
                truth = inv["gross_total"]
                row = {"file": inv["file"], "agency": inv["agency"], "advertiser": inv["advertiser"],
                       "verified_gross_total": truth, "route": r["route"], "parser": r.get("parser"),
                       "error": r.get("error"), "text_error": r.get("text_error")}
                if ex:
                    got = ex["stated_total"]
                    row["extracted_total"] = got
                    row["total_correct"] = bool(truth) and abs(got - truth) <= TOLERANCE * abs(truth)
                    chk = totals_check(inv["file"], [ln["amount"] for ln in ex["lines"]], got)
                    row["lines_extracted"] = len(ex["lines"])
                    row["agent_totals_check"] = {"passed": chk.passed, "detail": chk.detail}
                else:
                    row["total_correct"] = False
                span.set_attribute("spendradar.real_invoice.total_correct", row["total_correct"])
                results.append(row)
                print(json.dumps({k: row.get(k) for k in ("file", "route", "verified_gross_total", "extracted_total",
                                                           "total_correct")}))
    shutdown_tracing()
    read = [x for x in results if "extracted_total" in x]
    card = {"created": datetime.now().isoformat(timespec="seconds"), "git_sha": git_sha(), "run_id": run_id,
            "neatlogs_trace_id": trace_id, "source": gt["source"], "license": gt["license"],
            "n_invoices": len(results), "read_ok": len(read),
            "total_correct": sum(1 for x in results if x["total_correct"]),
            "agent_totals_check_passed": sum(1 for x in read if x["agent_totals_check"]["passed"]),
            "invoices": results}
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{datetime.now():%Y%m%dT%H%M%S}-{card['git_sha']}.json"
    out.write_text(json.dumps(card, indent=1), encoding="utf-8")
    print(f"scorecard: {out}")
    print(json.dumps({k: card[k] for k in ("n_invoices", "read_ok", "total_correct", "agent_totals_check_passed",
                                           "neatlogs_trace_id")}))


if __name__ == "__main__":
    main(sys.argv[1:])
