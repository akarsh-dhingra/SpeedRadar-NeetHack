"""LLM title classifier: job title → spend category (ml_ai has no Crustdata role)."""

from __future__ import annotations

from typing import Literal

import neatlogs
from pydantic import BaseModel, field_validator

from spendradar import llm, prompts
from spendradar.tracing import tool_errors


class TitleLabel(BaseModel):
    title: str
    category: Literal["engineering", "ml_ai", "sales", "marketing", "other"]


class TitleBatch(BaseModel):
    labels: list[TitleLabel]

    @field_validator("labels", mode="before")
    @classmethod
    def _unwrap_schema_echo(cls, v):
        # Some models echo the JSON schema around the answer: {"items": [...labels...], "type": "array"}.
        # The labels inside are valid, so unwrap them (2 of 10 case-study-02 runs lost a competitor's
        # ML/AI estimate to this after 2 re-asks; runs 1011-2c53f4 t31, 1011-6d3ba6 t28).
        if isinstance(v, dict) and isinstance(v.get("items"), list):
            return v["items"]
        return v


@neatlogs.span(kind="TOOL", name="act:classify_titles", tool_name="classify_titles")
@tool_errors
def classify_titles(titles: list[str], batch: int = 40) -> tuple[dict[str, dict], list[dict]]:
    """Returns ({title: {category, model}}, [llm usage per call])."""
    uniq = sorted({t for t in titles if t})
    out: dict[str, dict] = {}
    usage = []
    for i in range(0, len(uniq), batch):
        chunk = uniq[i:i + batch]
        with prompts.use(prompts.CLASSIFY_TITLES, titles="\n".join(f"- {t}" for t in chunk)) as (system, prompt):
            res = llm.complete("extract", prompt, system=system, schema=TitleBatch)
        usage.append({"model": res.model, "tokens_in": res.tokens_in, "tokens_out": res.tokens_out,
                      "latency_s": res.latency_s, "cached": res.cached, "reasks": res.reasks,
                      "fallbacks": res.fallbacks})
        # Models echo titles trimmed; match on the stripped form and key by the original title,
        # or titles with stray whitespace (common in Crustdata) are silently dropped.
        by_stripped = {t.strip(): t for t in chunk}
        for lab in res.parsed.labels:
            orig = by_stripped.get(lab.title.strip())
            if orig is not None:
                out[orig] = {"category": lab.category, "model": res.model}
    return out, usage
