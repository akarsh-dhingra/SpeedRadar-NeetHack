import pytest

from spendradar import agent, verify
from spendradar.models import RunState, Task


def test_recovery_menus():
    t = Task(id="t", tool="read_invoice", args={"path": "x.pdf"})
    assert agent._options_for(t, "tool_error") == (["reparse_alt", "skip"], "reparse_alt")
    t_llm = Task(id="t", tool="read_invoice", args={"path": "x.pdf", "mode": "llm"})
    assert agent._options_for(t_llm, "tool_error") == (["reparse_alt", "skip"], "skip")
    assert agent._options_for(Task(id="t", tool="fetch_jobs"), "tool_error")[0] == ["mark_low_confidence", "skip"]
    assert agent._options_for(Task(id="t", tool="fetch_competitor"), "verify:has_data failed")[0] == [
        "substitute_competitor", "skip"]
    weak = agent._options_for(Task(id="t", tool="classify_titles"), "verify:signals failed")[0]
    assert "fetch_more_signal" in weak and "substitute_competitor" not in weak
    after_extra = Task(id="t19mc", tool="classify_titles", parent="t19", reason="recovery: re-estimate after extra signal")
    assert agent._options_for(after_extra, "verify:signals failed")[0] == ["mark_low_confidence"]


def test_narrow_range_reads_row_from_detail():
    s = RunState(run_id="x", goal="g", input_dir="data/acme")
    t = Task(id="t03", tool="read_budget", args={"path": "budget_fy27.xlsx"}, attempts=1)
    agent.apply_recovery(s, t, "narrow_range", "budget_fy27.xlsx People!row 13: line items sum 1 vs stated 2")
    assert s.queue[0].args["row"] == 13 and s.queue[0].parent == "t03"


def test_confidence_formula():
    c, inputs = verify.confidence(3, 4, 2, 0.8, 30)
    assert c == pytest.approx(0.75 * 0.8 * 1.0)
    assert verify.freshness(365) == 0.5 and verify.freshness(90) == 1.0
    c1, _ = verify.confidence(1, 1, 1, None, 0)  # one signal only → halved
    assert c1 == pytest.approx(0.25)


def test_totals_check_tolerance():
    assert verify.totals_check("x", [50, 50], 100.5).passed
    assert not verify.totals_check("x", [50, 50], 102).passed


def test_cached_llm_calls_add_no_tokens_or_latency():
    s = RunState(run_id="x", goal="g", input_dir="d")
    agent._usage(s, {"model": "m", "tokens_in": 10, "tokens_out": 5, "latency_s": 100.0, "cached": True})
    agent._usage(s, {"model": "m", "tokens_in": 1, "tokens_out": 2, "latency_s": 3.0, "cached": False})
    assert s.llm_usage["m"] == {"calls": 1, "cached_calls": 1, "tokens_in": 1, "tokens_out": 2, "latency_s": 3.0,
                                "fallback_hops": 0}


def test_gap_sentence_reads_plainly():
    below = agent._gap_sentence((-17, -14), (-2.4e6, -2.0e6))
    assert "17 fewer to 14 fewer people" in below and "$-" not in below
    inside = agent._gap_sentence((-6, 6), (-1.1e6, 1.07e6), "Kestrel Metrics Inc.")
    assert inside.startswith("Kestrel Metrics Inc. is inside") and "$-" not in inside and "Acme" not in inside


def test_agreement_failure_needs_no_llm_and_equal_gap_collapses():
    t = Task(id="t20", tool="fetch_competitor", args={"domain": "sentry.io"})
    assert agent._options_for(t, "verify:agreement failed") == (["mark_low_confidence"], "mark_low_confidence")
    s = RunState(run_id="x", goal="g", input_dir="d")
    assert agent.decide_recovery(s, t, "verify:agreement failed", "Sentry:marketing 19–95") == "mark_low_confidence"
    assert s.decisions[-1].model == "rule"
    assert "10 fewer people" in agent._gap_sentence((-10, -10), (-1.5e6, -1.5e6))


def test_planner_paths_are_normalised():
    assert agent._normalise_path("data/acme", "data/acme/invoices/01.pdf") == "invoices/01.pdf"
    assert agent._normalise_path("data/acme", "./data/acme/budget_fy27.xlsx") == "budget_fy27.xlsx"
    assert agent._normalise_path("data/acme", "invoices/01.pdf") == "invoices/01.pdf"


def test_missing_file_in_llm_mode_is_a_tool_error():
    from spendradar.tools import files

    with pytest.raises(files.ToolError, match="cannot read file"):
        files.read_pdf("data/acme/does_not_exist.pdf", mode="llm")


def test_corrupt_pdf_in_llm_mode_fails_without_an_llm_call(monkeypatch):
    from spendradar import llm
    from spendradar.tools import files

    def boom(*a, **k):
        raise AssertionError("corrupt PDF must not reach the LLM")

    monkeypatch.setattr(llm, "complete", boom)
    with pytest.raises(files.ToolError, match="corrupt PDF"):
        files.read_pdf("data/acme/invoices/13_brightloop_2026-10.pdf", mode="llm")


def test_scanned_pdf_still_goes_to_the_llm_reader(monkeypatch):
    from spendradar import llm
    from spendradar.tools import files

    called = []
    monkeypatch.setattr(llm, "complete", lambda *a, **k: called.append(1) or (_ for _ in ()).throw(llm.LLMError("stub")))
    with pytest.raises(files.ToolError, match="LLM PDF reader failed"):
        files.read_pdf("data/acme/invoices/12_nimbus_2026-10.pdf", mode="llm")
    assert called == [1]


def _inv(path, vendor, number, total, date="2026-05-28"):
    return {"path": path, "vendor": vendor, "number": number, "date": date, "cost_centre": "Infrastructure",
            "category": "infra_cloud", "lines": [], "line_sum": total, "stated_total": total}


def test_duplicate_invoice_is_flagged_once_and_not_counted_twice():
    s = RunState(run_id="x", goal="g", input_dir="d")
    s.invoices = [_inv("invoices/02_a.pdf", "Stratus", "KM-1", 100.0),
                  _inv("invoices/10_a_resent.pdf", "Stratus", "KM-1", 100.0),
                  _inv("invoices/03_b.pdf", "Other Co", "KM-1", 50.0)]  # same number, different vendor: not a dup
    agent._duplicate_check(s)
    dups = [c for c in s.checks if c.name == "verify:duplicate_invoice"]
    assert [c.target for c in dups] == ["invoices/10_a_resent.pdf"]
    assert s.invoices[1]["duplicate_of"] == "invoices/02_a.pdf" and "duplicate_of" not in s.invoices[2]
    assert any(f["issue"].startswith("duplicate invoice KM-1") for f in s.flags)


def test_same_vendor_date_and_amount_with_new_number_is_a_duplicate():
    s = RunState(run_id="x", goal="g", input_dir="d")
    s.invoices = [_inv("invoices/a.pdf", "Stratus", "KM-1", 100.0), _inv("invoices/b.pdf", "Stratus", "KM-9", 100.0)]
    agent._duplicate_check(s)
    assert s.invoices[1]["duplicate_of"] == "invoices/a.pdf"


def test_planner_backslash_paths_are_normalised():
    # run 1010-0cb70b: the planner wrote Windows paths, which leaked into state and the report
    assert agent._normalise_path("data/kestrel", r"invoices\\08_ledgerline_2026-06.pdf") == "invoices/08_ledgerline_2026-06.pdf"
    assert agent._normalise_path("data/kestrel", r"data\kestrel\invoices\01.pdf") == "invoices/01.pdf"
