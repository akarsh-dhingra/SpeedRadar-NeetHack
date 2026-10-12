"""Export every scored run as one JSON file for a front end: evidence/frontend_data.json.

`python -m spendradar export` reads evidence/evals/*.json (committed scorecards) and, when present,
runs/<id>/state.json (local), and writes a stable structure documented in docs/frontend-data.md.
Every value is copied from a scorecard, a run's state or a ground-truth file; nothing is computed here
except counts. Bump SCHEMA_VERSION when a field changes meaning.
"""

from __future__ import annotations

import json
import re
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
    {"title": "Same data, three different audit verdicts", "company": "acme",
     "before": ["1010-767322", "1010-bf52d4", "1010-4d1835", "1010-bd4980", "1010-a67b26"],
     "after": ["1011-41090d", "1011-656492", "1011-8ae79e", "1011-e1f008", "1011-d1cade"],
     "case_study": "evidence/case-studies/05-audit-verdict-variance.md",
     "finding": "f_ml_ai",  # the site shows this finding's audit status on each run
     "note": "ML/AI verdict: 3 different verdicts in 5 identical runs before, the same verdict 5/5 after. "
             "n = 5 per side, same models, 0 fallback hops."},
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
    {"title": "One weak signal threw away 3 of 5 peers (rerun, n = 5 per side)", "company": "acme",
     "before": ["1011-324f77", "1011-45b4f4", "1011-e6132c", "1011-2c53f4", "1011-e8b645"],
     "after": ["1011-efdab4", "1011-51f5c4", "1011-6d3ba6", "1011-1078e9", "1011-09fd9f"],
     "case_study": "evidence/case-studies/02-competitor-substitution.md",
     "note": "Same code, models and cached data on both sides; before = current main with only the fix reverted "
             "(d311fb5). Peers kept: 2 of 5 in all 5 runs before, 5 of 5 in all 5 after; 3 substitutions per run "
             "before, 0 after. 0 fallback hops.",
     # Read from each run's state.json (competitors kept, substitute_competitor decisions); see the case study.
     "per_run": {"label": "Chosen peers kept", "values": {
         **{rid: {"text": "2 / 5 (3 swapped for New Relic / Datadog)", "good": False}
            for rid in ("1011-324f77", "1011-45b4f4", "1011-e6132c", "1011-2c53f4", "1011-e8b645")},
         **{rid: {"text": "5 / 5", "good": True}
            for rid in ("1011-efdab4", "1011-51f5c4", "1011-6d3ba6", "1011-1078e9", "1011-09fd9f")}}}},
    {"title": "One weak signal threw away 3 of 5 peers (original)", "company": "acme",
     "before": ["1010-b31657"], "after": ["1010-7bf26d"],
     "case_study": "evidence/case-studies/02-competitor-substitution.md", "note": "n = 1 per side.",
     "per_run": {"label": "Chosen peers kept", "values": {"1010-b31657": {"text": "2 / 5", "good": False},
                                                          "1010-7bf26d": {"text": "5 / 5", "good": True}}}},
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

# The live cfo.ai workspace, read over the cfo.ai MCP with read-only tools (list_orgs, inspect_*) on 11 Oct.
CFOAI_MCP_EXPORT = "business/cfoai/mcp_export_2026-10-11.json"
CFOAI_MANAGED_REVIEW = "business/cfoai/managed_review_2026-10-11.json"  # scenario added later the same night


