"""Regression tests for the failure modes found in the 2026-10-11 audit (no network, no LLM)."""

import json

import httpx
import pytest

from spendradar import agent, analysis, llm, report, verify
from spendradar.models import RunState
from spendradar.tools import crustdata, files


def test_negative_stated_total_is_not_a_free_pass():
    assert not verify.totals_check("x", [100], -500).passed
    assert verify.totals_check("credit note", [-100, -50], -150).passed


def test_our_position_survives_zero_and_missing_headcount():
    assert analysis.our_position({"headcount_end": {"eng": 0}, "people_cost": {}}) == {"_total": 0}
    assert analysis.our_position({}) == {"_total": 0}
    pos = analysis.our_position({"headcount_end": {"eng": 3, "ml_ai": None}, "people_cost": {}})
    assert pos["_total"] == 3 and "ml_ai" not in pos


def test_build_findings_with_no_budget_notes_it_instead_of_crashing(tmp_path, monkeypatch):
    monkeypatch.setattr(agent, "state_path", lambda rid: tmp_path / "state.json")
    st = RunState(run_id="t", goal="g", input_dir="data/acme", git_sha="x", tags=[])
    st.policy = {"rules": [{"category": "engineering", "rule": "bogus"}]}
    agent.build_findings(st)
    assert any("No verified budget headcount" in n for n in st.notes)


def test_bad_policy_rule_loses_one_category_not_the_run(tmp_path, monkeypatch):
    monkeypatch.setattr(agent, "state_path", lambda rid: tmp_path / "state.json")
    monkeypatch.setattr(agent, "_policy_finding",
                        lambda st, cat, *a: (_ for _ in ()).throw(KeyError("pct")) if cat == "sales" else None)
    st = RunState(run_id="t", goal="g", input_dir="data/acme", git_sha="x", tags=[])
    st.budget = {"headcount_end": {"sales": 2}, "people_cost": {}}
    st.policy = {"rules": [{"category": "sales"}]}
    agent.build_findings(st)
    assert any(n.startswith("sales: finding not built") for n in st.notes)


@pytest.mark.parametrize("raw,ok", [(12, 12.0), ("1,234.50", 1234.5), ("$1,000", 1000.0)])
def test_num_accepts_money_strings(raw, ok):
    assert agent._num(raw, "here") == ok


@pytest.mark.parametrize("raw", [None, "n/a", float("nan")])
def test_num_rejects_empty_and_text_cells(raw):
    with pytest.raises(files.ToolError, match="here: expected a number"):
        agent._num(raw, "here")


def test_validate_inputs(tmp_path):
    with pytest.raises(SystemExit, match="not found"):
        agent.validate_inputs(str(tmp_path / "nope"))
    with pytest.raises(SystemExit, match="missing"):
        agent.validate_inputs(str(tmp_path))
    (tmp_path / "competitors.yaml").write_text("competitors:\n  - name: X\n")
    with pytest.raises(SystemExit, match="name and domain"):
        agent.validate_inputs(str(tmp_path))
    agent.validate_inputs("data/acme")  # the real input is valid


def test_planner_path_cannot_escape_input_folder():
    assert agent._inside("data/acme", "invoices/01_nimbus_2026-04.pdf")
    assert not agent._inside("data/acme", "invoices/../../../.env")


def test_corrupt_ledger_starts_fresh(tmp_path):
    p = tmp_path / "ledger.json"
    p.write_text("{not json")
    led = llm.Ledger(p)
    assert led.data == {}
    led.record("gemini-3.5-flash-lite", 1, 1)
    assert json.loads(p.read_text())  # atomic save wrote valid JSON


def test_resume_keeps_the_crustdata_credit_cap(tmp_path, monkeypatch):
    st = RunState(run_id="r", goal="g", input_dir="data/acme", git_sha="x", tags=[], crustdata_credits=42.0)
    p = tmp_path / "state.json"
    p.write_text(st.model_dump_json())
    monkeypatch.setattr(agent, "state_path", lambda rid: p)
    crustdata.BUDGET.spent = 0
    agent.load("r")
    assert crustdata.BUDGET.spent == 42.0


def test_resume_of_corrupt_state_is_a_clear_exit(tmp_path, monkeypatch):
    p = tmp_path / "state.json"
    p.write_text("{broken")
    monkeypatch.setattr(agent, "state_path", lambda rid: p)
    with pytest.raises(SystemExit, match="corrupt"):
        agent.load("r")


class _Resp:
    def __init__(self, code, body=None):
        self.status_code, self._body, self.text, self.headers = code, body or {}, "err", {}
        self.request = httpx.Request("POST", "https://x")

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(str(self.status_code), request=self.request, response=self)


def test_crustdata_401_fails_fast_and_charges_nothing(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(crustdata, "CACHE", tmp_path)
    monkeypatch.setenv("CRUSTDATA_API_KEY", "test")
    monkeypatch.setattr(crustdata.httpx, "post", lambda *a, **k: calls.append(1) or _Resp(401))
    crustdata.BUDGET.spent = 0
    with pytest.raises(files.ToolError, match="401"):
        crustdata._post("/company/enrich", {"q": 1}, 2)
    assert calls == [1] and crustdata.BUDGET.spent == 0


def test_crustdata_retries_are_not_charged(tmp_path, monkeypatch):
    seq = [_Resp(429), _Resp(200, {"ok": True})]
    monkeypatch.setattr(crustdata, "CACHE", tmp_path)
    monkeypatch.setenv("CRUSTDATA_API_KEY", "test")
    monkeypatch.setattr(crustdata.httpx, "post", lambda *a, **k: seq.pop(0))
    monkeypatch.setattr(crustdata.time, "sleep", lambda s: None)
    crustdata.BUDGET.spent = 0
    out = crustdata._post("/company/enrich", {"q": 2}, 2)
    assert out["body"] == {"ok": True} and crustdata.BUDGET.spent == 2


def test_corrupt_crustdata_cache_is_a_miss(tmp_path, monkeypatch):
    monkeypatch.setattr(crustdata, "CACHE", tmp_path)
    monkeypatch.setenv("CRUSTDATA_API_KEY", "test")
    body = {"q": 3}
    (tmp_path / f"{crustdata._key('/x', body)}.json").write_text("{half")
    monkeypatch.setattr(crustdata.httpx, "post", lambda *a, **k: _Resp(200, {"fresh": 1}))
    assert crustdata._post("/x", body, 0)["body"] == {"fresh": 1}


def test_html_report_escapes_untrusted_text(tmp_path):
    md = tmp_path / "report.md"
    md.write_text("| Vendor |\n|---|\n| <script>alert(1)</script> Acme |\n")
    html = report.write_html(md).read_text()
    assert "<script>" not in html and "&lt;script&gt;" in html


def test_tool_errors_puts_the_exception_in_span_output(monkeypatch):
    from spendradar import tracing

    seen = {}

    class Span:
        def set_attribute(self, k, v):
            seen[k] = v

    monkeypatch.setattr("opentelemetry.trace.get_current_span", lambda: Span())

    @tracing.tool_errors
    def boom():
        raise files.ToolError("no /Root object")

    with pytest.raises(files.ToolError):
        boom()
    assert "no /Root object" in seen["output.value"]


def test_set_io_keeps_long_values_valid_json():
    from spendradar import tracing

    seen = {}

    class Span:
        def set_attribute(self, k, v):
            seen[k] = v

    tracing.set_io(Span(), output={"x": "y" * 50_000})
    out = json.loads(seen["output.value"])
    assert out["truncated"] is True and len(seen["output.value"]) <= tracing.MAX_IO
