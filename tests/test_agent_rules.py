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


def _fallback_result(parsed):
    from spendradar import llm
    return llm.LLMResult(text="", parsed=parsed, model="gemini-3.1-flash-lite", provider="gemini", tokens_in=5,
                         tokens_out=2, latency_s=0.1, fallbacks=["gemini-3.1-flash-lite"])


def test_llm_pdf_reader_reports_its_fallback_hop(monkeypatch):
    # run 1011-3cd178 (llm:429 injected): a fallback call happened, but fallback_hops read 0
    from spendradar import llm
    from spendradar.tools import files

    ex = files.InvoiceExtract(invoice_number="1", vendor="v", cost_centre="c", invoice_date="d", lines=[],
                              stated_total=0.0)
    monkeypatch.setattr(llm, "complete", lambda *a, **k: _fallback_result(ex))
    out = files.read_pdf("data/acme/invoices/12_nimbus_2026-10.pdf", mode="llm")
    s = RunState(run_id="x", goal="g", input_dir="d")
    agent._usage(s, out["llm"])
    assert s.llm_usage["gemini-3.1-flash-lite"]["fallback_hops"] == 1


def test_pdf_attachments_skip_text_only_providers_without_a_fallback(monkeypatch):
    # OpenAI and OpenRouter routes are text-only; a PDF going to Gemini is planned routing, not a fallback
    from spendradar import llm

    monkeypatch.setattr(llm, "cache_enabled", lambda: False)
    monkeypatch.setattr(llm, "_chain", lambda role: [("openai", "gpt-5-nano"), ("gemini", "g1"), ("openrouter", "o:free")])
    monkeypatch.setattr(llm.LEDGER, "remaining", lambda m: 10)
    monkeypatch.setattr(llm.LEDGER, "wait_turn", lambda m: None)
    monkeypatch.setattr(llm.LEDGER, "record", lambda *a: None)
    monkeypatch.setattr(llm, "_call_gemini", lambda *a: ("ok", None, 1, 1))
    monkeypatch.setattr(llm, "_call_openai", lambda *a: (_ for _ in ()).throw(ValueError("stub: OpenAI down")))
    res = llm._run_chain("extract", "p", None, None, None, attachments=[(b"%PDF", "application/pdf")])
    assert res.model == "g1" and res.fallbacks == []
    res = llm._run_chain("extract", "p", None, None, None)  # text calls still start at OpenAI
    assert res.model == "g1" and res.fallbacks == ["g1"]


def test_title_classifier_reports_its_fallback_hop(monkeypatch):
    from spendradar import llm
    from spendradar.tools import classify

    monkeypatch.setattr(llm, "complete", lambda *a, **k: _fallback_result(classify.TitleBatch(labels=[])))
    _, usage = classify.classify_titles(["ML Engineer"])
    s = RunState(run_id="x", goal="g", input_dir="d")
    for u in usage:
        agent._usage(s, u)
    assert s.llm_usage["gemini-3.1-flash-lite"]["fallback_hops"] == 1


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


def test_plan_coverage_adds_invoices_the_planner_skipped():
    # run 1011-ae5e18 (Bastion): the planner left out two invoices and, on Windows, the coverage check
    # could not see it because list_files returned backslash paths
    from spendradar.tools import files
    listing = files.list_files("data/bastion")
    assert all("\\" not in f["path"] for f in listing)
    s = RunState(run_id="x", goal="g", input_dir="data/bastion")
    s.queue = [Task(id="t01", tool="read_invoice", args={"path": "invoices/01_ironvault_2026-04.pdf"})]
    agent._verify_plan(s, listing, {"competitors": []})
    added = {t.args.get("path") for t in s.queue if t.reason == "added by plan coverage check"}
    assert "invoices/11_ironvault_2026-08_resent.pdf" in added and "invoices/12_beacon_2026-10.pdf" in added


def test_job_window_is_stable_within_a_week():
    from datetime import date
    week = {agent.job_window_start(365, date(2026, 10, d)) for d in range(5, 12)}  # Mon 5 .. Sun 11 Oct
    assert week == {"2025-10-05"}
    assert agent.job_window_start(365, date(2026, 10, 12)) == "2025-10-12"  # next Monday moves it


