from pathlib import Path

import pytest

from spendradar import analysis
from spendradar.models import CompetitorProfile, CompetitorSignal, Source
from spendradar.tools import files

ACME = Path("data/acme")


def test_text_invoice_parse_matches_lines():
    out = files.read_pdf(str(ACME / "invoices/01_nimbus_2026-04.pdf"))["extract"]
    assert out["cost_centre"] == "Infrastructure"
    assert len(out["lines"]) == 4
    assert abs(sum(line["amount"] for line in out["lines"]) - out["stated_total"]) < 0.01


def test_planted_mismatch_invoice_is_parsed_as_printed():
    out = files.read_pdf(str(ACME / "invoices/04_nimbus_2026-07.pdf"))["extract"]
    assert out["stated_total"] - sum(line["amount"] for line in out["lines"]) == pytest.approx(7500)


def test_scanned_and_corrupt_raise_toolerror():
    with pytest.raises(files.ToolError, match="no text layer"):
        files.read_pdf(str(ACME / "invoices/12_nimbus_2026-10.pdf"))
    with pytest.raises(files.ToolError, match="could not open"):
        files.read_pdf(str(ACME / "invoices/13_brightloop_2026-10.pdf"))


def test_read_spreadsheet_keeps_row_numbers():
    rows = files.read_spreadsheet(str(ACME / "budget_fy27.xlsx"), "People")
    cost = [r for r in rows if r["metric"] == "people_cost"]
    assert {r["category"] for r in cost} == {"engineering", "ml_ai", "sales", "marketing", "other"}
    assert all(isinstance(r["_row"], int) for r in cost)


def _prof(total, eng_vals, ml_vals=()):
    src = Source(kind="crustdata", ref="x", fetched_at="2026-10-10T00:00:00+00:00")
    sig = [CompetitorSignal(name=f"s{i}", category="engineering", headcount=v, as_of="2026-10-10", source=src)
           for i, v in enumerate(eng_vals)]
    sig += [CompetitorSignal(name=f"m{i}", category="ml_ai", headcount=v, as_of="2026-10-10", source=src)
            for i, v in enumerate(ml_vals)]
    return CompetitorProfile(name="c", domain="c.io", total_headcount=total, signals=sig)


def test_compare_within_pct_rule_and_gap():
    profs = [_prof(100, [], [10, 12]), _prof(200, [], [20, 20]), _prof(50, [], [5, 7])]
    shares = analysis.competitor_shares(profs, "ml_ai")
    ours = {"headcount": 5, "share": 0.05, "_total": 100}
    res = analysis.compare(ours, shares, {"rule": "within_pct_of_median", "pct": 20}, 200_000)
    assert res["median_low"] == pytest.approx(0.10) and res["median_high"] == pytest.approx(0.12)
    assert res["violated"] is True
    assert res["gap_heads"] == pytest.approx((5, 7))
    assert res["gap_usd"] == pytest.approx((1_000_000, 1_400_000))


def test_signal_agreement():
    assert analysis.signal_agreement(_prof(100, [50, 100]), "engineering") == 0.5
    assert analysis.signal_agreement(_prof(100, [50]), "engineering") is None


def test_ml_share_needs_three_titles():
    classes = {"a": {"category": "ml_ai"}, "b": {"category": "engineering"}, "c": {"category": "engineering"},
               "d": {"category": "sales"}}
    assert analysis.ml_share(["a", "b"], classes) is None
    assert analysis.ml_share(["a", "b", "c", "d"], classes) == (1 / 3, 1, 3)


def test_classify_keeps_titles_with_stray_whitespace(monkeypatch):
    from spendradar import llm
    from spendradar.tools import classify

    def fake_complete(role, prompt, system=None, schema=None):
        labels = [classify.TitleLabel(title="Senior SWE - LLM Observability", category="engineering")]
        return llm.LLMResult(text="", parsed=classify.TitleBatch(labels=labels), model="m")

    monkeypatch.setattr(llm, "complete", fake_complete)
    out, _ = classify.classify_titles(["Senior SWE - LLM Observability "])
    assert out == {"Senior SWE - LLM Observability ": {"category": "engineering", "model": "m"}}


def test_title_batch_unwraps_a_schema_echo():
    # runs 1011-2c53f4 t31 / 1011-6d3ba6 t28: the model wrapped the labels in {"items": [...], "type": "array"}
    from spendradar.tools.classify import TitleBatch

    echoed = {"labels": {"items": [{"title": "ML Engineer", "category": "ml_ai"}], "type": "array"}}
    assert TitleBatch.model_validate(echoed).labels[0].category == "ml_ai"
    assert TitleBatch.model_validate({"labels": [{"title": "AE", "category": "sales"}]}).labels[0].category == "sales"


def test_invoice_totals_accept_net_line_items_only_when_printed_figures_agree():
    from spendradar.verify import invoice_totals_check

    # held-out FCC invoice 08e2649c (verified values): lines sum to the printed net 15,563.32; gross 22,466.00,
    # commission 3,369.90 (other deductions too, so gross - commission != net)
    assert invoice_totals_check("x", [15563.32], 22466.0, 3369.9, 15563.32).passed
    # lines match neither printed total: still flagged
    assert not invoice_totals_check("x", [14000.0], 22466.0, 3369.9, 15563.32).passed
    # a "net" larger than the gross is not a net: still flagged
    assert not invoice_totals_check("x", [30000.0], 22466.0, None, 30000.0).passed
    # no commission printed (all fictional companies): unchanged behaviour, a planted mismatch stays caught
    assert not invoice_totals_check("x", [89435.0], 96935.0).passed
    assert invoice_totals_check("x", [50.0, 50.0], 100.0).passed
