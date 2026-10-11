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
    co = state.company
    out += [f"# Spend Radar report — {co}" + (" (fictional)" if state.company_fictional else ""), "",
            f"- Run `{state.run_id}` · commit `{state.git_sha}` · neatlogs trace `{state.trace_id}`",
            f"- **Data mode: {mode}** · LLM models used: {', '.join(providers) or 'none'}"
            + (f" · **injected faults: {', '.join(state.injected)} (fired: {', '.join(state.faults_fired) or 'none'})**"
               if state.injected else ""),
            f"- Competitor comparison is **people cost only** (headcount × {co}'s loaded cost, an estimate). "
            f"Infra/cloud is checked against {co}'s own budget only.", ""]

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

    out += [f"## {co}'s own numbers", "", "| Category | Headcount (end FY27) | People cost FY27 | Source |",
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
    path.write_text("\n".join(out), encoding="utf-8")
    write_html(path)
    return path


HTML_HEAD = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Spend Radar report</title><style>
:root{--bg:#fbfaf7;--fg:#1d1f21;--muted:#5d6166;--line:#dedbd3;--accent:#2f5d8a;--bad:#a33a2b;--ok:#2e6b3f}
@media (prefers-color-scheme: dark){:root{--bg:#141618;--fg:#e8e6e1;--muted:#a3a7ac;--line:#30343a;--accent:#8ab4e0;--bad:#e3826f;--ok:#7fc495}}
body{background:var(--bg);color:var(--fg);font:15px/1.55 ui-sans-serif,system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:1.6rem}h2{margin-top:2rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;font-size:.9rem}
th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}th{background:color-mix(in srgb,var(--line) 40%,transparent)}
code{font-size:.85em}del{color:var(--muted)}strong{color:var(--accent)}a{color:var(--accent)}
</style></head><body>"""


def write_html(md_path: Path) -> Path:
    import markdown

    body = markdown.markdown(md_path.read_text(encoding="utf-8"), extensions=["tables"])
    body = body.replace("<strong>violated</strong>", '<strong style="color:var(--bad)">violated</strong>')
    out = md_path.with_suffix(".html")
    out.write_text(HTML_HEAD + body + "</body></html>", encoding="utf-8")
    return out
