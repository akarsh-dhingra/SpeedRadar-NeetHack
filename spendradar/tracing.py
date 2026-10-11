"""neatlogs setup and secret masking.

`init_tracing()` must run before the Gemini client is constructed so the
google_genai instrumentation can patch it. Every exported telemetry item goes
through `mask_secrets`, which blanks secret-looking attributes and scrubs key
formats and every secret value loaded from .env out of all text.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from typing import Any

import neatlogs

SECRET_ENV_VARS = (
    "NEATLOGS_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "CRUSTDATA_API_KEY",
    "OPENAI_API_KEY",
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
    re.compile(r"sk_[0-9a-f]{32}"),  # sk_ + 32 hex provider keys
    re.compile(r"sk-(proj-|svcacct-|admin-)?[0-9A-Za-z_\-]{20,}"),  # OpenAI
    re.compile(r"(?i)bearer\s+[0-9A-Za-z._\-]{16,}"),
]
MASK = "***"
MAX_IO = 10000


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


def set_io(span, input: Any = None, output: Any = None) -> None:
    """Fill the span's Input/Output panes in neatlogs (OpenInference input.value/output.value);
    custom spendradar.* attributes alone leave them empty, and detections match on these."""
    for key, val in (("input.value", input), ("output.value", output)):
        if val is not None:
            text = val if isinstance(val, str) else json.dumps(val, default=str)
            if len(text) > MAX_IO:  # keep it valid JSON (neatlogs renders it), never cut mid-structure
                text = json.dumps({"truncated": True, "chars": len(text), "head": text[:MAX_IO - 200]})
            span.set_attribute(key, text)


def record_error(name: str, error: str, **inputs: Any) -> None:
    """A GUARDRAIL span with ERROR status for a failure the agent caught and carried on from,
    so caught failures stay visible in neatlogs instead of vanishing into a note."""
    from opentelemetry.trace import Status, StatusCode

    with neatlogs.trace(name, kind="GUARDRAIL") as span:
        set_io(span, input=inputs or None, output={"error": error[:1000]})
        span.set_attribute("spendradar.error", error[:500])
        span.set_status(Status(StatusCode.ERROR, error[:200]))


def git_sha() -> str:
    """Short HEAD sha, with '-dirty' when tracked files differ from it (so a run never claims a commit it didn't run)."""
    try:
        sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
        dirty = subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=no"], text=True).strip()
        return f"{sha}-dirty" if dirty else sha
    except Exception:
        return "nogit"


def init_tracing(run_id: str, extra_tags: list[str] | None = None) -> list[str]:
    """Initialise neatlogs for one process (= one run). Tags are process-wide."""
    tags = [f"sha:{git_sha()}", f"run:{run_id}", *(extra_tags or [])]
    if not os.environ.get("NEATLOGS_API_KEY"):
        print("warning: NEATLOGS_API_KEY not set; running untraced", file=sys.stderr)
        return tags
    try:
        _init(tags)
    except Exception as e:  # tracing must never stop the agent; spans become no-ops
        print(f"warning: neatlogs init failed ({type(e).__name__}: {e}); running untraced", file=sys.stderr)
    return tags


def _init(tags: list[str]) -> None:
    neatlogs.init(
        api_key=os.environ["NEATLOGS_API_KEY"],
        workflow_name="spendradar",
        instrumentations=["google_genai", "openai"],
        tags=tags,
        mask=mask_secrets,
    )


def shutdown_tracing() -> None:
    try:
        neatlogs.flush()
        neatlogs.shutdown()
    except Exception as e:  # never mask the run's own outcome with an export error
        print(f"warning: neatlogs flush/shutdown failed ({type(e).__name__}: {e})", file=sys.stderr)