def _cfoai_model(root):
    """The scenarios' key metrics and 24-month ending cash from the cfo.ai MCP export, or None if absent."""
    p = Path(root) / CFOAI_MCP_EXPORT
    if not p.exists():
        return None
    d = json.loads(p.read_text(encoding="utf-8"))
    ser = d["series"]
    months = ser[next(k for k in ser if not k.startswith("_"))]["months"]
    scen = [{"name": "Base" if x["name"] == "Main Scenario" else x["name"],
             **{k: x["metrics"].get(k) for k in ("first_cash_flow_positive_month", "lowest_ending_cash", "lowest_ending_cash_month",
                                                 "ending_cash_month_24", "revenue_month_24", "gross_margin_month_24", "customers_month_24")},
             "ending_cash": [round(v) for v in ser[x["name"]]["Ending cash"]]} for x in d["scenarios"]]
    mr = Path(root) / CFOAI_MANAGED_REVIEW
    if mr.exists():  # added 11 Oct 23:26 IST over the cfo.ai MCP; values as cfo.ai returned them
        m = json.loads(mr.read_text(encoding="utf-8"))
        r, base = m["Managed review"], next(s for s in scen if s["name"] == "Base")
        low = min(r["Ending cash"])
        first = next(i for i, v in enumerate(r["Net cash flow"]) if v > 0)
        scen.append({"name": "Managed review", "first_cash_flow_positive_month": f"{m['months'][first]} (month {first + 1})",
                     "lowest_ending_cash": low, "lowest_ending_cash_month": m["months"][r["Ending cash"].index(low)],
                     "ending_cash_month_24": r["Ending cash"][-1], "revenue_month_24": base["revenue_month_24"],
                     "gross_margin_month_24": r["Gross margin"][-1], "customers_month_24": base["customers_month_24"],
                     "ending_cash": [round(v) for v in r["Ending cash"]],
                     "note": "We review flagged invoices ourselves: measured flag rate 17.59% (real FCC invoices)."})
    return {
        "source": CFOAI_MCP_EXPORT, "read_only": True, "months": months, "scenarios_added": CFOAI_MANAGED_REVIEW,
        "scenarios": scen,
        "pages": [pg.get("title") for pg in d.get("pages", [])],
        "changelog_entries": d.get("history", {}).get("total_entries"),
        "canvas_blocks": len(d.get("canvas_blocks", [])),
    }


# Scorecards that only re-score runs already scored elsewhere (to publish them to neatlogs or collect
# history). They must not replace a run's original scorecard, or the run would show their variant label.
RESCORE_VARIANTS = {"history-all-acme-runs", "before-fix-misses", "gpt5nano-evidence-rescore", "fixture-rescore"}

# Entire trails on the GitHub repo (the submission repo). Runner results copied from `entire trail show`
# and `entire trail finding list` on 2026-10-11 (trails 1-3) and 2026-10-12 (trail 4); the trail pages are the source.
ENTIRE_REPO = "https://entire.io/gh/akarsh-dhingra/SpeedRadar-NeetHack"
TRAILS = [
    {"number": 1, "title": "Code provenance: every run links to the Entire checkpoint that wrote its code",
     "branch": "feat/code-provenance", "runner_result": "no blocking issues", "findings": []},
    {"number": 2, "title": "Case study 05: deterministic audit verdicts for disagreeing competitor signals",
     "branch": "feat/deterministic-audit", "runner_result": "no blocking issues",
     "findings": [{"severity": "medium", "status": "resolved", "fix": "a16758f",
                   "summary": "Disagreeing signals skipped the judge, so news evidence (layoffs, acquisitions) was "
                              "never weighed. Now the shortcut applies only without news."}]},
    {"number": 3, "title": "spendradar explain: neatlogs span -> code -> Entire checkpoint, session and prompt",
     "branch": "feat/explain", "runner_result": "no blocking issues",
     "findings": [{"severity": "low", "status": "resolved", "fix": "62c6b69",
                   "summary": "Trace pagination could loop forever if the cursor did not advance."}]},
    {"number": 4, "title": "Printed-net invoice totals + read_pdf_llm v3 + classifier unwrap (case study 07)",
     "branch": "review/printed-net", "runner_result": "no blocking issues", "findings": [],
     "note": "after-merge review of 398b322: base review/base-7c59831 is its parent, so the diff is exactly that commit"},
]
RUNNERS = ["risk", "confidence", "drift", "security", "review", "summary"]

