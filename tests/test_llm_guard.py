import pytest

from spendradar import llm


@pytest.fixture(autouse=True)
def _only_free_providers(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test")


def test_openrouter_refuses_non_free_model():
    with pytest.raises(llm.NotFreeModelError):
        llm._call_openrouter("openai/gpt-5", "hi", None, None, None)


def test_every_configured_openrouter_model_is_free():
    for role in llm.CONFIG["roles"].values():
        for m in role.get("openrouter", []):
            assert m.endswith(":free"), m


def test_strip_fences():
    assert llm._strip_fences('```json\n{"a": 1}\n```') == '{"a": 1}'


def test_injected_fault_does_not_mark_ledger_exhausted(tmp_path, monkeypatch):
    from spendradar import faults

    ledger = llm.Ledger(tmp_path / "ledger.json")
    monkeypatch.setattr(llm, "LEDGER", ledger)
    monkeypatch.setattr(llm, "cache_enabled", lambda: False)
    calls = []

    def fake_gemini(model, *a, **k):
        if faults.fire("llm:429"):
            raise llm._Retryable("injected", "x")
        calls.append(model)
        return "ok", None, 1, 1

    monkeypatch.setattr(llm, "_call_gemini", fake_gemini)
    monkeypatch.setattr(ledger, "wait_turn", lambda m: None)
    faults.configure(["llm:429"])
    res = llm._run_chain("reason", "p", None, None, None)
    first = llm.CONFIG["roles"]["reason"]["gemini"][0]
    assert res.model != first and res.fallbacks == [res.model]
    assert ledger.remaining(first) > 0


def test_exclude_removes_model_from_chain(tmp_path, monkeypatch):
    ledger = llm.Ledger(tmp_path / "ledger.json")
    monkeypatch.setattr(llm, "LEDGER", ledger)
    monkeypatch.setattr(llm, "cache_enabled", lambda: False)
    monkeypatch.setattr(ledger, "wait_turn", lambda m: None)
    used = []
    fake = lambda m, *a, **k: (used.append(m), ("ok", None, 1, 1))[1]  # noqa: E731
    monkeypatch.setattr(llm, "_call_openrouter", fake)
    monkeypatch.setattr(llm, "_call_gemini", fake)
    first = llm._chain("second_opinion")[0][1]
    res = llm._run_chain("second_opinion", "p", None, None, None, None, exclude=(first,))
    assert res.model != first and first not in used


def test_menu_schema_enumerates_options():
    sch = llm._menu_schema([{"name": "skip", "description": "d1"}, {"name": "reparse_alt", "description": "d2"}])
    assert sch["properties"]["action"]["enum"] == ["skip", "reparse_alt"] and sch["required"] == ["action", "reason"]


def test_json_reask_stays_on_the_same_role(monkeypatch):
    from pydantic import BaseModel

    class V(BaseModel):
        verdict: str

    roles = []

    def fake_chain(role, prompt, system, schema, tools, attachments=None, exclude=()):
        roles.append(role)
        return llm.LLMResult(text="not json" if len(roles) == 1 else '{"verdict": "confirm"}', model="m")

    monkeypatch.setattr(llm, "_run_chain", fake_chain)
    res = llm.complete("reason", "p", schema=V)
    assert roles == ["reason", "reason"] and res.parsed.verdict == "confirm" and res.reasks == 1


def test_paid_model_skipped_after_daily_usd_cap(tmp_path, monkeypatch):
    ledger = llm.Ledger(tmp_path / "ledger.json")
    monkeypatch.setitem(llm.CONFIG, "max_usd_per_day", 0.01)
    ledger.record("gpt-5-nano", 100_000, 20_000)  # 0.005 + 0.008 = $0.013
    assert ledger.usd_today() > 0.01 and ledger.remaining("gpt-5-nano") == 0


def test_missing_key_drops_provider(monkeypatch):
    assert all(p != "openai" for p, _ in llm._chain("reason"))
    monkeypatch.setenv("OPENAI_API_KEY", "x")
    assert llm._chain("reason")[0] == ("openai", "gpt-5-nano")
