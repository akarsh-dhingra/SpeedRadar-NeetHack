"""The agent loop: PLAN → ACT → OBSERVE → VERIFY → (DECIDE:RECOVERY) … → SELF-AUDIT → REPORT.

The LLM writes the plan, picks recovery actions from a fixed menu, and judges
findings in the audit. Python runs tasks, does all maths, enforces retry caps and
budgets, and saves state after every step so a run can be resumed.
"""

from __future__ import annotations

import csv
import json
import os
import re
import secrets
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import neatlogs
import yaml
from pydantic import BaseModel

from spendradar import analysis, audit, faults, llm, report, verify
from spendradar.models import Check, Figure, Finding, RecoveryDecision, RunState, Source, Task
from spendradar.tools import classify, crustdata, files
from spendradar.tools.files import ToolError

RUNS = Path("runs")
MAX_ATTEMPTS = 3
CRASH_AFTER_STEP: int | None = None  # set by --crash-after-step to demo resume
GOAL = ("Tell Acme's finance team where competitors out-invest them in people (engineering, ML/AI, sales, "
        "marketing), check Acme's own spend files for errors, apply the spend policy, and support every "
        "number with a source.")
CC_TO_CATEGORY = {"infrastructure": "infra_cloud", "ml platform": "ml_ai", "marketing": "marketing", "sales": "sales",
                  "engineering": "engineering"}

TOOL_DOCS = {
    "read_budget": "Read the budget spreadsheet (args: path). Verifies each row's months sum to its FY total.",
    "read_invoice": "Read one invoice PDF (args: path, mode='text'|'llm'). Verifies line items sum to the total.",
    "read_policy": "Load policy.yaml (args: path).",
    "read_salary_table": "Load salary_table.csv (args: path).",
    "fetch_competitor": "Crustdata company enrich: headcount by role, history, funding, news (args: name, domain).",
    "fetch_jobs": "Crustdata job postings from the last 12 months, titles only (args: domain).",
    "classify_titles": "LLM-classify a competitor's job titles to estimate its ML/AI share (args: domain).",
}


# ----------------------------------------------------------------------------- plan schema

class PlannedTask(BaseModel):
    tool: Literal["read_budget", "read_invoice", "read_policy", "read_salary_table", "fetch_competitor",
                  "fetch_jobs", "classify_titles"]
    path: str | None = None
    name: str | None = None
    domain: str | None = None
    mode: Literal["text", "llm"] | None = None
    reason: str


class Plan(BaseModel):
    rationale: str
    tasks: list[PlannedTask]


# ----------------------------------------------------------------------------- state io

def state_path(run_id: str) -> Path:
    return RUNS / run_id / "state.json"