# neatlogs detections created over the MCP (group "Spend Radar"); see evidence/neatlogs/evals-and-detections.md.
DETECTIONS = [
    {"name": "Eval: run FAILED", "on": "eval:run spans", "why": "regression alarm for the ground-truth eval"},
    {"name": "Eval: planted error missed", "on": "eval:planted_error spans", "why": "which planted error regressed"},
    {"name": "LLM rejected input (400 INVALID_ARGUMENT)", "on": "LLM spans",
     "why": "the corrupt-PDF bug from neatlogs auto-triage; matched 16 historical spans"},
    {"name": "Recovery substituted a competitor", "on": "decide:recovery", "why": "case study 02 regression guard"},
    {"name": "Recovery chose a non-default action", "on": "decide:recovery", "why": "the LLM's own recovery choices"},
    {"name": "Model fallback hop", "on": "CHAIN spans", "why": "runs excluded from clean comparisons"},
    {"name": "Self-audit overturned a claim", "on": "AGENT spans", "why": "the agent disproving its own finding"},
]
TRIAGE = {"id": "2cd5e9df-86d1-4a85-977d-94ebb059615e", "title": "Handle corrupt PDF files in read_pdf",
          "found_by": "neatlogs auto-triage (8 linked traces)", "fix_commit": "8d11308", "status": "resolved",
          "before_trace": "36362eb966cdbb85dcb2fb1b280e1034", "after_trace": "953bb991e2547b1591bb2bb6adb555b8",
          "result": "invoice 13 now fails in 0.8 ms with no LLM call; 5/5 planted errors"}


def _explain_dossiers() -> list[dict]:
    """Headline lines of each `spendradar explain` dossier (evidence/explain/*.md)."""
    out = []
    for p in sorted(Path("evidence/explain").glob("*.md")):
        text = p.read_text(encoding="utf-8")
        items, cur = [], None
        for line in text.splitlines():
            if line.startswith("## "):
                cur = {"span": line[3:].split(" — ")[0].strip("` "), "status": line.split(" — ")[-1]}
                items.append(cur)
            elif cur is not None and line.startswith("- Code:"):
                cur["code"] = line[len("- Code:"):].strip()
            elif cur is not None and line.startswith("- Written by:"):
                cur["written_by"] = line[len("- Written by:"):].strip().replace("**", "")
            elif cur is not None and line.startswith("- Commit"):
                cur["commit_checkpoint"] = line[2:].strip()
            elif cur is not None and line.strip().startswith(">") and "prompt" not in cur:
                quote = line.strip().lstrip(">").strip()
                # skip wrapper tags and bare headings ("<pasted_content …>", "# Task") for the first real sentence
                if quote and not quote.startswith("<") and not re.fullmatch(r"#+\s*\w+", quote):
                    cur["prompt"] = quote
            elif cur is not None and "(an auto-instrumented call inside" in line:
                cur["via"] = line.split("inside `")[-1].split("`")[0]
        out.append({"file": p.as_posix(), "trace_id": text.split("`")[1] if "`" in text else "", "spans": items,
                    "closes_triage_loop": "files.py:139" in text})
    return sorted(out, key=lambda d: not d["closes_triage_loop"])  # the triage closed loop first


def _prompt_versions() -> list[dict]:
    from spendradar import prompts

    return [{"key": p.key, "version": p.version} for p in vars(prompts).values() if isinstance(p, prompts.Prompt)]


def _checkpoint_count() -> int:
    import subprocess

    try:
        out = subprocess.check_output(["git", "log", "--all", "--format=%(trailers:key=Entire-Checkpoint,valueonly)"],
                                      text=True)
        return len({x.strip() for x in out.split() if x.strip()})
    except Exception:
        return 0


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
        "code": r.get("code") or (st or {}).get("code") or {},  # commit + Entire checkpoint (runs since 11 Oct)
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
    elif (prev := PREVIOUS.get(r["run_id"])) and (prev.get("tasks") or prev.get("findings")):
        # runs/ is git-ignored, so no single machine holds every run folder. Keep the details an earlier export
        # read from that run's own state rather than dropping them; scorecard values above still come fresh.
        for k in ("started_at", "findings", "recovery", "plan_rationale", "tasks"):
            out[k] = prev.get(k, out[k])
        out["details_from"] = "previous export (run folder not on this machine)"
    return out


PREVIOUS: dict[str, dict] = {}  # run_id -> run as last exported; filled by build()


def _load_previous() -> None:
    PREVIOUS.clear()
    if OUT.exists():
        for c in json.loads(OUT.read_text(encoding="utf-8")).get("companies", []):
            for r in c.get("runs", []):
                PREVIOUS[r["run_id"]] = r


