import re
from datetime import date, timedelta

from spendradar import analysis, audit, report
from spendradar.models import (CompetitorProfile, CompetitorSignal, Figure, Finding, RunState, Source)


def _src(ref="f.xlsx", loc="A1"):
    return Source(kind="file", ref=ref, locator=loc, fetched_at="2026-01-01T00:00:00+00:00")


def _fig(fid, sources=True, ref="f.xlsx", loc="A1"):
    return Figure(id=fid, label=fid, value=10.0, sources=[_src(ref, loc)] if sources else [])


def _state(**kw):
    return RunState(run_id="t1", goal="g", input_dir="d", **kw)


# ---------------- report.write ----------------

def _write(monkeypatch, tmp_path, state):
    (tmp_path / "runs" / state.run_id).mkdir(parents=True)
    monkeypatch.chdir(tmp_path)
    return report.write(state)


def _section(text, name):
    return text.split(f"## {name}", 1)[1].split("\n## ", 1)[0]


def test_report_unsourced_policy_finding_not_printed(monkeypatch, tmp_path):
    st = _state(figures={"a": _fig("a"), "b": _fig("b", sources=False)})
    st.findings = [
        Finding(id="f1", category="sales", kind="policy", statement="SOURCED_CLAIM", figure_ids=["a"]),
        Finding(id="f2", category="sales", kind="policy", statement="UNSOURCED_CLAIM", figure_ids=["b"]),
        Finding(id="f3", category="sales", kind="policy", statement="MISSING_FIG_CLAIM", figure_ids=["zzz"]),
    ]
    text = _write(monkeypatch, tmp_path, st).read_text()
    assert "SOURCED_CLAIM" in text
    assert "UNSOURCED_CLAIM" not in text
    assert "MISSING_FIG_CLAIM" not in text


def test_report_overturned_struck_through(monkeypatch, tmp_path):
    st = _state(figures={"a": _fig("a")})
    st.findings = [
        Finding(id="f1", category="sales", kind="policy", statement="LIVE", figure_ids=["a"]),
        Finding(id="f2", category="marketing", kind="policy", statement="DEAD", figure_ids=["a"],
                status="overturned", audit_notes=["because reasons"]),
    ]
    text = _write(monkeypatch, tmp_path, st).read_text()
    over = _section(text, "Overturned claims")
    assert "~~DEAD~~" in over and "because reasons" in over
    assert "DEAD" not in _section(text, "Findings")


def test_report_no_overturned_message(monkeypatch, tmp_path):
    text = _write(monkeypatch, tmp_path, _state()).read_text()
    assert "None this run" in _section(text, "Overturned claims")


def test_report_citations_have_sources(monkeypatch, tmp_path):
    st = _state(figures={"a": _fig("a", ref="one.xlsx"), "b": _fig("b", ref="two.xlsx", loc="B2")})
    st.findings = [Finding(id="f1", category="sales", kind="policy", statement="X", figure_ids=["a", "b"]),
                   Finding(id="f2", category="engineering", kind="policy", statement="Y", figure_ids=["a"])]
    text = _write(monkeypatch, tmp_path, st).read_text()
    cited = set(re.findall(r"\[(\d+)\]", _section(text, "Findings")))
    assert cited == {"1", "2"}
    sources = _section(text, "Sources")
    for n in cited:
        assert re.search(rf"^{n}\. ", sources, re.M)
    assert "one.xlsx" in sources and "two.xlsx" in sources


def test_report_data_mode_and_html(monkeypatch, tmp_path):
    p = _write(monkeypatch, tmp_path, _state(data_mode="fixture"))
    assert "FIXTURE" in p.read_text()
    assert (p.with_suffix(".html")).exists()
    assert "<html" in p.with_suffix(".html").read_text()


def test_report_real_mode(monkeypatch, tmp_path):
    text = _write(monkeypatch, tmp_path, _state()).read_text()
    assert "real data" in text and "FIXTURE" not in text


# ---------------- audit ----------------

BUDGET = {"headcount_end": {"engineering": 50, "sales": 30, "marketing": 20},
          "people_cost": {"engineering": 1, "sales": 1, "marketing": 1}}
RULES = {"rules": [{"category": "sales", "rule": "within_pct_of_median", "pct": 20}]}


def _profile(name, sales_signals, total=100, news=None):
    p = CompetitorProfile(name=name, domain=f"{name}.com", total_headcount=total, news=news or [])
    for i, v in enumerate(sales_signals):
        p.signals.append(CompetitorSignal(name=f"s{i}", category="sales", headcount=v, as_of="2026-01-01",
                                          source=_src()))
    return p


def _policy_state():
    st = _state(budget=BUDGET, policy=RULES, salary={"sales": 100.0})
    st.competitors = {"c": _profile("C", [10, 12])}
    return st


def _matching_finding(st):
    ours = analysis.our_position(st.budget)
    res = analysis.compare({**ours["sales"], "_total": ours["_total"]},
                           analysis.competitor_shares(list(st.competitors.values()), "sales"),
                           st.policy["rules"][0], 100.0)
    return Finding(id="f", category="sales", kind="policy", statement="s", theirs_low=res["median_low"],
                   theirs_high=res["median_high"], policy_violated=res["violated"], figure_ids=[])


