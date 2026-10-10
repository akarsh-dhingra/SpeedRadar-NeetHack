"""The only door to language models.

`complete()` returns text or a validated Pydantic object; `choose()` makes the
model pick one function from a fixed menu via native function calling. Both walk
a per-role fallback chain: each Gemini model (with retries and backoff), then
OpenRouter `:free` models. Every hop away from the first model is a
`fallback:<model>` span. The ledger tracks requests and tokens per model per day
and refuses calls to models already out of daily quota.
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import threading
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, TypeVar

import httpx
import neatlogs
import yaml
from pydantic import BaseModel, ValidationError

from spendradar import faults

T = TypeVar("T", bound=BaseModel)

CONFIG = yaml.safe_load(Path("config.yaml").read_text())["llm"]
LEDGER_PATH = Path("cache/ledger.json")
CACHE_DIR = Path("cache/llm")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class LLMError(RuntimeError):
    """Every model in the chain failed."""


class NotFreeModelError(ValueError):
    """Refused: OpenRouter model ID does not end in ':free'."""


class _Retryable(Exception):
    def __init__(self, kind: str, msg: str, retry_after: float | None = None):
        super().__init__(msg)
        self.kind = kind  # "minute" | "day" | "server" | "timeout" | "injected"
        self.retry_after = retry_after


@dataclass
class LLMResult:
    text: str
    parsed: Any = None
    model: str = ""
    provider: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    latency_s: float = 0.0
    cached: bool = False
    fallbacks: list[str] = field(default_factory=list)
    reasks: int = 0


@dataclass
class Choice:
    name: str
    args: dict
    result: LLMResult


# ---------------------------------------------------------------- ledger + rate limit

class Ledger:
    """Requests/tokens per model per day, persisted to cache/ledger.json."""

    def __init__(self, path: Path = LEDGER_PATH):
        self.path = path
        self.lock = threading.Lock()
        self.data: dict = json.loads(path.read_text()) if path.exists() else {}
        self.last_call: dict[str, float] = {}

    def _day(self, model: str) -> dict:
        today = self.data.setdefault(date.today().isoformat(), {})
        return today.setdefault(model, {"requests": 0, "tokens_in": 0, "tokens_out": 0, "exhausted": False})

    def limits(self, model: str) -> dict:
        lim = CONFIG["limits"]
        return lim["openrouter_free"] if model.endswith(":free") else lim["default_gemini"]

    def remaining(self, model: str) -> int:
        d = self._day(model)
        return 0 if d["exhausted"] else max(0, self.limits(model)["rpd"] - d["requests"])

    def wait_turn(self, model: str) -> None:
        gap = 60.0 / self.limits(model)["rpm"]
        with self.lock:
            wait = self.last_call.get(model, 0) + gap - time.monotonic()
            self.last_call[model] = time.monotonic() + max(0.0, wait)
        if wait > 0:
            time.sleep(wait)

    def record(self, model: str, tokens_in: int, tokens_out: int) -> None:
        with self.lock:
            d = self._day(model)
            d["requests"] += 1
            d["tokens_in"] += tokens_in
            d["tokens_out"] += tokens_out
            self._save()

    def mark_exhausted(self, model: str) -> None:
        with self.lock:
            self._day(model)["exhausted"] = True
            self._save()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2, sort_keys=True))

    def summary(self) -> dict:
        return self.data.get(date.today().isoformat(), {})


LEDGER = Ledger()


def cache_enabled() -> bool:
    return os.environ.get("SPENDRADAR_LLM_CACHE", "1") == "1"


# ---------------------------------------------------------------- providers

_gemini_client = None


def _gemini():
    global _gemini_client
    if _gemini_client is None:  # constructed lazily, i.e. after neatlogs.init()
        from google import genai

        from google.genai import types

        # Bounded per-call latency: a slow free-tier call times out and the chain moves on.
        _gemini_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"],
                                      http_options=types.HttpOptions(timeout=CONFIG["gemini_timeout_s"] * 1000))
    return _gemini_client


def _classify_gemini_error(e: Exception) -> _Retryable | None:
    from google.genai import errors

    if isinstance(e, httpx.TimeoutException):
        return _Retryable("timeout", f"no response within {CONFIG['gemini_timeout_s']}s")
    if isinstance(e, errors.ServerError):
        return _Retryable("server", str(e)[:300])
    if isinstance(e, errors.ClientError) and e.code == 429:
        msg = str(e)
        if "PerDay" in msg and "PerMinute" not in msg:
            return _Retryable("day", msg[:300])
        # Requests per minute, or an input-token quota of 0 (both minute and day
        # listed) — treat a quota that names PerDay alongside as exhausted too.
        return _Retryable("day" if "PerDay" in msg else "minute", msg[:300])
    return None


def _call_gemini(model: str, prompt: str, system: str | None, schema: type[BaseModel] | None,
                 tools: list[dict] | None, attachments: list[tuple[bytes, str]] | None = None) -> tuple[str, Any, int, int]:
    from google.genai import types

    if faults.fire(f"llm:{model}:429") or faults.fire("llm:429"):
        raise _Retryable("injected", f"[injected] 429 RESOURCE_EXHAUSTED for {model}")
    cfg: dict[str, Any] = {"system_instruction": system} if system else {}
    if schema is not None:
        cfg.update(response_mime_type="application/json", response_json_schema=schema.model_json_schema())
    if tools:
        cfg["tools"] = [types.Tool(function_declarations=[
            types.FunctionDeclaration(name=t["name"], description=t["description"],
                                      parameters_json_schema=t["parameters"]) for t in tools])]
        cfg["tool_config"] = types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="ANY"))
    try:
        contents: Any = prompt
        if attachments:
            contents = [types.Part.from_bytes(data=b, mime_type=mt) for b, mt in attachments] + [prompt]
        r = _gemini().models.generate_content(model=model, contents=contents,
                                              config=types.GenerateContentConfig(**cfg))
    except Exception as e:
        retry = _classify_gemini_error(e)
        if retry:
            raise retry from e
        # Bad input (e.g. 400 on a corrupt PDF) fails on every model: stop the chain.
        raise LLMError(f"{model}: non-retryable: {str(e)[:200]}") from e
    u = r.usage_metadata
    tin = (u.prompt_token_count or 0) if u else 0
    tout = ((u.candidates_token_count or 0) + (u.thoughts_token_count or 0)) if u else 0
    call = None
    if tools and r.function_calls:
        fc = r.function_calls[0]
        call = {"name": fc.name, "args": dict(fc.args or {})}
    return r.text or "", call, tin, tout


def _call_openrouter(model: str, prompt: str, system: str | None, schema: type[BaseModel] | None,
                     tools: list[dict] | None, attachments: list[tuple[bytes, str]] | None = None) -> tuple[str, Any, int, int]:
    if attachments:
        raise ValueError("OpenRouter fallback does not take file attachments")
    if not model.endswith(":free"):
        raise NotFreeModelError(f"refusing non-free OpenRouter model {model!r}")
    if faults.fire("llm:openrouter:429"):
        raise _Retryable("injected", f"[injected] 429 for {model}")
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    body: dict[str, Any] = {"model": model, "messages": messages}
    if schema is not None:
        body["response_format"] = {"type": "json_schema", "json_schema": {
            "name": schema.__name__, "strict": True, "schema": schema.model_json_schema()}}
    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
        body["tool_choice"] = "required"
    with neatlogs.trace(f"llm:openrouter:{model}", kind="LLM") as span:
        span.set_attribute("gen_ai.system", "openrouter")
        span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("gen_ai.prompt", prompt[:8000])
        r = httpx.post(OPENROUTER_URL, json=body, timeout=CONFIG["timeout_s"],
                       headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"})
        if r.status_code == 429:
            raise _Retryable("minute", r.text[:300])
        if r.status_code >= 500:
            raise _Retryable("server", r.text[:300])
        r.raise_for_status()
        j = r.json()
        if "error" in j:
            raise _Retryable("server", str(j["error"])[:300])
        msg = j["choices"][0]["message"]
        usage = j.get("usage") or {}
        tin, tout = usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
        span.set_attribute("gen_ai.completion", (msg.get("content") or "")[:8000])
        span.set_attribute("gen_ai.usage.input_tokens", tin)
        span.set_attribute("gen_ai.usage.output_tokens", tout)
    call = None
    if tools and msg.get("tool_calls"):
        fn = msg["tool_calls"][0]["function"]
        call = {"name": fn["name"], "args": json.loads(fn.get("arguments") or "{}")}
    return msg.get("content") or "", call, tin, tout


# ---------------------------------------------------------------- the chain

def _chain(role: str) -> list[tuple[str, str]]:
    r = CONFIG["roles"][role]
    return [("gemini", m) for m in r.get("gemini", [])] + [("openrouter", m) for m in r.get("openrouter", [])]


def _cache_key(role: str, prompt: str, system: str | None, schema, tools, attachments=None) -> str:
    att = [hashlib.sha256(b).hexdigest() for b, _ in attachments or []]
    blob = json.dumps([role, prompt, system, schema.__name__ if schema else None, tools, att], sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


def _run_chain(role: str, prompt: str, system: str | None, schema: type[BaseModel] | None,
               tools: list[dict] | None, attachments: list[tuple[bytes, str]] | None = None,
               exclude: tuple[str, ...] = ()) -> LLMResult:
    key = _cache_key(role, prompt, system, schema, tools, attachments) + ("-x" + "-".join(exclude) if exclude else "")
    key = hashlib.sha256(key.encode()).hexdigest()[:24] if exclude else key
    path = CACHE_DIR / f"{key}.json"
    if cache_enabled() and path.exists():
        res = LLMResult(**json.loads(path.read_text()))
        res.cached = True
        return res

    # Models the ledger already knows are out of quota are routed around up front; that is
    # planned routing, not a fallback. A fallback is a hop after a call failed in *this* request.
    chain = [(p, m) for p, m in _chain(role) if LEDGER.remaining(m) > 0 and m not in exclude]
    fallbacks: list[str] = []
    errors: list[str] = []
    for i, (provider, model) in enumerate(chain):
        if LEDGER.remaining(model) <= 0:
            errors.append(f"{model}: daily quota exhausted (ledger)")
            continue
        if i > 0 and errors:
            fallbacks.append(model)
            with neatlogs.trace(f"fallback:{model}", kind="CHAIN") as span:
                span.set_attribute("spendradar.fallback.to", model)
                span.set_attribute("spendradar.fallback.provider", provider)
                span.set_attribute("spendradar.fallback.reasons", json.dumps(errors[-3:]))
        call = _call_gemini if provider == "gemini" else _call_openrouter
        for attempt in range(CONFIG["retries_per_model"] + 1):
            LEDGER.wait_turn(model)
            t0 = time.monotonic()
            try:
                text, fcall, tin, tout = call(model, prompt, system, schema, tools, attachments)
            except _Retryable as e:
                errors.append(f"{model}: {e.kind}: {str(e)[:120]}")
                if e.kind == "day":
                    LEDGER.mark_exhausted(model)
                    break
                if e.kind in ("injected", "timeout"):  # move on; never pollute the real quota ledger
                    break
                if attempt < CONFIG["retries_per_model"]:
                    time.sleep(min(30.0, (2 ** attempt) * 2 + random.random()))
                    continue
                break
            except (httpx.HTTPError, ValueError) as e:
                if isinstance(e, NotFreeModelError):
                    raise
                errors.append(f"{model}: {type(e).__name__}: {str(e)[:120]}")
                break
            LEDGER.record(model, tin, tout)
            res = LLMResult(text=text, parsed=fcall, model=model, provider=provider, tokens_in=tin,
                            tokens_out=tout, latency_s=round(time.monotonic() - t0, 2), fallbacks=fallbacks)
            if cache_enabled():
                CACHE_DIR.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(res.__dict__ | {"cached": False}, default=str))
            return res
    raise LLMError(f"all models failed for role {role!r}: " + " | ".join(errors[-6:]))


def complete(role: str, prompt: str, *, system: str | None = None, schema: type[T] | None = None,
             attachments: list[tuple[bytes, str]] | None = None, exclude: tuple[str, ...] = ()) -> LLMResult:
    """Text or validated JSON. Malformed JSON is re-asked with the validation error.

    `exclude` removes models from the chain (e.g. the model whose verdict a second opinion checks).
    """
    res = _run_chain(role, prompt, system, schema, None, attachments, exclude)
    if schema is None:
        return res
    reasks, current, last_err = 0, res, None
    while True:
        try:
            current.parsed = schema.model_validate_json(_strip_fences(current.text))
            current.reasks = reasks
            return current
        except ValidationError as e:
            last_err = e
            if reasks >= CONFIG["json_reasks"]:
                break
            reasks += 1
            with neatlogs.trace("recover:json_reask", kind="CHAIN") as span:
                span.set_attribute("spendradar.reask.attempt", reasks)
                span.set_attribute("spendradar.reask.error", str(e)[:1000])
                fix = (f"{prompt}\n\nYour previous reply was not valid for the required JSON schema.\n"
                       f"Validation error:\n{str(e)[:1500]}\n\nPrevious reply:\n{current.text[:3000]}\n\n"
                       "Reply again with ONLY corrected JSON.")
                current = _run_chain("extract", fix, system, schema, None, attachments)
    raise LLMError(f"JSON still invalid after {reasks} re-asks: {last_err}")


def choose(role: str, prompt: str, options: list[dict], *, system: str | None = None) -> Choice:
    """Native function calling: the model must call exactly one of `options`.

    Each option is {"name", "description", "parameters": JSON schema}.
    """
    res = _run_chain(role, prompt, system, None, options)
    names = {o["name"] for o in options}
    if not res.parsed or res.parsed.get("name") not in names:
        raise LLMError(f"model did not pick a valid option: {res.parsed!r} / {res.text[:200]!r}")
    return Choice(name=res.parsed["name"], args=res.parsed.get("args", {}), result=res)


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t
        t = t.rsplit("```", 1)[0]
    return t.strip()
