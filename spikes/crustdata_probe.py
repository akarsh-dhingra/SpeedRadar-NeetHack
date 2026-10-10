"""Throwaway Step 1 spike: which Crustdata fields exist for our candidate competitors?

Calls company enrich (one batched request) and a jobs-by-category aggregation per
company, saves the raw JSON to cache/crustdata/probe/, and prints a field-coverage
summary. Run: uv run spikes/crustdata_probe.py
"""

# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx", "python-dotenv"]
# ///

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

BASE = "https://api.crustdata.com"
CANDIDATES = {
    "Datadog": "datadoghq.com",
    "Grafana Labs": "grafana.com",
    "Chronosphere": "chronosphere.io",
    "Honeycomb": "honeycomb.io",
    "Arize": "arize.com",
    "New Relic": "newrelic.com",
    "Sentry": "sentry.io",
}
OUT = Path("cache/crustdata/probe")


def save(name: str, payload: object) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(payload, indent=2))


def main() -> None:
    load_dotenv()
    key = os.environ.get("CRUSTDATA_API_KEY")
    if not key:
        sys.exit("CRUSTDATA_API_KEY missing from .env")
    headers = {
        "authorization": f"Bearer {key}",
        "content-type": "application/json",
        "x-api-version": "2025-11-01",
    }
    client = httpx.Client(base_url=BASE, headers=headers, timeout=60)
    stamp = datetime.now(timezone.utc).isoformat()

    # Real per-endpoint prices for this account, before spending anything.
    r = client.get("/account/endpoints")
    save("account_endpoints", {"status": r.status_code, "fetched_at": stamp, "body": r.json() if r.is_success else r.text})
    print(f"account/endpoints -> {r.status_code}")
    if "--prices-only" in sys.argv:
        return

    r = client.post(
        "/company/enrich",
        json={"domains": list(CANDIDATES.values()), "fields": ["basic_info", "headcount", "funding", "hiring"]},
    )
    enrich = r.json() if r.is_success else r.text
    save("enrich", {"status": r.status_code, "fetched_at": stamp, "body": enrich})
    print(f"company/enrich -> {r.status_code}")

    jobs = {}
    for name, domain in CANDIDATES.items():
        r = client.post(
            "/job/search",
            json={
                "filters": {"op": "and", "conditions": [
                    {"field": "company.basic_info.primary_domain", "type": "=", "value": domain},
                ]},
                "limit": 0,
                "aggregations": [{"type": "group_by", "field": "job_details.category", "agg": "count", "size": 50}],
            },
        )
        jobs[name] = r.json() if r.is_success else r.text
        save(f"jobs_{domain}", {"status": r.status_code, "fetched_at": stamp, "body": jobs[name]})
        print(f"job/search {domain} -> {r.status_code}")

    # Coverage summary
    print("\n== coverage ==")
    by_domain = {}
    if isinstance(enrich, list):
        for entry in enrich:
            matches = entry.get("matches") or []
            by_domain[entry.get("matched_on")] = matches[0]["company_data"] if matches else None
    for name, domain in CANDIDATES.items():
        cd = by_domain.get(domain) or {}
        hc = cd.get("headcount") or {}
        roles = hc.get("by_role_absolute") or {}
        growth = hc.get("growth_percent") or {}
        fund = cd.get("funding") or {}
        j = jobs.get(name)
        buckets = []
        if isinstance(j, dict):
            for agg in j.get("aggregations") or []:
                buckets = agg.get("buckets") or []
        print(
            f"{name:13} total={hc.get('total')!s:6} roles={len(roles):2} "
            f"growth={sorted(growth)} funding_keys={len(fund)} "
            f"jobs_total={j.get('total_count') if isinstance(j, dict) else 'ERR'} job_cats={len(buckets)}"
        )
        if roles:
            print(f"   role keys: {sorted(roles)}")


if __name__ == "__main__":
    main()