def save(state: RunState) -> None:
    state.step += 1
    p = state_path(state.run_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(state.model_dump_json(indent=1))
    tmp.replace(p)  # atomic: a crash never leaves a half-written state
    if CRASH_AFTER_STEP and state.step == CRASH_AFTER_STEP:
        import neatlogs as _nl

        _nl.flush()
        os._exit(137)  # simulated kill -9 right after a save


def load(run_id: str) -> RunState:
    return RunState.model_validate_json(state_path(run_id).read_text())


def new_run_id() -> str:
    return date.today().strftime("%m%d") + "-" + secrets.token_hex(3)


def _usage(state: RunState, res: llm.LLMResult | dict | None) -> None:
    if not res:
        return
    d = res if isinstance(res, dict) else {"model": res.model, "tokens_in": res.tokens_in,
                                           "tokens_out": res.tokens_out, "latency_s": res.latency_s,
                                           "cached": res.cached, "fallbacks": res.fallbacks}
    u = state.llm_usage.setdefault(d["model"], {"calls": 0, "cached_calls": 0, "tokens_in": 0, "tokens_out": 0,
                                                "latency_s": 0.0, "fallback_hops": 0})
    if d.get("cached"):  # served from the local cache: no tokens spent, no time waited
        u["cached_calls"] += 1
        return
    u["calls"] += 1
    u["tokens_in"] += d.get("tokens_in", 0)
    u["tokens_out"] += d.get("tokens_out", 0)
    u["latency_s"] = round(u["latency_s"] + d.get("latency_s", 0.0), 2)
    u["fallback_hops"] += len(d.get("fallbacks") or [])


# ----------------------------------------------------------------------------- PLAN

def plan(state: RunState) -> None:
    listing = files.list_files(state.input_dir)
    comps = yaml.safe_load((Path(state.input_dir) / "competitors.yaml").read_text())
    prompt = (
        f"GOAL: {state.goal}\n\nINPUT FOLDER ({state.input_dir}):\n"
        + "\n".join(f"- {f['path']} ({f['bytes']} bytes)" for f in listing)
        + "\n\nCOMPETITORS:\n" + "\n".join(f"- {c['name']} ({c['domain']})" for c in comps["competitors"])
        + "\n\nTOOLS:\n" + "\n".join(f"- {k}: {v}" for k, v in TOOL_DOCS.items())
        + "\n\nWrite the task list. Paths are relative to the input folder. Read every finance file once "
          "(invoices default to mode 'text'; ignore README/competitors.yaml), fetch every competitor, fetch jobs "
          "and classify titles for every competitor (needed for ML/AI), and order tasks so inputs exist before "
          "they are needed. One task per file or competitor action.")
    with neatlogs.trace("plan", kind="AGENT") as span:
        res = llm.complete("reason", prompt, schema=Plan,
                           system="You are the planner of a finance analysis agent. Be complete and concrete.")
        _usage(state, res)
        p: Plan = res.parsed
        state.plan_rationale = p.rationale
        for i, t in enumerate(p.tasks):
            args = {k: v for k, v in t.model_dump().items() if k not in ("tool", "reason") and v is not None}
            state.queue.append(Task(id=f"t{i + 1:02d}", tool=t.tool, args=args, reason=t.reason))
        span.set_attribute("spendradar.plan.tasks", len(state.queue))
        span.set_attribute("spendradar.plan.model", res.model)
        _verify_plan(state, listing, comps)
    state.phase = "execute"
    save(state)


def _verify_plan(state: RunState, listing: list[dict], comps: dict) -> None:
    """Coverage check: every invoice, the budget and every competitor must be in the plan."""
    with neatlogs.trace("verify:plan_coverage", kind="GUARDRAIL") as span:
        planned_paths = {t.args.get("path") for t in state.queue}
        planned_domains = {(t.tool, t.args.get("domain")) for t in state.queue}
        missing: list[Task] = []
        for f in listing:
            path = f["path"]
            if path.startswith("invoices/") and path not in planned_paths:
                missing.append(Task(id="", tool="read_invoice", args={"path": path, "mode": "text"},
                                    reason="added by plan coverage check"))
        for tool, fname in (("read_budget", "budget_fy27.xlsx"), ("read_policy", "policy.yaml"),
                            ("read_salary_table", "salary_table.csv")):
            if not any(t.tool == tool for t in state.queue):
                missing.append(Task(id="", tool=tool, args={"path": fname}, reason="added by plan coverage check"))
        for c in comps["competitors"]:
            for tool in ("fetch_competitor", "fetch_jobs", "classify_titles"):
                if (tool, c["domain"]) not in planned_domains:
                    missing.append(Task(id="", tool=tool, args={"name": c["name"], "domain": c["domain"]},
                                        reason="added by plan coverage check"))
        for j, t in enumerate(missing):
            t.id = f"c{j + 1:02d}"
            state.queue.append(t)
        state.checks.append(Check(name="verify:plan_coverage", target="plan", passed=not missing,
                                  detail=f"{len(missing)} tasks added: " + ", ".join(
                                      f"{t.tool}({t.args.get('path') or t.args.get('domain')})" for t in missing)))
        span.set_attribute("spendradar.plan.missing", len(missing))


# ----------------------------------------------------------------------------- ACT + OBSERVE + VERIFY

class NotReady(Exception):
    """Inputs for this task do not exist yet; defer it."""


def _src_file(state: RunState, path: str, locator: str = "") -> Source:
    return Source(kind="file", ref=f"{state.input_dir}/{path}", locator=locator)


def act(state: RunState, task: Task) -> list[Check]:
    """Run one task's tool, store observations with sources, return its checks."""
    a = task.args
    if task.tool == "read_budget":
        return _act_budget(state, a["path"], a.get("row"))
    if task.tool == "read_invoice":
        return _act_invoice(state, a["path"], a.get("mode") or "text")
    if task.tool == "read_policy":
        state.policy = yaml.safe_load((Path(state.input_dir) / a["path"]).read_text())
        return []
    if task.tool == "read_salary_table":
        with open(Path(state.input_dir) / a["path"]) as f:
            state.salary = {r["category"]: float(r["loaded_annual_cost_usd"]) for r in csv.DictReader(f)}
        return []
    if task.tool == "fetch_competitor":
        return _act_competitor(state, a["name"], a["domain"])
    if task.tool == "fetch_jobs":
        return _act_jobs(state, a["domain"], a.get("sample", "job_search"))
    if task.tool == "classify_titles":
        return _act_classify(state, a["domain"])
    raise ToolError(f"unknown tool {task.tool}")


def _act_budget(state: RunState, path: str, only_row: int | None = None) -> list[Check]:
    full = str(Path(state.input_dir) / path)
    rows = files.read_spreadsheet(full, "People", first_row=only_row or 1, last_row=only_row)
    months = [k for k in (rows[0].keys() if rows else []) if k[:2] == "20"]
    checks = []
    b = state.budget.setdefault("people_cost", {}), state.budget.setdefault("headcount_end", {})
    for r in rows:
        cat, loc = r["category"], f"People!row {r['_row']}"
        if r["metric"] == "headcount":
            b[1][cat] = r[months[-1]]
            state.figures[f"hc_{cat}"] = Figure(id=f"hc_{cat}", label=f"Acme {cat} headcount (end FY27)",
                                                value=r[months[-1]], unit="people", category=cat,
                                                sources=[_src_file(state, path, f"{loc}, {months[-1]}")])
        elif r["metric"] == "people_cost":
            parts = [float(r[m]) for m in months]
            chk = verify.totals_check(f"budget:{cat}", parts, float(r["FY total"]))
            chk.detail = f"{path} {loc}: {chk.detail}"
            checks.append(chk)
            # The line items are primary; a mismatching stated total is never used.
            b[0][cat] = sum(parts)
            state.figures[f"cost_{cat}"] = Figure(id=f"cost_{cat}", label=f"Acme {cat} people cost FY27",
                                                  value=sum(parts), category=cat,
                                                  sources=[_src_file(state, path, f"{loc}, sum of {len(months)} months")])
    nonpeople = files.read_spreadsheet(full, "NonPeople") if only_row is None else []
    for r in nonpeople:
        state.budget.setdefault("non_people", {})[r["category"]] = float(r["FY total"])
        state.budget.setdefault("monthly", {})[r["category"]] = float(r[months[0]])
    return checks


def _act_invoice(state: RunState, path: str, mode: str) -> list[Check]:
    out = files.read_pdf(str(Path(state.input_dir) / path), mode=mode)
    if out.get("llm"):
        _usage(state, out["llm"])
    ex = out["extract"]
    parts = [line["amount"] for line in ex["lines"]]
    chk = verify.totals_check(path, parts, ex["stated_total"])
    cat = CC_TO_CATEGORY.get(ex["cost_centre"].strip().lower(), "unmapped")
    state.invoices = [i for i in state.invoices if i["path"] != path]
    state.invoices.append({"path": path, "vendor": ex["vendor"], "number": ex["invoice_number"],
                           "date": ex["invoice_date"], "cost_centre": ex["cost_centre"], "category": cat,
                           "lines": ex["lines"], "line_sum": sum(parts), "stated_total": ex["stated_total"],
                           "parser": out["parser"], "totals_ok": chk.passed})
    fid = "inv_" + Path(path).stem
    state.figures[fid] = Figure(id=fid, label=f"{ex['vendor']} {ex['invoice_number']}", value=sum(parts),
                                category=cat, sources=[_src_file(state, path, f"line items, parser={out['parser']}")])
    return [chk]


def _act_competitor(state: RunState, name: str, domain: str) -> list[Check]:
    res = crustdata.crustdata_company(domain)
    state.crustdata_credits = crustdata.BUDGET.spent
    prof = analysis.profile_from_enrich(name, domain, res["company_data"], res["fetched_at"])
    if res.get("fixture"):
        prof.data_mode = state.data_mode = "fixture"
        state.notes.append(f"{name}: EVAL FIXTURE used ({res['fixture']['changed']} altered on purpose)")
    if res.get("stale_fallback"):
        state.notes.append(f"{name}: Crustdata failed ({res['errors'][-1]}); used cached response from {res['fetched_at']}")
    state.competitors[domain] = prof
    state.title_classes.setdefault("_samples", {}).setdefault(domain, {}).update({
        "recent_titles_csv": analysis.recent_titles(res["company_data"]), "fetched_at": res["fetched_at"]})
    checks = []
    for cat in analysis.ROLE_MAP:
        r = analysis.category_range(prof, cat)
        checks.append(Check(name="verify:signals", target=f"{name}:{cat}", passed=bool(r and r[2] >= 2),
                            detail=f"{r[2] if r else 0} signals"))
        ag = analysis.signal_agreement(prof, cat)
        if ag is not None:
            checks.append(Check(name="verify:agreement", target=f"{name}:{cat}", passed=ag >= 0.6,
                                detail=f"signals {r[0]:.0f}–{r[1]:.0f}, agreement {ag:.2f}"))
    if not prof.total_headcount:
        checks.append(Check(name="verify:has_data", target=name, passed=False, detail="no total headcount"))
    return checks


JOB_SAMPLES = {  # name -> (days back, job_details.category filter)
    "job_search": (365, None),
    "engineering_2y": (730, "Engineering"),
}


def _act_jobs(state: RunState, domain: str, sample: str = "job_search") -> list[Check]:
    days, category = JOB_SAMPLES[sample]
    since = (date.today() - timedelta(days=days)).isoformat()
    res = crustdata.crustdata_jobs(domain, since=since, category=category, limit=60)
    state.crustdata_credits = crustdata.BUDGET.spent
    titles = [t["title"] for t in res["titles"] if t["title"]]
    sm = state.title_classes.setdefault("_samples", {}).setdefault(domain, {})
    sm[sample] = titles
    sm[f"{sample}_fetched_at"] = res["fetched_at"]
    sm[f"{sample}_query"] = f"since {since}" + (f", category={category}" if category else "")
    return [Check(name="verify:has_data", target=f"jobs:{domain}", passed=len(titles) >= 5,
                  detail=f"{len(titles)} titles since {since} (total {res['total_count']})")]


def _act_classify(state: RunState, domain: str) -> list[Check]:
    prof = state.competitors.get(domain)
    sample = state.title_classes.get("_samples", {}).get(domain)
    if not prof or sample is None or "job_search" not in sample:
        raise NotReady(f"competitor/jobs data for {domain} not fetched yet")
    titles = sample.get("recent_titles_csv", []) + [t for k in JOB_SAMPLES for t in sample.get(k, [])]
    known = {t: v for t, v in state.title_classes.items() if not t.startswith("_")}
    todo = [t for t in set(titles) if t not in known]
    if todo:
        classes, usage = classify.classify_titles(todo)
        for u in usage:
            _usage(state, u)
        state.title_classes.update(classes)
    known = {t: v for t, v in state.title_classes.items() if not t.startswith("_")}
    fetched = sample.get("fetched_at", "")
    samples = {
        "recent_titles": (sample.get("recent_titles_csv", []),
                          Source(kind="crustdata", ref=f"/company/enrich?domain={domain}",
                                 locator="hiring.recent_titles_csv", fetched_at=fetched)),
    }
    for k in JOB_SAMPLES:
        if k in sample:
            samples[k] = (sample[k], Source(kind="crustdata", ref=f"/job/search?domain={domain}",
                                            locator=f"job_listings[].job_details.title ({sample.get(f'{k}_query', '')})",
                                            fetched_at=sample.get(f"{k}_fetched_at", fetched)))
    prof.signals = [s for s in prof.signals if s.category != "ml_ai"]
    analysis.add_ml_signals(prof, samples, known)
    r = analysis.category_range(prof, "ml_ai")
    return [Check(name="verify:signals", target=f"{prof.name}:ml_ai", passed=bool(r and r[2] >= 2),
                  detail=f"{r[2] if r else 0} ML/AI signals")]


# ----------------------------------------------------------------------------- DECIDE:RECOVERY

RECOVERY = {
    "reparse_alt": "Re-read the file with the other parser (text ↔ LLM reader).",
    "narrow_range": "Re-read only the failing row/range to rule out a parse slip.",
    "fetch_more_signal": "Fetch an extra independent signal (job postings) for this competitor.",
    "substitute_competitor": "Replace this competitor with the next substitute from competitors.yaml.",
    "mark_low_confidence": "Keep the data, flag it, and lower confidence in anything that uses it.",
    "skip": "Drop this input and list it under 'Not analysed'.",
}


def _options_for(task: Task, failure: str) -> tuple[list[str], str]:
    """Applicable recovery menu + what a fixed rule would do (the 'default')."""
    if task.tool == "read_invoice" and failure.startswith("tool_error"):
        return ["reparse_alt", "skip"], "skip"
    if task.tool == "read_invoice":
        return ["reparse_alt", "mark_low_confidence", "skip"], "mark_low_confidence"
    if task.tool == "read_budget":
        return ["narrow_range", "mark_low_confidence", "skip"], "mark_low_confidence"
    if task.tool == "fetch_competitor" and ("has_data" in failure or failure.startswith("tool_error")):
        return ["substitute_competitor", "skip"], "skip"
    if task.tool in ("fetch_competitor", "classify_titles"):
        # One weak category never justifies dropping a competitor's other categories.
        extra_done = task.parent is not None and task.reason.startswith("recovery: re-estimate")
        return (["mark_low_confidence"] if extra_done else ["fetch_more_signal", "mark_low_confidence"]), \
            "mark_low_confidence"
    if task.tool == "fetch_jobs":
        return ["mark_low_confidence", "skip"], "mark_low_confidence"
    return ["mark_low_confidence", "skip"], "skip"


def decide_recovery(state: RunState, task: Task, failure: str, detail: str) -> str:
    options, default = _options_for(task, failure)
    tools = [{"name": o, "description": RECOVERY[o], "parameters": {
        "type": "object", "properties": {"reason": {"type": "string", "description": "one line"}},
        "required": ["reason"]}} for o in options]
    prompt = (f"A step of the finance agent failed verification.\nTask: {task.tool} {json.dumps(task.args)}\n"
              f"Failure: {failure}\nDetail: {detail}\nAttempts so far: {task.attempts}\n"
              f"Previous decisions for this task: "
              f"{[d.chosen for d in state.decisions if d.task_id in (task.id, task.parent)]}\n"
              "Pick the recovery action most likely to produce a correct, sourced number. "
              "Do not repeat an action that already failed for this task.")
    with neatlogs.trace("decide:recovery", kind="AGENT") as span:
        span.set_attribute("spendradar.recovery.options", json.dumps(options))
        span.set_attribute("spendradar.recovery.default", default)
        span.set_attribute("spendradar.recovery.failure", f"{failure}: {detail}"[:500])
        try:
            choice = llm.choose("reason", prompt, tools,
                                system="You choose recovery actions for a finance analysis agent.")
            _usage(state, choice.result)
            chosen, reason, model = choice.name, choice.args.get("reason", ""), choice.result.model
        except llm.LLMError as e:
            chosen, reason, model = default, f"LLM unavailable, rule default used: {str(e)[:120]}", "rule"
        span.set_attribute("spendradar.recovery.chosen", chosen)
        span.set_attribute("spendradar.recovery.reason", reason[:300])
        span.set_attribute("spendradar.recovery.differs_from_default", chosen != default)
    state.decisions.append(RecoveryDecision(task_id=task.id, failed_check=f"{failure}: {detail}"[:300],
                                            options=options, chosen=chosen, reason=reason, model=model,
                                            default=default))
    return chosen


def apply_recovery(state: RunState, task: Task, chosen: str, detail: str) -> None:
    a = task.args
    fix = None
    if chosen == "reparse_alt":
        fix = Task(id=f"{task.id}r", tool=task.tool, args={**a, "mode": "llm" if a.get("mode", "text") == "text" else "text"},
                   reason="recovery: reparse_alt", parent=task.id, attempts=task.attempts)
    elif chosen == "narrow_range":
        m = re.search(r"row (\d+)", detail)
        row = int(m.group(1)) if m else None
        fix = Task(id=f"{task.id}n", tool=task.tool, args={**a, "row": row}, reason="recovery: narrow_range",
                   parent=task.id, attempts=task.attempts)
    elif chosen == "fetch_more_signal":
        dom = a.get("domain")
        fix = Task(id=f"{task.id}m", tool="fetch_jobs", args={"domain": dom, "sample": "engineering_2y"},
                   reason="recovery: fetch_more_signal (different sample: engineering postings, 2 years)",
                   parent=task.id, attempts=task.attempts)
        state.queue.insert(0, Task(id=f"{task.id}mc", tool="classify_titles", args={"domain": dom},
                                   reason="recovery: re-estimate after extra signal", parent=task.id,
                                   attempts=task.attempts))
    elif chosen == "substitute_competitor":
        _substitute(state, task)
    elif chosen == "mark_low_confidence":
        state.flags.append({"task": task.id, "target": a.get("path") or a.get("domain"), "issue": detail})
    elif chosen == "skip":
        state.not_analysed.append({"input": a.get("path") or a.get("domain"), "reason": detail})
        if task.tool == "fetch_competitor":
            state.competitors.pop(a.get("domain"), None)
    if fix:
        state.queue.insert(0, fix)


def _substitute(state: RunState, task: Task) -> None:
    comps = yaml.safe_load((Path(state.input_dir) / "competitors.yaml").read_text())
    used = set(state.competitors) | {n["input"] for n in state.not_analysed}
    sub = next((s for s in comps.get("substitutes", []) if s["domain"] not in used), None)
    dropped = task.args.get("domain")
    old = state.competitors.pop(dropped, None)
    dropped_name = task.args.get("name") or (old.name if old else dropped)
    state.not_analysed.append({"input": dropped, "reason": "replaced by substitute competitor"})
    if sub:
        state.notes.append(f"{dropped_name} replaced by {sub['name']} (substitute list order)")
        for i, tool in enumerate(("fetch_competitor", "fetch_jobs", "classify_titles")):
            state.queue.insert(i, Task(id=f"{task.id}s{i}", tool=tool, args={"name": sub["name"], "domain": sub["domain"]},
                                       reason=f"recovery: substitute for {dropped_name}", parent=task.id))


# ----------------------------------------------------------------------------- EXECUTE

def execute(state: RunState) -> None:
    deferrals: dict[str, int] = {}
    while state.queue:
        task = state.queue.pop(0)
        task.attempts += 1
        if task.attempts > MAX_ATTEMPTS:
            task.status = "failed"
            state.not_analysed.append({"input": task.args.get("path") or task.args.get("domain"),
                                       "reason": f"retry cap ({MAX_ATTEMPTS}) reached"})
            state.done.append(task)
            save(state)
            continue
        try:
            checks = act(state, task)
            failure = None
        except NotReady as e:
            deferrals[task.id] = deferrals.get(task.id, 0) + 1
            task.attempts -= 1
            if deferrals[task.id] <= len(state.queue) + 1:
                state.queue.append(task)
                continue
            checks, failure = [], f"tool_error: {e}"
        except (ToolError, llm.LLMError) as e:
            checks, failure = [], f"tool_error: {e}"
        state.checks.extend(checks)
        bad = [c for c in checks if not c.passed]
        if failure is None and bad:
            failure = f"{bad[0].name} failed"
        if failure:
            detail = failure if failure.startswith("tool_error") else "; ".join(f"{c.target}: {c.detail}" for c in bad)
            with neatlogs.trace(f"verify:{task.tool}", kind="GUARDRAIL") as span:
                span.set_attribute("spendradar.verify.passed", False)
                span.set_attribute("spendradar.verify.detail", detail[:500])
            if task.attempts >= MAX_ATTEMPTS:
                chosen = "mark_low_confidence" if not failure.startswith("tool_error") else "skip"
            else:
                chosen = decide_recovery(state, task, failure.split(":")[0] if failure.startswith("tool_error") else failure,
                                         detail)
            apply_recovery(state, task, chosen, detail)
            task.status = "failed"
        else:
            task.status = "done"
        state.done.append(task)
        save(state)
    _cross_document_checks(state)
    state.phase = "audit"
    save(state)


def _cross_document_checks(state: RunState) -> None:
    """Same vendor billed to different categories → flag (catches mis-categorised invoices)."""
    with neatlogs.trace("verify:vendor_category_consistency", kind="GUARDRAIL"):
        by_vendor: dict[str, set[str]] = {}
        for inv in state.invoices:
            by_vendor.setdefault(inv["vendor"], set()).add(inv["category"])
        for vendor, cats in by_vendor.items():
            ok = len(cats) == 1
            state.checks.append(Check(name="verify:vendor_category", target=vendor, passed=ok,
                                      detail=f"categories {sorted(cats)}"))
            if not ok:
                state.flags.append({"task": "cross-document", "target": vendor,
                                    "issue": f"vendor billed to {sorted(cats)}; likely mis-categorised invoice"})


# ----------------------------------------------------------------------------- FINDINGS

def build_findings(state: RunState) -> None:
    ours_all = analysis.our_position(state.budget)
    profiles = list(state.competitors.values())
    rules = {r["category"]: r for r in state.policy.get("rules", [])}
    state.findings = []
    for cat in ("engineering", "ml_ai", "sales", "marketing"):
        rule = rules.get(cat)
        shares = analysis.competitor_shares(profiles, cat)
        if not rule or cat not in ours_all:
            continue
        res = analysis.compare({**ours_all[cat], "_total": ours_all["_total"]}, shares, rule, state.salary.get(cat, 0))
        if res["status"] != "ok":
            state.notes.append(f"{cat}: no competitor data for comparison")
            continue
        n_sig = [s["signals"] for s in shares]
        agreements = [a for p in profiles if (a := analysis.signal_agreement(p, cat)) is not None]
        ages = [analysis.days_old(s.as_of) for p in profiles for s in p.signals if s.category == cat]
        rel = [c for c in state.checks if c.target.endswith(f":{cat}") or c.target == f"budget:{cat}"]
        conf, inputs = verify.confidence(sum(c.passed for c in rel), len(rel), min(n_sig),
                                         min(agreements) if agreements else None, max(ages) if ages else 0)
        fid = f"f_{cat}"
        state.figures[f"{fid}_median"] = Figure(
            id=f"{fid}_median", label=f"Competitor median {cat} share of headcount", unit="share",
            value=res["median_mid"], category=cat, estimate=True,
            sources=[s.source for p in profiles for s in p.signals if s.category == cat])
        g0, g1 = res["gap_usd"]
        verdict = "violates" if res["violated"] else "meets"
        state.findings.append(Finding(
            id=fid, category=cat, kind="policy",
            statement=(f"Acme {cat} is {res['our_share']:.1%} of headcount vs competitor median "
                       f"{res['median_low']:.1%}–{res['median_high']:.1%} ({res['n_competitors']} companies); "
                       f"{verdict} policy '{rule['text']}'. Matching the median would mean "
                       f"{res['gap_heads'][0]:+.0f} to {res['gap_heads'][1]:+.0f} people, "
                       f"≈ ${g0:,.0f} to ${g1:,.0f} a year at Acme's loaded cost (estimate)."),
            ours=ours_all[cat]["share"], theirs_low=res["median_low"], theirs_high=res["median_high"],
            policy_violated=res["violated"], figure_ids=[f"hc_{cat}", f"cost_{cat}", f"{fid}_median"],
            confidence=conf, confidence_inputs=inputs))
    _internal_findings(state)
    save(state)


def _internal_findings(state: RunState) -> None:
    seen: set[str] = set()
    for c in state.checks:
        if c.name == "verify:totals" and not c.passed and c.target not in seen:
            seen.add(c.target)
            state.findings.append(Finding(id=f"f_totals_{len(state.findings)}", category="internal", kind="internal",
                                          statement=f"Totals mismatch in {c.target}: {c.detail}. Line items used.",
                                          confidence=1.0, confidence_inputs={"checks": "deterministic"}))
    for fl in state.flags:
        if "mis-categorised" in fl["issue"]:
            state.findings.append(Finding(id=f"f_cat_{len(state.findings)}", category="internal", kind="internal",
                                          statement=f"{fl['target']}: {fl['issue']}.", confidence=0.0,
                                          confidence_inputs={"checks": "needs audit"}))
    infra = [i for i in state.invoices if i["category"] == "infra_cloud"]
    monthly = state.budget.get("monthly", {}).get("infra_cloud")
    rule = next((r for r in state.policy.get("rules", []) if r["category"] == "infra_cloud"), None)
    if infra and monthly and rule:
        over = [i for i in infra if i["line_sum"] > monthly * (1 + rule["pct"] / 100)]
        state.findings.append(Finding(
            id="f_infra_cloud", category="infra_cloud", kind="internal",
            statement=(f"{len(over)} of {len(infra)} infra/cloud invoices exceed the monthly budget "
                       f"${monthly:,.0f} by more than {rule['pct']}%"
                       + (": " + ", ".join(f"{i['number']} ${i['line_sum']:,.0f}" for i in over) if over else "") + "."),
            policy_violated=bool(over), figure_ids=["inv_" + Path(i["path"]).stem for i in infra],
            confidence=1.0, confidence_inputs={"checks": "deterministic, internal data"}))


# ----------------------------------------------------------------------------- driver

def run_phases(state: RunState) -> RunState:
    with neatlogs.trace("spendradar_run", kind="WORKFLOW", session_id=state.run_id) as root:
        tid = format(root.get_span_context().trace_id, "032x")
        state.trace_id = state.trace_id or tid
        state.trace_ids.append(tid)
        root.set_attribute("spendradar.run_id", state.run_id)
        root.set_attribute("spendradar.resumed_at_phase", state.phase)
        if state.phase == "plan":
            plan(state)
        if state.phase == "execute":
            execute(state)
        if state.phase == "audit":
            build_findings(state)
            audit.self_audit(state)
            state.phase = "report"
            save(state)
        if state.phase == "report":
            with neatlogs.trace("report", kind="CHAIN"):
                report.write(state)
            state.phase = "done"
            save(state)
        state.injected = faults.active()
        state.faults_fired = list(faults.fired)
    return state


def new_state(input_dir: str, tags: list[str], sha: str, run_id: str) -> RunState:
    return RunState(run_id=run_id, goal=GOAL, input_dir=input_dir, git_sha=sha, tags=tags,
                    injected=faults.active())
