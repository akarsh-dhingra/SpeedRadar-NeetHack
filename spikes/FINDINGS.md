# Step 1 — Crustdata probe findings (10 Oct 2026, ~13:40 IST)

Raw responses: `cache/crustdata/probe/` (git-ignored). Script: `spikes/crustdata_probe.py`.

## Credits
- Balance 5200 → 5172: **28 credits spent**.
- `/company/enrich` = 2 credits/company (7 companies = 14). It ran twice because the first probe version re-enriched during the jobs test (14 wasted). The probe now reuses cached enrich data.
- `/job/search` with `limit: 0` + `group_by` aggregation: **0 credits** (balance unchanged across 7 calls).
- `/account/credits` and `/account/endpoints`: free.

## Fields that exist (all 7 companies)
| Field | Present | Notes |
|---|---|---|
| `headcount.total` | yes | |
| `headcount.by_role_absolute` | yes, 10–16 roles | Engineering, Sales, Marketing, Product Management, Support, … **No ML/AI role.** |
| `headcount.by_role_growth_6m_pct` / `_yoy_pct` | yes | per-role growth |
| `headcount.timeseries` | yes | weekly total headcount back to 2021 |
| `headcount.by_function_timeseries` | yes | monthly per-function counts |
| `headcount.by_skill_absolute` | yes | skills, e.g. Python; too coarse for ML |
| `funding` | yes | total_investment_usd, last_round_*, last_fundraise_date, acquisitions |
| `hiring` | 6 of 7 | openings_count, by_function_qoq_pct/6m_pct, open_jobs_timeseries, recent_titles_csv. **Chronosphere: all null.** |
| `news` | yes | dated articles with URLs (useful for self-audit: layoffs/freezes) |
| `/job/search` category buckets | yes | `job_details.category` is noisy ("Engineering", "Engineering ", "Engineering and Information Technology", "Others"); `total_count` is all-time unless filtered by `metadata.date_added` |

## Decision (Step 1)
- **Engineering, Sales, Marketing**: use `by_role_absolute` directly (signal 1), cross-checked against `by_function_timeseries` trend and open-role mix (signal 2).
- **ML/AI**: no role-level number exists → `classify_titles` (LLM) over job titles filtered by date, with a 30-title hand-labelled eval set. The ML/AI estimate = engineering headcount × the ML share of recent engineering hiring, labelled as an estimate.
- Job-category buckets are normalised in Python (strip, map variants) before use.

## Competitor set
Acme is fictional at ~300 people, so we compare against peers of similar scale, plus one larger reference:
- **Honeycomb** (294), **Sentry** (448), **Arize** (242, AI-infra), **Chronosphere** (139), **Grafana Labs** (1,910).
- Substitute pool: New Relic (3,095), Datadog (10,482). These are too large to be in the median by default.
- Chronosphere has no `hiring` data. That gives us a real case for the "competitor with partial data" recovery path.
