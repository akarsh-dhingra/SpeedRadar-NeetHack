import pytest

from spendradar import agent, verify
from spendradar.models import RunState, Task


def test_recovery_menus():
    t = Task(id="t", tool="read_invoice", args={"path": "x.pdf"})
    assert agent._options_for(t, "tool_error") == (["reparse_alt", "skip"], "skip")
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
    inside = agent._gap_sentence((-6, 6), (-1.1e6, 1.07e6))
    assert inside.startswith("Acme is inside") and "$-" not in inside


def test_agreement_failure_needs_no_llm_and_equal_gap_collapses():
    t = Task(id="t20", tool="fetch_competitor", args={"domain": "sentry.io"})
    assert agent._options_for(t, "verify:agreement failed") == (["mark_low_confidence"], "mark_low_confidence")
    s = RunState(run_id="x", goal="g", input_dir="d")
    assert agent.decide_recovery(s, t, "verify:agreement failed", "Sentry:marketing 19–95") == "mark_low_confidence"
    assert s.decisions[-1].model == "rule"
    assert "10 fewer people" in agent._gap_sentence((-10, -10), (-1.5e6, -1.5e6))
