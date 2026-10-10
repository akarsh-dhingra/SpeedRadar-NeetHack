"""Crustdata tools with response cache, backoff, credit cap and fault injection."""

from __future__ import annotations

import hashlib
import json
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import neatlogs
import yaml

from spendradar import faults
from spendradar.tools.files import ToolError

BASE = "https://api.crustdata.com"
CACHE = Path("cache/crustdata")
CFG = yaml.safe_load(Path("config.yaml").read_text(encoding="utf-8"))["crustdata"]
ENRICH_FIELDS = ["basic_info", "headcount", "funding", "hiring", "news"]
ENRICH_CREDITS = 2.0
JOB_RESULT_CREDITS = 0.03


class CreditBudget:
    def __init__(self, cap: float):
        self.cap, self.spent = cap, 0.0

    def charge(self, credits: float) -> None:
        if self.spent + credits > self.cap:
            raise ToolError(f"crustdata credit cap reached ({self.spent:.2f}/{self.cap} credits)")
        self.spent += credits


BUDGET = CreditBudget(CFG["max_credits_per_run"])
FIXTURE_DIR: Path | None = None  # set only by `--fixtures` (evals); never in product runs


def _key(path: str, body: dict) -> str:
    return hashlib.sha256(json.dumps([path, body], sort_keys=True).encode()).hexdigest()[:24]


def _post(path: str, body: dict, est_credits: float) -> dict:
    """POST with cache → retries/backoff → stale-cache fallback. Returns {body, fetched_at, from_cache, ...}."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cpath = CACHE / f"{_key(path, body)}.json"
    cached = json.loads(cpath.read_text(encoding="utf-8")) if cpath.exists() else None
    crustdata_fault_pending = any(f.startswith("crustdata:") for f in faults._active)
    if cached and not crustdata_fault_pending:
        return {**cached, "from_cache": True}
    headers = {"authorization": f"Bearer {os.environ['CRUSTDATA_API_KEY']}",
               "content-type": "application/json", "x-api-version": "2025-11-01"}
    errors = []
    for attempt in range(CFG["retries"] + 1):
        with neatlogs.trace(f"http:crustdata{path}", kind="TOOL") as span:
            span.set_attribute("spendradar.attempt", attempt)
            try:
                if faults.fire("crustdata:429"):
                    raise httpx.HTTPStatusError("[injected] 429 Too Many Requests", request=None, response=None)
                if faults.fire("crustdata:timeout"):
                    raise httpx.ReadTimeout("[injected] read timeout")
                BUDGET.charge(est_credits)
                r = httpx.post(BASE + path, json=body, headers=headers, timeout=60)
                if r.status_code == 429 or r.status_code >= 500:
                    raise httpx.HTTPStatusError(f"{r.status_code}", request=r.request, response=r)
                r.raise_for_status()
                out = {"body": r.json(), "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                       "endpoint": path, "request_id": r.headers.get("x-request-id", ""), "credits": est_credits}
                cpath.write_text(json.dumps(out), encoding="utf-8")
                span.set_attribute("spendradar.outcome", "ok")
                return {**out, "from_cache": False}
            except ToolError:
                raise
            except (httpx.HTTPStatusError, httpx.TransportError) as e:
                errors.append(str(e)[:120])
                span.set_attribute("spendradar.outcome", f"retryable: {str(e)[:120]}")
        if attempt < CFG["retries"]:
            time.sleep((2 ** attempt) * 1.0 + random.random())
    if cached:  # recovery: stale cache beats nothing
        with neatlogs.trace("recover:crustdata_cache_fallback", kind="CHAIN") as span:
            span.set_attribute("spendradar.errors", json.dumps(errors))
        return {**cached, "from_cache": True, "stale_fallback": True, "errors": errors}
    raise ToolError(f"crustdata {path} failed after {CFG['retries'] + 1} attempts: {errors[-1]}")


@neatlogs.span(kind="TOOL", name="act:crustdata_company", tool_name="crustdata_company")
def crustdata_company(domain: str) -> dict:
    fx = FIXTURE_DIR / f"{domain}.json" if FIXTURE_DIR else None
    if fx and fx.exists():
        res = {**json.loads(fx.read_text(encoding="utf-8")), "from_cache": True}
        with neatlogs.trace("fixture:crustdata", kind="TOOL") as span:
            span.set_attribute("spendradar.fixture", json.dumps(res.get("fixture")))
    else:
        res = _post("/company/enrich", {"domains": [domain], "fields": ENRICH_FIELDS}, ENRICH_CREDITS)
    body = res["body"]
    matches = body[0].get("matches") if isinstance(body, list) and body else None
    if not matches:
        raise ToolError(f"no Crustdata match for {domain}")
    return {**res, "company_data": matches[0]["company_data"], "body": None, "fixture": res.get("fixture")}


@neatlogs.span(kind="TOOL", name="act:crustdata_jobs", tool_name="crustdata_jobs")
def crustdata_jobs(domain: str, since: str, category: str | None = None, limit: int = 60) -> dict:
    conds = [{"field": "company.basic_info.primary_domain", "type": "=", "value": domain},
             {"field": "metadata.date_added", "type": "=>", "value": since}]
    if category:
        conds.append({"field": "job_details.category", "type": "=", "value": category})
    body = {"filters": {"op": "and", "conditions": conds}, "limit": limit,
            "fields": ["job_details.title", "job_details.category", "metadata.date_added"],
            "sorts": [{"field": "metadata.date_added", "order": "desc"}]}
    res = _post("/job/search", body, JOB_RESULT_CREDITS * limit)
    jobs = res["body"].get("job_listings") or []
    titles = [{"title": (j.get("job_details") or {}).get("title"),
               "category": (j.get("job_details") or {}).get("category"),
               "date_added": (j.get("metadata") or {}).get("date_added")} for j in jobs]
    return {**res, "body": None, "total_count": res["body"].get("total_count"), "titles": titles}
