"""`spendradar explain <trace_id>`: from a neatlogs span to the agent session that wrote the code.

Spend Radar shows a source for every number. `explain` does the same for the agent's own
behaviour. For each failing (or chosen) span in a run's trace it builds a dossier:

  neatlogs span (input, output, error)
    → code location (the span's name is a fixed string in our source; indexed below)
    → `entire why <file>:<line>`  : commit, Entire checkpoint, coding-agent session, model, prompt
    → `entire graph impact`       : who calls it, what it depends on (blast radius of a fix)

neatlogs' selective span fields (code_filepath/lineno) are disabled server-side for now
("NL-1924"), so the span→code step uses our own index of `neatlogs.trace(...)`,
`@neatlogs.span(...)` and `record_error(...)` call sites. When the span reports an error,
the line is refined to where that error message is raised.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from spendradar.provenance import ENTIRE_COMMIT_URL, _owner_repo
from spendradar.tracing import scrub_text

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "evidence" / "explain"
NEATLOGS_TRACE_URL = "https://app.neatlogs.com/traces/{trace_id}"

_TRACE = re.compile(r'neatlogs\.trace\(\s*(f?)"([^"]+)"')
_SPAN = re.compile(r'@neatlogs\.span\([^)]*tool_name="(\w+)"')
_RECORD = re.compile(r'record_error\(\s*(f?)"([^"]+)"')
_DEF = re.compile(r"^\s*def (\w+)\(")


@dataclass
class Site:
    name: str  # exact span name, or a prefix when `prefix` (from an f-string such as f"audit:{f.id}")
    prefix: bool
    file: str  # repo-relative
    line: int
    function: str


def _enclosing_def(lines: list[str], idx: int) -> str:
    for i in range(idx, -1, -1):
        if m := _DEF.match(lines[i]):
            return m.group(1)
    return ""


def span_index(root: Path = ROOT) -> list[Site]:
    """Every place our code opens a named neatlogs span."""
    sites: list[Site] = []
    for path in sorted((root / "spendradar").rglob("*.py")):
        rel = path.relative_to(root).as_posix()
        lines = path.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            for rx in (_TRACE, _RECORD):
                if m := rx.search(line):
                    is_f, name = m.group(1) == "f", m.group(2)
                    if is_f:
                        name = name.split("{")[0]
                    if name:
                        sites.append(Site(name, is_f, rel, i + 1, _enclosing_def(lines, i)))
            if m := _SPAN.search(line):  # tool spans are named by tool_name; the def follows the decorators
                j = next((k for k in range(i + 1, min(i + 6, len(lines))) if _DEF.match(lines[k])), i)
                sites.append(Site(m.group(1), False, rel, j + 1, _DEF.match(lines[j]).group(1) if j != i else ""))
    return sites


def locate(span_name: str, sites: list[Site]) -> Site | None:
    exact = [s for s in sites if not s.prefix and s.name == span_name]
    if exact:
        return exact[0]
    pre = sorted((s for s in sites if s.prefix and span_name.startswith(s.name)), key=lambda s: -len(s.name))
    return pre[0] if pre else None


def _error_text(span: dict) -> str:
    out = span.get("output_value") or ""
    m = re.search(r"(?:^|\n)error:\s*(.+)", out, re.I) or re.search(r'"error"\s*:\s*"([^"]+)', out)
    return (m.group(1) if m else "").strip()


def refine_line(site: Site, error: str, root: Path = ROOT) -> int:
    """Move to the line that raises this error, if the message's fixed text appears in the file."""
    msg = re.sub(r"^\w+(Error|Exception):\s*", "", error)
    stem = re.split(r"[:{(]", msg)[0].strip()
    if len(stem) < 8:
        return site.line
    for i, line in enumerate((root / site.file).read_text(encoding="utf-8").splitlines()):
        if stem in line:
            return i + 1
    return site.line


def _run(cmd: list[str], root: Path = ROOT) -> str:
    try:
        return subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=120).stdout
    except Exception as e:  # entire not installed / timeout: the dossier says so instead of failing
        return f"({cmd[0]} unavailable: {type(e).__name__})"


def entire_why(file: str, line: int) -> dict:
    out = _run(["entire", "why", f"{file}:{line}", "--json"])
    try:
        return json.loads(out).get("line", {})
    except ValueError:
        return {"error": out.strip()[:300]}


def graph_impact(function: str) -> str:
    """The impact summary plus the callers list: what a fix to this function can break."""
    if not function:
        return ""
    out = _run(["entire", "graph", "impact", "--repo", ".", "--symbol", function])
    keep, in_callers = [], False
    for ln in out.splitlines():
        if ln.startswith(("Impact:", "Blast radius:")):
            keep.append(ln)
        elif ln.startswith("Callers"):
            in_callers = True
            keep.append(ln)
        elif in_callers and ln.startswith("- "):
            if "evidence/explain/" not in ln:  # our own dossiers mention the symbol; they are not callers
                keep.append(ln)
        elif in_callers:
            in_callers = False
    return "\n".join(keep[:12])


