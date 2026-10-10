"""Markdown report. Every number links to a numbered source; unsourced numbers are not printed."""

from __future__ import annotations

from pathlib import Path

from spendradar import llm
from spendradar.models import Figure, RunState, Source

LABEL = {"engineering": "Engineering", "ml_ai": "ML/AI", "sales": "Sales", "marketing": "Marketing",
         "infra_cloud": "Infra/cloud", "internal": "Internal checks"}


class _Refs:
    def __init__(self) -> None:
        self.items: list[Source] = []
        self.index: dict[str, int] = {}

    def cite(self, src: Source) -> str:
        key = f"{src.kind}|{src.ref}|{src.locator}"
        if key not in self.index:
            self.items.append(src)
            self.index[key] = len(self.items)
        return f"[{self.index[key]}]"

    def cite_fig(self, fig: Figure | None) -> str:
        return "".join(sorted({self.cite(s) for s in fig.sources})) if fig and fig.sources else ""


def write(state: RunState) -> Path:
    refs = _Refs()
    out: list[str] = []
    mode = "FIXTURE (eval only)" if state.data_mode == "fixture" else "real data"
    providers = sorted({m for m in state.llm_usage})
    out += [f"# Spend Radar report — Acme Observability Inc. (fictional)", "",
            f"- Run `{state.run_id}` · commit `{state.git_sha}` · neatlogs trace `{state.trace_id}`",
            f"- **Data mode: {mode}** · LLM models used: {', '.join(providers) or 'none'}"
            + (f" · **injected faults: {', '.join(state.injected)}**" if state.injected else ""),
            "- Competitor comparison is **people cost only** (headcount × Acme's loaded cost, an estimate). "
            "Infra/cloud is checked against Acme's own budget only.", ""]

    live = [f for f in state.findings if f.status != "overturned"]
    out += ["## Findings", "", "| Area | Finding | Policy | Confidence | Audit |", "|---|---|---|---|---|"]
    for f in live:
        cites = "".join(refs.cite_fig(state.figures.get(fid)) for fid in f.figure_ids)
        if f.kind == "policy" and not cites:
            continue  # a number without a source never reaches the report
        pol = "—" if f.policy_violated is None else ("**violated**" if f.policy_violated else "met")
        out.append(f"| {LABEL.get(f.category, f.category)} | {f.statement} {cites} | {pol} | {f.confidence:.2f} "
                   f"| {f.status} |")
    out.append("")

    over = [f for f in state.findings if f.status == "overturned"]
    out += ["## Overturned claims", ""]
    if not over:
        out += ["None this run. Every finding above survived the self-audit.", ""]
    for f in over:
        out += [f"- **{LABEL.get(f.category, f.category)}**: ~~{f.statement}~~"]
        out += [f"  - {n}" for n in f.audit_notes]
    out.append("")

    out += ["## Competitor evidence", "", "| Company | Category | Signal | Headcount | As of | Source |",
            "|---|---|---|---|---|---|"]
    for p in state.competitors.values():
        tot = Source(kind="crustdata", ref=f"/company/enrich?domain={p.domain}", locator="headcount.total",
                     fetched_at=p.total_as_of)
        out.append(f"| {p.name}{' (substitute)' if p.substitute_for else ''} | total | headcount.total | "
                   f"{p.total_headcount} | {p.total_as_of} | {refs.cite(tot)} |")
        for s in p.signals:
            out.append(f"| {p.name} | {LABEL.get(s.category, s.category)} | {s.name} | {s.headcount:.0f} | {s.as_of} "
                       f"| {refs.cite(s.source)}{' — ' + s.source.note if s.source.note else ''} |")
        if p.missing:
            out.append(f"| {p.name} | — | missing | — | — | {'; '.join(p.missing)} |")
    out.append("")

    out += ["## Acme's own numbers", "", "| Category | Headcount (end FY27) | People cost FY27 | Source |",
            "|---|---|---|---|"]
    for cat in ("engineering", "ml_ai", "sales", "marketing", "other"):
        hc, cost = state.figures.get(f"hc_{cat}"), state.figures.get(f"cost_{cat}")
        if hc and cost:
            out.append(f"| {LABEL.get(cat, cat)} | {hc.value:.0f} | ${cost.value:,.0f} | "
                       f"{refs.cite_fig(hc)}{refs.cite_fig(cost)} |")
    out += ["", "| Invoice | Vendor | Cost centre → category | Line items | Stated total | Parser | Source |",
            "|---|---|---|---|---|---|---|"]
    for inv in sorted(state.invoices, key=lambda i: i["path"]):
        fig = state.figures.get("inv_" + Path(inv["path"]).stem)
        flag = "" if inv["totals_ok"] else " ⚠️ mismatch"
        out.append(f"| {inv['number']} | {inv['vendor']} | {inv['cost_centre']} → {inv['category']} | "
                   f"${inv['line_sum']:,.2f} | ${inv['stated_total']:,.2f}{flag} | {inv['parser']} | {refs.cite_fig(fig)} |")
    out.append("")

    if state.flags or state.not_analysed or state.notes:
        out += ["## Flags, gaps and notes", ""]
        out += [f"- ⚠️ {fl['target']}: {fl['issue']}" for fl in state.flags]
        out += [f"- Not analysed: `{n['input']}` — {n['reason']}" for n in state.not_analysed]
        out += [f"- {n}" for n in state.notes]
        out.append("")

    if state.decisions:
        out += ["## How the agent recovered", "", "| Task | Failure | Options | Chosen | Rule default | Why |",
                "|---|---|---|---|---|---|"]
        for d in state.decisions:
            out.append(f"| {d.task_id} | {d.failed_check[:90]} | {', '.join(d.options)} | **{d.chosen}** | {d.default} "
                       f"| {d.reason[:140]} ({d.model}) |")
        out.append("")

    out += ["## Confidence formula", "",
            "`confidence = checks × signals × freshness`, computed in `spendradar/verify.py` from this run's "
            "checks (passed/total), number and agreement of independent signals, and age of the oldest input. "
            "Audit downgrades halve it; overturns zero it.", ""]
    out += ["## Sources", ""]
    for i, s in enumerate(refs.items, 1):
        out.append(f"{i}. {s.kind}: `{s.ref}` {s.locator} (fetched {s.fetched_at[:19]}){' — ' + s.note if s.note else ''}")
    out.append("")

    usage = ", ".join(f"{m}: {u['calls']} calls, {u['tokens_in']}+{u['tokens_out']} tokens"
                      for m, u in state.llm_usage.items())
    out += ["## Run cost", "", f"- LLM: {usage or 'none'}", f"- Crustdata credits (this run): {state.crustdata_credits:.2f}",
            f"- LLM response cache: {'on' if llm.cache_enabled() else 'off'}", ""]

    path = Path("runs") / state.run_id / "report.md"
    path.write_text("\n".join(out))
    return path
