import pytest

from spendradar import llm


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

    def fake_gemini(model, *a):
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