def _real_invoices() -> dict | None:
    """The latest real-invoice scorecard (evals/real_invoices.py), shown as exported."""
    cards = sorted(Path("evidence/real-invoices").glob("2026*.json"))
    if not cards:
        return None
    loaded = [(p, json.loads(p.read_text(encoding="utf-8"))) for p in cards]

    def silent(card: dict) -> int:  # wrong total, yet its line items add up: nothing warns a human
        return sum(1 for x in card["invoices"] if not x["total_correct"]
                   and (x.get("agent_totals_check") or {}).get("passed"))

    passes = [{"variant": c.get("variant", "real-invoices"), "created": c["created"], "git_sha": c["git_sha"],
               "flagged_correct": sum(1 for x in c["invoices"] if x["total_correct"]
                                      and not (x.get("agent_totals_check") or {}).get("passed")),
               "invoice_set": ("held out" if "heldout" in c.get("gt_file", "") else
                               "third, fresh" if "third" in c.get("gt_file", "") else "tuned on"),
               "n_invoices": c["n_invoices"], "total_correct": c["total_correct"], "silent_misses": silent(c),
               "neatlogs_trace_id": c.get("neatlogs_trace_id"), "scorecard": q.as_posix()} for q, c in loaded]
    groups: dict[str, list[dict]] = {}
    for x in passes:
        groups.setdefault(x["variant"], []).append(x)
    summary = [{"variant": v, "invoice_set": xs[0]["invoice_set"], "passes": len(xs), "n_invoices": xs[0]["n_invoices"],
                "total_correct": [x["total_correct"] for x in xs], "silent_misses": [x["silent_misses"] for x in xs],
                "flagged_correct": [x["flagged_correct"] for x in xs]}
               for v, xs in groups.items() if v in REAL_INVOICES_VARIANTS]
    summary.sort(key=lambda g: REAL_INVOICES_VARIANTS.index(g["variant"]))
    main = [pc for pc in loaded if pc[1].get("variant") == REAL_INVOICES_MAIN] or loaded
    p, card = main[-1]
    return {"scorecard": p.as_posix(), "passes": passes, "summary": summary, "what_changed": REAL_INVOICES_NOTE,
            "silent_misses": silent(card),
            **{k: card.get(k) for k in ("created", "git_sha", "neatlogs_trace_id", "source", "license", "n_invoices",
                                         "read_ok", "total_correct", "agent_totals_check_passed", "invoices")}}


# Real-invoice comparison: the variants in before/after order (same script, only the extraction prompt differs),
# the variant whose latest pass fills the invoice-by-invoice table, and one line on what changed.
REAL_INVOICES_VARIANTS = ["real-before-prompt-v2", "real-after-prompt-v2", "tuned-v3", "heldout-prompt-v1", "heldout-prompt-v2",
                          "heldout-v3", "third-v2", "third-v3"]
REAL_INVOICES_MAIN = "heldout-v3"
REAL_INVOICES_NOTE = None


# "How it works": one real run told in plain words. Everything the page shows is prepared here, so the page
# only renders (the design system's "show, never compute").
STORY_TOOLS = {  # tool -> (plan line, tile word)
    "read_budget": ("Read the budget spreadsheet", "Spreadsheet"),
    "read_invoice": ("Read an invoice PDF", "Invoice"),
    "read_policy": ("Read the spend policy", "Policy"),
    "read_salary_table": ("Read the salary table", "Salary table"),
    "fetch_competitor": ("Look up a competitor's headcount (Crustdata)", "Competitor"),
    "fetch_jobs": ("Fetch a competitor's job posts (Crustdata)", "Job posts"),
    "classify_titles": ("Sort job titles into teams (LLM)", "Job titles"),
}
STORY_ACTIONS = {
    "narrow_range": "Re-read only the row that looked wrong",
    "reparse_alt": "Try a different way to read the file",
    "fetch_more_signal": "Fetch more evidence",
    "mark_low_confidence": "Keep it, marked low confidence",
    "substitute_competitor": "Swap in a similar company",
    "skip": "Leave it out and say so in the report",
}
STORY_CATEGORY = {"ml_ai": "ML/AI", "infra_cloud": "Infra/cloud", "engineering": "Engineering", "sales": "Sales",
                  "marketing": "Marketing", "internal": "Own books"}


