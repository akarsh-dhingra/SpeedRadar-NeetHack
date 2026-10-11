"""LLM title classifier: job title → spend category (ml_ai has no Crustdata role)."""

from __future__ import annotations

from typing import Literal

import neatlogs
from pydantic import BaseModel

from spendradar import llm, prompts
from spendradar.tracing import tool_errors


class TitleLabel(BaseModel):
    title: str
    category: Literal["engineering", "ml_ai", "sales", "marketing", "other"]


class TitleBatch(BaseModel):
    labels: list[TitleLabel]


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
