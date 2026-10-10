# Spend Radar business plan (built in cfo.ai)

The plan was built by Ari, cfo.ai's AI CFO, from [`cfoai_prompt.md`](cfoai_prompt.md). It covers **pricing, costs, revenue and runway** over 24 months (Nov 2026 to Oct 2028), with a Base scenario and a Growth scenario.

Shared page in cfo.ai (public): https://cfo.ai/s/lwDIEZtRrqJOM07Z — "When does Spend Radar turn cash-flow positive?" (Base Jan 2028, Growth Jun 2027).

Exports from cfo.ai, in [`cfoai/`](cfoai/):
- [`Summary.xlsx`](cfoai/Summary.xlsx): Base vs Growth, month by month
- [`Monthly P&L & Cash.xlsx`](cfoai/Monthly%20P%26L%20%26%20Cash.xlsx): customers, runs, revenue, COGS, burn, cash, runway (Base)
- [`Unit Economics.xlsx`](cfoai/Unit%20Economics.xlsx): per-customer economics and cache sensitivity
- [`Assumptions.xlsx`](cfoai/Assumptions.xlsx): every input

**Cross-check:** [`make_cfoai_sheet.py`](make_cfoai_sheet.py) rebuilds the model independently in Python. Across all 24 months of both scenarios, its customers, revenue, net burn and ending cash match the cfo.ai export to within $0.01. The first comparison turned up one difference: Python's `round()` rounds 22.5 down to 22, while cfo.ai rounds it up to 23. The script now rounds half up.

## Where the inputs come from

| Input | Value | Type |
|---|---|---|
| LLM cost per run | $0.0285 | MEASURED: mean of 5 evidence runs × the model's published paid price ([`unit_costs.md`](unit_costs.md)) |
| Crustdata cost per run, no cache | $9.24 (Base) / $6.24 (Growth) | MEASURED usage (5 company enrich calls, 360 job results) × PUBLISHED Crustdata prices ($0.60–$1.20 per enrich, $9 per 1,000 search records) |
| Share of runs served from cache | 50% | ASSUMPTION (not yet measured) |
| Hosting | $15.20/month | PUBLISHED (third-party price for one t3.small instance) |
| Pricing | Starter $99 (8 runs), Team $399 (40 runs) | PROPOSAL |
| Customers | Base 40 Starter / 10 Team by month 24; Growth 100 / 25 | ASSUMPTION (counts are net of churn) |
| Founder salary, tools, starting cash | $2,000/month, $100/month, $25,000 | SAMPLE placeholders |

## Results

| | Base | Growth |
|---|---|---|
| First cash-flow-positive month | Jan 2028 (month 15, +$248) | Jun 2027 (month 8, +$306) |
| Lowest cash balance | $7,149 (Dec 2027) | $14,615 (May 2027) |
| Revenue in month 24 | $7,950 | $19,875 |
| Gross margin in month 24 | 57.7% | 71.4% |
| Cash in month 24 | $20,739 | $115,486 |

### Unit economics per customer per month (Base, 50% of runs cached)

| Tier | Revenue | Cost to serve | Gross margin |
|---|---|---|---|
| Starter | $99 | $37.19 | 62.4% |
| Team | $399 | $185.94 | 53.5% |

Growth (cheaper Crustdata enrich): Starter 74.6%, Team 68.4%.

### Cache sensitivity (gross margin, 0% vs 50% of runs cached)

| Tier | Base, 0% | Base, 50% | Growth, 0% | Growth, 50% |
|---|---|---|---|---|
| Starter | 25.1% | 62.4% | 49.3% | 74.6% |
| Team | 7.1% | 53.5% | 37.2% | 68.4% |

### Downside (round 2)

Copied from Base, with customers arriving 3 months late, only 25% of runs served from cache, and the highest measured costs: competitor data $10.32 per uncached run and LLM $0.040 per run (from the held-out runs). Export: [`cfoai/round2/Summary-Base-Growth-Downside.xlsx`](cfoai/round2/Summary-Base-Growth-Downside.xlsx). Shared page: https://cfo.ai/s/XgDWFK7Ia8T8wGyD.

| | Downside |
|---|---|
| First cash-flow-positive month | none within 24 months (still burning $163 in Oct 2028) |
| Cash runs out | Dec 2027 (month 14): $20 at the end of Nov 2027, −$1,354 in Dec 2027 |
| Cash in month 24 | −$8,532 |
| Gross margin | 29–30% (Starter 37.1%, Team 22.0% per customer) |

Cross-check: `make_cfoai_sheet.py`'s Base scenario, shifted 3 months and recosted with these inputs, matches the cfo.ai export on ending cash and net burn in every month (difference $0.00).

## What the plan tells us

1. **Crustdata is about 99% of the cost of serving a customer.** LLM inference is $0.0285 a run. Over 24 months Crustdata costs $33.4k in Base and $55.7k in Growth; founder salary costs $48k.
2. **Caching competitor data is the business.** Without it, Team keeps 7% of its revenue in Base. The agent already caches Crustdata responses per run. The next step is to share one fetch across customers who track the same competitors, and to measure the real cache hit rate.
3. **Team is priced wrong.** It gets 5× the runs for 4× the price, so its margin is below Starter's. Options: raise its price, or cap the runs that need fresh competitor data.
4. **Base is tight.** The cash low of $7.1k is about 3 months of the $2.1k monthly burn, so customers arriving 2–3 months late would run Base out of cash. The Downside scenario confirms it: with a 3-month delay, a lower cache rate and the highest measured costs, cash runs out in Dec 2027. Starting cash, the cache rate, or the Team price has to change before this plan is safe.

## Limits

- The salary, tools and starting cash are placeholders, not real figures.
- The 50% cache rate is an assumption. It has not been measured.
- Customer counts are assumptions, deliberately modest, with no market-size claims.
- The Crustdata cost assumes each job-search result is billed as one search record.
