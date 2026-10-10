"""Build fault-injected competitor fixtures for evals ONLY.

Each fixture = a cached REAL Crustdata enrich response with exactly one field changed on
purpose, recorded in evals/ground_truth.json. Product runs never read these; only
`spendradar run --fixtures evals/fixtures` does, and such runs are labelled data_mode=fixture.
Run: uv run python evals/make_fixtures.py
"""

import json
from pathlib import Path

CACHE = Path("cache/crustdata")
OUT = Path("evals/fixtures")
TRUTH = Path("evals/ground_truth.json")

FIXTURES = [
    {"id": "fixture_sentry_marketing_x5", "domain": "sentry.io", "category": "marketing",
     "path": ["headcount", "by_role_absolute", "Marketing"], "factor": 5,
     "expected": "role headcount disagrees with function timeseries; audit downgrades/overturns the marketing finding"},
]


def find_cached(domain: str) -> dict:
    for f in CACHE.glob("*.json"):
        d = json.loads(f.read_text())
        b = d.get("body")
        if isinstance(b, list) and b and b[0].get("matched_on") == domain:
            return d
    raise SystemExit(f"no cached enrich for {domain}; run the agent once first")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    truth = json.loads(TRUTH.read_text())
    truth["fixtures"] = []
    for fx in FIXTURES:
        d = find_cached(fx["domain"])
        node = d["body"][0]["matches"][0]["company_data"]
        for k in fx["path"][:-1]:
            node = node[k]
        real = node[fx["path"][-1]]
        node[fx["path"][-1]] = real * fx["factor"]
        d["fixture"] = {"id": fx["id"], "changed": ".".join(fx["path"]), "real_value": real,
                        "fixture_value": real * fx["factor"], "note": "ALTERED ON PURPOSE FOR EVALS"}
        (OUT / f"{fx['domain']}.json").write_text(json.dumps(d))
        truth["fixtures"].append({"id": fx["id"], "type": "fixture", "domain": fx["domain"],
                                  "category": fx["category"], "changed": ".".join(fx["path"]),
                                  "real_value": real, "fixture_value": real * fx["factor"],
                                  "expected": fx["expected"]})
        print(f"{fx['id']}: {'.'.join(fx['path'])} {real} -> {real * fx['factor']}")
    TRUTH.write_text(json.dumps(truth, indent=2))


if __name__ == "__main__":
    main()
