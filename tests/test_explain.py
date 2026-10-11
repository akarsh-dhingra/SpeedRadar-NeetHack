"""Offline tests for `spendradar explain` (no neatlogs, no entire calls)."""

from spendradar import explain


def test_span_index_finds_every_kind_of_site():
    sites = explain.span_index()
    names = {(s.name, s.prefix) for s in sites}
    assert ("decide:recovery", False) in names
    assert ("read_pdf", False) in names  # @neatlogs.span(tool_name=...)
    assert ("audit:", True) in names  # f"audit:{f.id}"
    assert ("verify:budget_headcount", False) in names  # record_error("...")


def test_locate_prefers_exact_then_longest_prefix():
    sites = explain.span_index()
    assert explain.locate("verify:plan_coverage", sites).function == "_verify_plan"
    assert explain.locate("audit:f_ml_ai", sites).function == "self_audit"
    assert explain.locate("read_pdf", sites).function == "read_pdf"
    assert explain.locate("gpt-5-nano-2025-08-07", sites) is None


def test_llm_span_resolves_through_its_parent():
    sites = explain.span_index()
    spans = {"p": {"span_id": "p", "name": "decide:recovery", "parent_span_id": "r"},
             "r": {"span_id": "r", "name": "spendradar_run", "parent_span_id": None}}
    llm_span = {"span_id": "c", "name": "gpt-5-nano-2025-08-07", "parent_span_id": "p"}
    site, via = explain.locate_span(llm_span, spans, sites)
    assert site.function == "decide_recovery" and via == "decide:recovery"


def test_error_line_is_refined_to_the_raise():
    sites = explain.span_index()
    site = explain.locate("read_pdf", sites)
    err = explain._error_text({"output_value": '{"error":"ToolError: corrupt PDF, not sent to the LLM reader: x"}'})
    line = explain.refine_line(site, err)
    src = (explain.ROOT / site.file).read_text().splitlines()[line - 1]
    assert "corrupt PDF, not sent to the LLM reader" in src


def test_dossier_prompt_is_scrubbed(monkeypatch):
    fake_key = "sk-or-" + "A1b2C3d4" * 4
    monkeypatch.setattr(explain, "entire_why", lambda f, l: {
        "commit_sha": "a" * 40, "short_commit_sha": "aaaaaaaa", "checkpoint_id": "01ABC", "session_id": "s",
        "agent": "Claude Code", "model": "m", "authorship": "ai", "prompt": f"use key {fake_key} please"})
    monkeypatch.setattr(explain, "graph_impact", lambda fn: "")
    site = explain.locate("read_pdf", explain.span_index())
    text = explain.dossier("t" * 32, {"name": "read_pdf", "status": "ERROR", "span_id": "x"}, site)
    assert fake_key not in text and "***" in text and "01ABC" in text