def _plain(text: str) -> str:
    return text.replace("ml_ai", "ML/AI").replace("infra_cloud", "infra/cloud")


def _story(comps: list[dict]) -> dict | None:
    """The latest finished, real-data, uninjected run of the featured company with a full step log; never a
    deliberate before-run."""
    c = next((x for x in comps if x["key"] == FEATURED["company"]), None)
    ok = [r for r in (c or {}).get("runs", []) if r["tasks"] and r["findings"] and r["recovery"]
          and r["data_mode"] == "real" and not r["injected_faults"] and r["phase"] == "done"
          and not re.search(r"before|ablation", r["variant"])]
    if not ok:
        return None
    r = ok[-1]

    def short(t: str) -> str:
        return t.replace("invoices/", "")

    top = [t for t in r["tasks"] if not t["parent"]]
    kids: dict[str, list[dict]] = {}
    for t in r["tasks"]:
        if t["parent"]:
            kids.setdefault(t["parent"], []).append(t)

    def outcome(t: dict) -> str:
        if t["status"] != "failed":
            return "ok"
        k = kids.get(t["id"], [])
        return "recovered" if k and k[-1]["status"] == "done" else "flagged"

    groups: list[dict] = []
    for t in top:
        if groups and groups[-1]["tool"] == t["tool"]:
            groups[-1]["n"] += 1
        else:
            groups.append({"tool": t["tool"], "label": STORY_TOOLS.get(t["tool"], (t["tool"],))[0], "n": 1})
    tiles = [{"id": t["id"], "word": STORY_TOOLS.get(t["tool"], ("", t["tool"]))[1], "target": short(t["target"]),
              "reason": t["reason"], "outcome": outcome(t)} for t in top]
    counts = {k: sum(1 for x in tiles if x["outcome"] == k) for k in ("ok", "recovered", "flagged")}

    by_id = {t["id"]: t for t in r["tasks"]}
    internal = [f for f in r["findings"] if f["kind"] != "policy"]

    def next_step(d: dict) -> str:
        k = kids.get(d["task_id"], [])
        if not k:
            return ""
        if k[-1]["status"] == "done":
            return "worked"
        name = by_id.get(d["task_id"], {}).get("target", "").split("/")[-1]
        return "reported" if name and any(name in f["statement"] for f in internal) else "flagged"

    picks, seen = [], set()
    for d in r["recovery"]:  # one example per action the agent chose against the rule, then other actions
        if d["chosen"] != d["rule_default"] and d["chosen"] not in seen:
            seen.add(d["chosen"])
            picks.append(d)
    for d in r["recovery"]:
        if d["chosen"] not in seen and d["chosen"] != "mark_low_confidence":
            seen.add(d["chosen"])
            picks.append(d)
    picks.sort(key=lambda d: next_step(d) != "worked")
    cases = []
    for d in picks[:3]:
        t = by_id.get(d["task_id"], {})
        cases.append({"task_id": d["task_id"], "word": STORY_TOOLS.get(t.get("tool", ""), ("", ""))[1],
                      "target": short(t.get("target", "")),
                      "failed_check": re.sub(r"^(tool_error: )+", "", d["failed_check"]).split("\n")[0],
                      "options": [{"label": STORY_ACTIONS.get(o, o), "chosen": o == d["chosen"]} for o in d["options"]],
                      "rule": STORY_ACTIONS.get(d["rule_default"], d["rule_default"]),
                      "chosen": STORY_ACTIONS.get(d["chosen"], d["chosen"]), "override": d["chosen"] != d["rule_default"],
                      "model": d["model"] or "rule", "reason": re.split(r"(?<=[.!?])\s", d["reason"] or "—")[0],
                      "next": next_step(d)})

    order = {"overturned": 0, "downgraded": 1, "confirmed": 2}
    findings = [{"status": f["status"], "category": STORY_CATEGORY.get(f["category"], f["category"]),
                 "text": _plain(f["statement"].split(". Matching")[0].split("; ")[0]),
                 "why": _plain(re.sub(r"^[^:]+:\s*", "", (f["audit_notes"] or [""])[0])) if f["status"] != "confirmed" else ""}
                for f in sorted(r["findings"], key=lambda f: order.get(f["status"], 3))]
    policy = []
    for f in r["findings"]:
        if f["kind"] != "policy":
            continue
        m = re.search(r"is ([\d.]+%) of headcount vs competitor median ([\d.]+%[^\s(]*)", f["statement"])
        policy.append({"category": STORY_CATEGORY.get(f["category"], f["category"]), "ours": m.group(1) if m else None,
                       "peers": m.group(2) if m else None, "violated": bool(f["policy_violated"]), "status": f["status"]})
    m = r["metrics"]
    return {"company": c["name"], "company_key": c["key"], "run_id": r["run_id"], "trace_id": r["neatlogs_trace_id"],
            "models": m["models"], "plan_rationale": r["plan_rationale"], "planted_total": m["planted_total"],
            "files": [short(t["target"]) for t in top if t["tool"].startswith("read_")],
            "competitors": [x["name"] for x in c["competitors"]],
            "plan": groups, "n_tasks": len(top), "tiles": tiles, "counts": counts,
            "cases": cases, "decisions": m["recovery_decisions"], "non_default": m["recovery_non_default"],
            "findings": findings, "policy": policy,
            "own_books": [_plain(f["statement"].split(";")[0].split(": line items")[0]) for f in internal],
            "score": {"planted_caught": m["planted_caught"], "planted_total": m["planted_total"],
                      "unsupported": m["unsupported_numbers_in_report"], "llm_calls": m["llm_calls"],
                      "crustdata_credits": m["crustdata_credits"]}}