def test_recompute_internal_is_ok():
    f = Finding(id="f", category="sales", kind="internal", statement="s")
    assert audit._recompute_ok(_state(), f)[0] is True


def test_recompute_match_and_mismatch():
    st = _policy_state()
    f = _matching_finding(st)
    assert audit._recompute_ok(st, f)[0] is True
    f.theirs_low += 0.01
    ok, msg = audit._recompute_ok(st, f)
    assert not ok and "mismatch" in msg
    f = _matching_finding(st)
    f.policy_violated = not f.policy_violated
    assert audit._recompute_ok(st, f)[0] is False


def test_sources_ok():
    st = _state(figures={"a": _fig("a"), "b": _fig("b", sources=False)})
    mk = lambda ids: Finding(id="f", category="sales", kind="policy", statement="s", figure_ids=ids)
    assert audit._sources_ok(st, mk(["a"]))[0] is True
    assert audit._sources_ok(st, mk([]))[0] is True
    ok, msg = audit._sources_ok(st, mk(["a", "b", "nope"]))
    assert not ok and "b" in msg and "nope" in msg


def test_recent_negative_news():
    today = date.today()
    d = lambda n: (today - timedelta(days=n)).isoformat()
    news = [
        {"date": d(10), "title": "Company announces LAYOFFS of 10%", "url": "u1"},
        {"date": d(170), "title": "Hiring freeze announced", "url": "u2"},
        {"date": d(400), "title": "Big layoff", "url": "u3"},
        {"date": d(5), "title": "New product launch", "url": "u4"},
        {"date": None, "title": "layoff", "url": "u5"},
        {"date": "garbage", "title": "layoff", "url": "u6"},
        {"date": d(5), "title": None, "url": "u7"},
    ]
    st = _state()
    st.competitors = {"c": _profile("C", [1], news=news)}
    hits = audit._recent_negative_news(st)
    assert sorted(h["url"] for h in hits) == ["u1", "u2"]
    assert all(h["company"] == "C" for h in hits)


def test_evidence_against_disagreement():
    st = _state()
    st.competitors = {"low": _profile("Low", [10, 100]), "ok": _profile("Ok", [90, 100])}
    f = Finding(id="f", category="sales", kind="policy", statement="s")
    ev = audit._evidence_against(st, f, [])
    assert len(ev) == 1 and ev[0].startswith("Low sales signals disagree")
    # internal findings get no signal evidence
    f2 = Finding(id="f", category="sales", kind="internal", statement="s")
    assert audit._evidence_against(st, f2, []) == []


def test_evidence_against_includes_news_and_miscategorised():
    st = _state(invoices=[{"vendor": "Acme", "number": "INV1", "cost_centre": "CC", "category": "sales",
                           "lines": [{"description": "ads"}, {"description": "seo"}]},
                          {"vendor": "Other", "number": "INV2", "cost_centre": "X", "category": "sales",
                           "lines": []}])
    news = [{"company": "C", "date": "2026-01-01", "title": "layoff", "url": "http://x"}]
    f = Finding(id="f", category="sales", kind="policy", statement="Acme: mis-categorised invoice")
    ev = audit._evidence_against(st, f, news)
    assert any(e.startswith("news 2026-01-01 C: layoff") for e in ev)
    inv = [e for e in ev if "INV1" in e]
    assert len(inv) == 1 and "ads; seo" in inv[0]
    assert not any("INV2" in e for e in ev)


def _ml_profile(name, values):
    from spendradar.models import CompetitorProfile, CompetitorSignal, Source

    src = Source(kind="crustdata", ref="test", note="unit test")
    return CompetitorProfile(name=name, domain=f"{name}.io", signals=[
        CompetitorSignal(name=f"s{i}", category="ml_ai", headcount=v, as_of="2026-10-01", source=src)
        for i, v in enumerate(values)])


def test_disagreeing_signals_downgrade_without_asking_the_llm(monkeypatch):
    from spendradar import audit, llm
    from spendradar.models import Finding, RunState

    st = RunState(run_id="t", goal="g", input_dir="data/acme", git_sha="x", tags=[])
    st.competitors = {"a": _ml_profile("A", [0, 10]), "b": _ml_profile("B", [5, 5])}
    f = Finding(id="f_ml_ai", category="ml_ai", kind="policy", statement="s", confidence=0.4)
    monkeypatch.setattr(audit, "_recompute_ok", lambda s, f: (True, "ok"))
    monkeypatch.setattr(audit, "_sources_ok", lambda s, f: (True, "ok"))
    monkeypatch.setattr(audit, "_recent_negative_news", lambda s: [])
    monkeypatch.setattr(llm, "complete", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no LLM")))
    st.findings = [f]
    audit.self_audit(st)
    assert f.status == "downgraded" and f.confidence == 0.2 and "A" in f.audit_notes[-1]
    assert audit._disagreeing_competitors(st, f) == ["A"]  # B's signals agree
