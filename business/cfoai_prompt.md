# Prompt for Ari (cfo.ai)

Paste the block below into a new chat with Ari at app.cfo.ai. Values come from `inputs.md`, `unit_costs.md` and the Crustdata billing page. Founder salary, tools and starting cash are SAMPLE placeholders; change them if you have real figures, and change them in `make_cfoai_sheet.py` too. You can also upload `cfoai/spend_radar_inputs.xlsx` alongside the prompt. Its Monthly sheet is our own calculation, useful for checking Ari's output.

```
Build a 24-month financial model for "Spend Radar", a B2B SaaS AI agent that compares a finance team's people spend with competitors' estimated spend. Pre-revenue, solo founder, starts month 1 = Nov 2026. Use a Base scenario and a separate Growth scenario (do not change Main for Growth).

PRICING (proposal, monthly subscriptions)
- Starter: $99/month, includes 8 analysis runs/month
- Team: $399/month, includes 40 runs/month
- Ignore Enterprise for now.

VARIABLE COST PER ANALYSIS RUN (COGS)
- LLM inference: $0.0285 per run (measured: mean of 5 real runs, at the model's published paid price)
- Competitor data (Crustdata), per run that is not cached:
    Base:   $9.24 per run (5 company enrich calls x $1.20 + 360 job-search results x $9.00 per 1,000)
    Growth: $6.24 per run (5 company enrich calls x $0.60 + 360 job-search results x $9.00 per 1,000)
  Crustdata is pay-as-you-go: Company Enrich $0.60-$1.20 per record, Search $9.00 per 1,000 records.
- Caching: 50% of each customer's runs reuse cached competitor data and cost only the LLM inference (assumption).
  So the blended cost per run is: Base $4.6485, Growth $3.1485.
- Runs per customer per month: Starter 8, Team 40 (assumption: customers use their full allowance).
- Hosting: $15.20/month (one small AWS instance), counted in COGS.

OPERATING EXPENSES PER MONTH
- Founder salary: $2,000 (sample)
- Tools/SaaS (neatlogs, domain, misc): $100 (sample)
- Onboarding: 2 hours of founder time per new customer (no cash cost)

CUSTOMERS (paying, end of month, already net of churn; interpolate linearly between points and round)
Base:   months 1-3: 0 Starter / 0 Team; month 6: 5 / 1; month 12: 15 / 3; month 24: 40 / 10.
Growth: months 1-3: 0 / 0;             month 6: 10 / 2; month 12: 35 / 8; month 24: 100 / 25.
(These counts assume churn of 3%/month in Base and 2%/month in Growth; do not subtract churn again.)

STARTING CASH: $25,000 (sample)

OUTPUT
1. For both scenarios, monthly: customers by tier, runs, revenue, COGS (LLM + Crustdata + hosting), gross profit, gross margin, operating expenses, net burn, ending cash, and months of runway.
2. Unit economics per tier: revenue, COGS and gross margin per customer.
3. Sensitivity: gross margin per tier when 0% vs 50% of runs are cached.
4. A short summary: the month each scenario becomes cash-flow positive, the lowest cash balance, and the biggest cost driver.
```

## Expected results (our own calculation, `make_cfoai_sheet.py`)

If Ari's numbers are far from these, check which assumption it read differently.

| Scenario | Month | Customers (Starter / Team) | Revenue | COGS | Gross margin | Net burn | Ending cash |
|---|---|---|---|---|---|---|---|
| Base | 6 | 5 / 1 | $894 | $387 | 57% | $1,593 | $13,353 |
| Base | 12 | 15 / 3 | $2,682 | $1,131 | 58% | $549 | $7,449 |
| Base | 24 | 40 / 10 | $7,950 | $3,362 | 58% | −$2,488 (profit) | $20,739 |
| Growth | 6 | 10 / 2 | $1,788 | $519 | 71% | $831 | $14,877 |
| Growth | 12 | 35 / 8 | $6,657 | $1,904 | 71% | −$2,653 (profit) | $22,121 |
| Growth | 24 | 100 / 25 | $19,875 | $5,683 | 71% | −$12,093 (profit) | $115,486 |

(Updated after comparing with the cfo.ai export: customer counts round half up. The cfo.ai model and `make_cfoai_sheet.py` now agree on every month to within $0.01.)

After Ari builds it, take screenshots of the model, the Unit economics view and the Runway view, save them to `business/cfoai/`, and copy the headline results into `business/cfoai_plan.md`.
