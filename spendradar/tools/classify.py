"""LLM title classifier: job title → spend category (ml_ai has no Crustdata role)."""

from __future__ import annotations

from typing import Literal

import neatlogs
from pydantic import BaseModel

from spendradar import llm

SYSTEM = (
    "You map job titles to spend categories for a people-cost comparison.\n"
    "engineering: software, infra, SRE, security, data engineering, developer advocacy.\n"
    "ml_ai: roles whose main job is building or researching ML/AI models or ML/AI products "
    "(ML engineer, applied scientist, AI engineer, research scientist, MLOps).\n"
    "sales: AE, SDR/BDR, sales engineering, solutions/pre-sales, partnerships, customer success.\n"
    "marketing: product/growth/brand/content marketing, events, comms.\n"
    "other: everything else (product management, design, finance, HR, ops, support, legal, interns "
    "that do not clearly fit). Classify by the role's work, not by buzzwords in the team name."
)


class TitleLabel(BaseModel):
    title: str
    category: Literal["engineering", "ml_ai", "sales", "marketing", "other"]


class TitleBatch(BaseModel):
    labels: list[TitleLabel]


@neatlogs.span(kind="TOOL", name="act:classify_titles", tool_name="classify_titles")
def classify_titles(titles: list[str], batch: int = 40) -> tuple[dict[str, dict], list[dict]]:
    """Returns ({title: {category, model}}, [llm usage per call])."""
    uniq = sorted({t for t in titles if t})
    out: dict[str, dict] = {}
    usage = []
    for i in range(0, len(uniq), batch):
        chunk = uniq[i:i + batch]
        prompt = "Classify each title. Return every title exactly as given.\n" + "\n".join(f"- {t}" for t in chunk)
        res = llm.complete("extract", prompt, system=SYSTEM, schema=TitleBatch)
        usage.append({"model": res.model, "tokens_in": res.tokens_in, "tokens_out": res.tokens_out,
                      "latency_s": res.latency_s, "cached": res.cached, "reasks": res.reasks})
        # Models echo titles trimmed; match on the stripped form and key by the original title,
        # or titles with stray whitespace (common in Crustdata) are silently dropped.
        by_stripped = {t.strip(): t for t in chunk}
        for lab in res.parsed.labels:
            orig = by_stripped.get(lab.title.strip())
            if orig is not None:
                out[orig] = {"category": lab.category, "model": res.model}
    return out, usage
