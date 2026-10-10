"""neatlogs setup and secret masking.

`init_tracing()` must run before the Gemini client is constructed so the
google_genai instrumentation can patch it. Every exported telemetry item goes
through `mask_secrets`, which blanks secret-looking attributes and scrubs key
formats and every secret value loaded from .env out of all text.
"""

from __future__ import annotations

import os
import re
import subprocess
from typing import Any

import neatlogs

SECRET_ENV_VARS = (
    "NEATLOGS_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "CRUSTDATA_API_KEY",
    "SMALLEST_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
)
SECRET_KEY_WORDS = ("api_key", "apikey", "secret", "token", "password", "authorization")
# Token-count attributes contain "token" but are not secrets.
SAFE_KEY_WORDS = ("token_count", "tokens", "usage")
KEY_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),  # Google API key
    re.compile(r"sk-or-[0-9A-Za-z_\-]{20,}"),  # OpenRouter
    re.compile(r"sk-ant-[0-9A-Za-z_\-]{20,}"),  # Anthropic
    re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS access key id
    re.compile(r"sk_[0-9a-f]{32}"),  # smallest (gpt-5-nano)
    re.compile(r"(?i)bearer\s+[0-9A-Za-z._\-]{16,}"),
]
MASK = "***"


def _secret_values() -> list[str]:
    return [v for k in SECRET_ENV_VARS if len(v := os.environ.get(k, "")) >= 8]


def scrub_text(text: str, secrets: list[str] | None = None) -> str:
    for value in secrets if secrets is not None else _secret_values():
        text = text.replace(value, MASK)
    for pattern in KEY_PATTERNS:
        text = pattern.sub(MASK, text)
    return text


def _is_secret_key(key: str) -> bool:
    k = key.lower()
    if any(w in k for w in SAFE_KEY_WORDS):
        return False
    return any(w in k for w in SECRET_KEY_WORDS)


def _scrub(value: Any, secrets: list[str]) -> Any:
    if isinstance(value, str):
        return scrub_text(value, secrets)
    if isinstance(value, dict):
        return {k: (MASK if _is_secret_key(str(k)) else _scrub(v, secrets)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_scrub(v, secrets) for v in value)
    return value


def mask_secrets(item: dict, *, context: Any = None) -> dict:
    """neatlogs `mask` callback: runs on every telemetry item before export."""
    return _scrub(item, _secret_values())


def git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "nogit"


def init_tracing(run_id: str, extra_tags: list[str] | None = None) -> list[str]:
    """Initialise neatlogs for one process (= one run). Tags are process-wide."""
    tags = [f"sha:{git_sha()}", f"run:{run_id}", *(extra_tags or [])]
    neatlogs.init(
        api_key=os.environ["NEATLOGS_API_KEY"],
        workflow_name="spendradar",
        instrumentations=["google_genai"],
        tags=tags,
        mask=mask_secrets,
    )
    return tags


def shutdown_tracing() -> None:
    neatlogs.flush()
    neatlogs.shutdown()
