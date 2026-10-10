from spendradar import analysis, evals
from spendradar.models import Check, Finding, RunState


def _state(**kw):
    return RunState(run_id="t", goal="g", input_dir="d", **kw)


def _f(stmt="x", cat="sales", status="open", notes=None):
    return Finding(id="f", category=cat, kind="internal", statement=stmt, status=status, audit_notes=notes or [])


# ---------------- evals._caught ----------------

def test_caught_budget_total_mismatch():
    p = {"id": "budget_total_mismatch", "type": "totals_mismatch", "category": "sales"}
    bad = _state(checks=[Check(name="verify:totals", target="budget:sales", passed=False)])
    ok = _state(checks=[Check(name="verify:totals", target="budget:sales", passed=True)])
    other = _state(checks=[Check(name="verify:totals", target="budget:eng", passed=False)])
    assert evals._caught(bad, p, {}) and not evals._caught(ok, p, {}) and not evals._caught(other, p, {})


def test_caught_totals_mismatch():
    p = {"id": "i1", "type": "totals_mismatch", "file": "inv/a.pdf"}
    assert evals._caught(_state(checks=[Check(name="verify:totals", target="inv/a.pdf", passed=False)]), p, {})
    assert not evals._caught(_state(checks=[Check(name="verify:totals", target="inv/a.pdf", passed=True)]), p, {})
    assert not evals._caught(_state(), p, {})


def test_caught_miscategorised():
    p = {"id": "m", "type": "miscategorised", "file": "inv/m.pdf", "correct_category": "marketing"}
    truth = {"invoices": [{"file": "inv/m.pdf", "vendor": "AdCo"}]}
    flags = [{"target": "vendor AdCo", "issue": "x"}]
    fnd = [_f("AdCo: mis-categorised", notes=["corrected category: marketing"])]
    assert evals._caught(_state(flags=flags, findings=fnd), p, truth)
    assert not evals._caught(_state(flags=[], findings=fnd), p, truth)
    assert not evals._caught(_state(flags=flags, findings=[_f("AdCo: mis-categorised",
                                                              notes=["corrected category: sales"])]), p, truth)
    assert not evals._caught(_state(flags=flags, findings=fnd), p, {"invoices": []})


def test_caught_scanned_pdf():
    p = {"id": "s", "type": "scanned_pdf", "file": "s.pdf", "amount": 1000.0}
    mk = lambda v: _state(invoices=[{"path": "s.pdf", "line_sum": v}])
    assert evals._caught(mk(1005.0), p, {})
    assert not evals._caught(mk(1100.0), p, {})
    assert not evals._caught(_state(invoices=[{"path": "other.pdf", "line_sum": 1000.0}]), p, {})


def test_caught_corrupt_file():
    p = {"id": "c", "type": "corrupt_file", "file": "bad.xlsx"}
    assert evals._caught(_state(not_analysed=[{"input": "bad.xlsx", "reason": "r"}]), p, {})
    assert not evals._caught(_state(not_analysed=[{"input": "x", "reason": "r"}]), p, {})


def test_caught_fixture():
    p = {"id": "fx", "type": "fixture", "category": "sales"}
    assert evals._caught(_state(findings=[_f(status="overturned")]), p, {})
    assert evals._caught(_state(findings=[_f(status="downgraded")]), p, {})
    assert not evals._caught(_state(findings=[_f(status="confirmed")]), p, {})
    assert not evals._caught(_state(findings=[_f(cat="marketing", status="overturned")]), p, {})


def test_caught_unknown_type():
    assert evals._caught(_state(), {"id": "z", "type": "nope"}, {}) is False


# ---------------- evals._unsupported_numbers ----------------

def test_unsupported_numbers():
    rpt = "\n".join([
        "# T", "## Findings", "",
        "| Area | Finding | Policy | Confidence | Audit |", "|---|---|---|---|---|",
        "| Sales | below median 12% [1] | met | 0.9 | confirmed |",
        "| Sales | below median 12% | met | 0.9 | confirmed |",  # unsupported (number, no cite)
        "| Marketing | no digits here | met | x | y |",  # digits? none -> not counted
        "| Internal checks | totals 5 | — | 1 | ok |",  # excluded
        "| Infra/cloud | spend 5 | — | 1 | ok |",  # excluded
        "", "## Overturned claims", "| Sales | 99 no cite |"])
    assert evals._unsupported_numbers(rpt) == 1


def test_unsupported_numbers_empty():
    assert evals._unsupported_numbers("") == 0


# ---------------- analysis.profile_from_enrich ----------------

CD = {
    "headcount": {
        "total": 500,
        "by_role_absolute": {"Engineering": 200, "Sales": 50, "Business Development": 10},
        "by_function_timeseries": {"CURRENT_FUNCTION": {
            "Engineering": [{"date": "2025-12-01T00:00:00", "employee_count": 180},
                            {"date": "2026-01-01T00:00:00", "employee_count": 190}],
            "Sales": [{"date": "2026-02-01T00:00:00", "employee_count": 40}],
            "Business Development": [{"date": "2026-01-01T00:00:00", "employee_count": 5}],
        }},
    },
    "funding": {"total_investment_usd": 1, "last_round_type": "A", "extra": "ignored"},
    "hiring": {"recent_titles_csv": "A, B"},
    "news": [{"article_publish_date": "2026-01-01", "article_title": "T", "article_url": "U"}],
}


def test_profile_from_enrich():
    p = analysis.profile_from_enrich("Co", "co.com", CD, "2026-03-01T10:00:00+00:00")
    assert p.total_headcount == 500 and p.total_as_of == "2026-03-01"
    sig = {(s.category, s.name): s for s in p.signals}
    assert sig[("engineering", "role_headcount")].headcount == 200
    assert sig[("sales", "role_headcount")].headcount == 60
    assert "Sales+Business Development" in sig[("sales", "role_headcount")].source.locator
    assert sig[("engineering", "function_timeseries")].headcount == 190
    assert sig[("sales", "function_timeseries")].headcount == 45
    assert sig[("sales", "function_timeseries")].as_of == "2026-02-01"
    assert "[2026-02-01]" in sig[("sales", "function_timeseries")].source.locator
    assert p.missing == ["marketing: no role or function headcount"]
    assert p.news == [{"date": "2026-01-01", "title": "T", "url": "U"}]
    assert p.funding["last_round_type"] == "A" and "extra" not in p.funding


def test_profile_from_enrich_sparse():
    p = analysis.profile_from_enrich("Co", "co.com", {}, "2026-03-01T00:00:00+00:00")
    assert p.total_headcount is None and p.signals == []
    assert len(p.missing) == 4  # 3 categories + hiring
    assert "hiring: no recent job titles" in p.missing
    assert p.news == []