def build() -> Path:
    _load_previous()
    companies: dict[str, dict] = {}
    latest: dict[str, tuple[dict, dict, Path]] = {}
    first_scored: dict[str, str] = {}
    eval_traces = []
    cards = [(p, json.loads(p.read_text(encoding="utf-8"))) for p in sorted(EVALS.glob("2026*.json"))]
    cards.sort(key=lambda pc: pc[1].get("variant") not in RESCORE_VARIANTS)  # re-scores first; originals win
    for p, card in cards:
        if card.get("neatlogs_eval_trace_id"):
            eval_traces.append({"trace_id": card["neatlogs_eval_trace_id"], "variant": card.get("variant", ""),
                                "scorecard": p.as_posix(), "runs": card.get("n_runs", 0),
                                "passed": sum(r.get("planted_caught") == r.get("planted_total")
                                              and not r.get("unsupported_numbers_in_report")
                                              and r.get("phase", "done") == "done" for r in card.get("runs", []))})
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
        # "Latest" never means a deliberate before-run (a fix reverted to re-measure a case study).
        done = [r for r in c["runs"] if r["phase"] == "done" and not re.search(r"before|ablation", r["variant"])]
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
            "featured": FEATURED, "comparisons": COMPARISONS, "real_invoices": _real_invoices(),
            "story": _story(comps),
            "companies": comps,
            "business": {"plan": "business/cfoai_plan.md", "unit_costs": "business/unit_costs.md",
                         "cfoai_exports": "business/cfoai/", "headlines": BUSINESS_HEADLINES,
                         "cfoai_model": _cfoai_model(".")},
            "neatlogs": {"detections": DETECTIONS, "triage": TRIAGE, "prompts": _prompt_versions(),
                         "eval_traces": sorted(eval_traces, key=lambda e: e["scorecard"]),
                         "docs": {"coverage": "evidence/neatlogs/coverage.md",
                                  "evals": "evidence/neatlogs/evals-and-detections.md",
                                  "traces": "evidence/traces.md"}},
            "entire": {"repo": ENTIRE_REPO, "trails": TRAILS, "runners": RUNNERS,
                       "checkpoints": _checkpoint_count(), "explain": _explain_dossiers(),
                       "docs": {"entire": "evidence/entire/", "explain": "evidence/explain/",
                                "runners": ".entire/runners/"}}}
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    SITE_DATA.parent.mkdir(parents=True, exist_ok=True)
    SITE_DATA.write_text("window.SPEND_RADAR_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    return OUT
