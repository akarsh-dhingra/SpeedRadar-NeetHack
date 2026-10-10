"""Secrets must never leave the process in a neatlogs telemetry item."""

from spendradar.tracing import MASK, mask_secrets, scrub_text

FAKE_GOOGLE = "AIza" + "S" * 35
FAKE_OPENROUTER = "sk-or-v1-" + "a" * 40
FAKE_CRUSTDATA = "cd_live_0123456789abcdef"


def test_known_key_formats_are_scrubbed():
    text = f"key={FAKE_GOOGLE} other={FAKE_OPENROUTER} auth=Bearer abcdefghijklmnopqrstuv"
    out = scrub_text(text, secrets=[])
    assert FAKE_GOOGLE not in out and FAKE_OPENROUTER not in out
    assert "abcdefghijklmnopqrstuv" not in out


def test_env_secret_values_are_scrubbed_anywhere(monkeypatch):
    monkeypatch.setenv("CRUSTDATA_API_KEY", FAKE_CRUSTDATA)
    item = {
        "name": "act:crustdata_company",
        "attributes": {
            "input": f'{{"headers": {{"x": "{FAKE_CRUSTDATA}"}}}}',
            "nested": [{"note": f"used {FAKE_CRUSTDATA} here"}],
        },
    }
    out = mask_secrets(item)
    assert FAKE_CRUSTDATA not in repr(out)


def test_secret_named_attributes_are_blanked_but_token_counts_kept():
    item = {"attributes": {"api_key": "whatever-value", "gen_ai.usage.input_tokens": 120, "authorization": "x"}}
    out = mask_secrets(item)["attributes"]
    assert out["api_key"] == MASK and out["authorization"] == MASK
    assert out["gen_ai.usage.input_tokens"] == 120


def test_sk_underscore_hex_key_format_is_scrubbed():
    fake = "sk_" + "0" * 32
    assert fake not in scrub_text(f"Authorization: {fake}", secrets=[])