def test_fired_faults_are_saved(tmp_path, monkeypatch):
    # injected runs used to store and report "fired: none": the record happened after the last save
    from spendradar import faults
    monkeypatch.setattr(agent, "RUNS", tmp_path, raising=False)
    faults.configure(["crustdata:429"])
    assert faults.fire("crustdata:429")
    s = RunState(run_id="x", goal="g", input_dir="d")
    agent._record_faults(s)
    assert s.faults_fired == ["crustdata:429"] and "crustdata:429" in s.injected
    faults.configure([]); faults.fired.clear()


def test_eval_verdict_fails_on_any_miss():
    from spendradar.neatlogs_evals import verdict

    ok = {"planted_caught": 5, "planted_total": 5, "planted_detail": {}, "unsupported_numbers_in_report": 0,
          "false_alarms": 0, "phase": "done"}
    assert verdict(ok) == ("PASS", [])
    miss = {**ok, "planted_caught": 4, "planted_detail": {"P1": True, "P2": False}}
    assert verdict(miss)[0] == "FAIL" and "P2" in verdict(miss)[1][0]
    assert verdict({**ok, "phase": "audit"})[0] == "FAIL"


def test_eval_keeps_unfinished_runs_out_of_the_averages(tmp_path, monkeypatch):
    # run 1011-d2d05c stopped at step 26 and was averaged in as if complete; its stderr was dropped
    import json
    import subprocess
    from spendradar import evals

    outs = iter([(0, "a1", ""), (1, "b2", "Traceback ... LLMError: all models failed")])

    def fake_run(cmd, **k):
        code, rid, err = next(outs)
        return subprocess.CompletedProcess(cmd, code, stdout=f'{{"run_id": "{rid}"}}', stderr=err)

    def fake_score(rid):
        return {"run_id": rid, "git_sha": "abc", "phase": "done" if rid == "a1" else "audit", "planted_total": 5,
                "planted_caught": 5 if rid == "a1" else 1, "fallback_hops": 0,
                **{k: 0 for k in ("false_alarms", "unsupported_numbers_in_report", "overturned", "downgraded",
                                  "recovery_decisions", "llm_calls", "llm_tokens_in", "llm_tokens_out",
                                  "llm_latency_s", "crustdata_credits")}}

    monkeypatch.setattr(evals.subprocess, "run", fake_run)
    monkeypatch.setattr(evals, "score_run", fake_score)
    monkeypatch.setattr(evals, "OUT", tmp_path)
    card = json.loads(evals.run_eval(2, "t", False).read_text(encoding="utf-8"))
    assert card["n_runs"] == 2 and card["n_runs_incomplete"] == 1
    assert card["summary_all_runs"]["planted_caught"] == {"mean": 5, "min": 5, "max": 5, "n": 1}
    bad = card["runs"][1]
    assert bad["exit_code"] == 1 and "LLMError" in bad["stderr_tail"]


def test_audit_sees_the_line_item_check_for_a_miscategorised_invoice():
    # run 1011-4f1f02: the line-item check said invoice 08 was ml_ai work billed to marketing, but the auditor
    # never saw that result, re-judged from raw descriptions, and overturned a correct flag
    from spendradar import audit
    from spendradar.models import Check, Finding

    s = RunState(run_id="x", goal="g", input_dir="d")
    s.invoices = [{**_inv("invoices/08_t.pdf", "Tensorforge GPU", "INV-8", 1.0), "category": "marketing",
                   "cost_centre": "Marketing", "lines": [{"description": "A-class GPU hours (training)"}]}]
    s.checks = [Check(name="verify:line_items", target="invoices/08_t.pdf", passed=False,
                      detail="cost centre → marketing, line items → ml_ai")]
    f = Finding(id="f_cat", category="internal", kind="internal", confidence=0.0,
                statement="Tensorforge GPU: vendor billed to ['marketing', 'ml_ai']; likely mis-categorised invoice.")
    ev = audit._evidence_against(s, f, [])
    assert any("line-item check" in e and "line items → ml_ai" in e for e in ev)


def test_set_io_writes_openinference_fields():
    from spendradar.tracing import set_io

    class Span:
        def __init__(self):
            self.a = {}

        def set_attribute(self, k, v):
            self.a[k] = v

    s = Span()
    set_io(s, input={"x": 1}, output="done")
    assert s.a == {"input.value": '{"x": 1}', "output.value": "done"}