def _clip(text: str, n: int) -> str:
    text = scrub_text(text or "")
    return text if len(text) <= n else text[:n] + f"… [{len(text) - n} more chars]"


def locate_span(span: dict, by_id: dict[str, dict], sites: list[Site]) -> tuple[Site | None, str]:
    """Our code site for a span; auto-instrumented spans (LLM calls) resolve via their nearest ancestor."""
    cur, hops = span, 0
    while cur is not None and hops < 20:
        if (site := locate(cur["name"], sites)):
            return site, ("" if cur is span else cur["name"])
        cur, hops = by_id.get(cur.get("parent_span_id") or ""), hops + 1
    return None, ""


def dossier(trace_id: str, span: dict, site: Site | None, via: str = "") -> str:
    err = _error_text(span)
    lines = [f"## `{span['name']}` — {span.get('status', '')}", "",
             f"- neatlogs: trace [`{trace_id}`]({NEATLOGS_TRACE_URL.format(trace_id=trace_id)}), span `{span.get('span_id', '')}`"
             + (f" (an auto-instrumented call inside `{via}`)" if via else "")]
    if span.get("input_value"):
        lines.append(f"- Input: `{_clip(span['input_value'], 300)}`")
    if span.get("output_value"):
        lines.append(f"- Output: `{_clip(span['output_value'], 300)}`")
    if not site:
        return "\n".join(lines + ["- Code: no span site found in `spendradar/` (third-party or auto-instrumented span)", ""])
    line = refine_line(site, err) if err else site.line
    lines.append(f"- Code: `{site.file}:{line}` in `{site.function}()`"
                 + (" (the line that raises this error)" if line != site.line else ""))
    why = entire_why(site.file, line)
    if why.get("commit_sha"):
        url = ""
        if (orr := _owner_repo()):
            url = ENTIRE_COMMIT_URL.format(owner=orr[0], repo=orr[1], sha=why["commit_sha"])
        lines += [
            f"- Written by: **{why.get('agent', '?')}** ({why.get('model', '?')}), authorship `{why.get('authorship', '?')}`, "
            f"{why.get('author_time', '')}",
            f"- Commit `{why.get('short_commit_sha', '')}` · Entire checkpoint "
            + (f"[`{why.get('checkpoint_id', '')}`]({url})" if url else f"`{why.get('checkpoint_id', '')}`")
            + f" · session `{why.get('session_id', '')}`",
            "- Prompt that produced this line (scrubbed, clipped):", "",
            "  > " + _clip(why.get("prompt", ""), 450).replace("\n", "\n  > "), ""]
    elif why.get("error"):
        lines.append(f"- entire why: {why['error']}")
    impact = graph_impact(site.function)
    if impact:
        lines += ["- Blast radius (`entire graph impact`):", "", "```", impact, "```", ""]
    return "\n".join(lines)


def explain(trace_id: str, span_names: list[str] | None = None, max_spans: int = 6, client=None) -> Path:
    from spendradar.neatlogs_mcp import NeatlogsMCP

    mcp = client or NeatlogsMCP()
    trace = mcp.trace_spans(trace_id)
    spans = trace.get("spans", [])
    if span_names:
        chosen = [s for s in spans if s["name"] in span_names]
    else:  # failures, one per distinct span name and error
        chosen = [s for s in spans if s.get("status") == "ERROR" and not s.get("is_root")]
    seen, picked = set(), []
    for s in chosen:
        key = (s["name"], _error_text(s)[:80])
        if key not in seen:
            seen.add(key)
            picked.append(s)
    sites = span_index()
    body = [f"# Explain trace `{trace_id}`", "",
            f"- Trace: `{trace.get('name', '')}`, status {trace.get('status', '')}, {trace.get('span_count', len(spans))} spans",
            f"- Spans explained: {len(picked[:max_spans])} of {len(picked)} "
            + ("matching " + ", ".join(span_names) if span_names else "failing spans (one per name and error)"),
            "- Chain: neatlogs span → code line → `entire why` (commit, checkpoint, agent session, prompt) "
            "→ `entire graph impact`", ""]
    by_id = {s["span_id"]: s for s in spans}
    body += [dossier(trace_id, s, *locate_span(s, by_id, sites)) for s in picked[:max_spans]]
    OUT.mkdir(parents=True, exist_ok=True)
    tag = (span_names[0].replace(":", "-") if span_names else "errors")
    path = OUT / f"{trace_id[:12]}-{tag}.md"
    path.write_text("\n".join(body) + "\n", encoding="utf-8")
    return path
