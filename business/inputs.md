# cfo.ai inputs: Spend Radar

Akarsh enters these into cfo.ai to build the plan, which must cover **pricing, costs, revenue and runway**. Each line is tagged **MEASURED** (from a real run, with source), **PUBLISHED** (a vendor price, with link and the date I checked it), **PROPOSAL** (a pricing choice we are making), or **ASSUMPTION** (a guess, kept modest and labelled).

## 1. Cost per analysis run

| Input | Value | Type | Source |
|---|---|---|---|
| LLM cost per run (paid-equivalent) | **$0.0285** (range $0.0270–$0.0296) | MEASURED tokens × PUBLISHED prices | `business/unit_costs.md`: 5 evidence runs on gpt-5-nano ($0.05 / $0.40 per 1M tokens), ~30 LLM calls and ~13K in / ~66K out tokens per run. An earlier Gemini Flash run cost $0.0692 (n = 1) |
| Crustdata credits per run, no cache | **20.8 credits** | MEASURED | 5 competitors × 2 credits (enrich) + 360 job results × 0.03 |
| Crustdata USD per run, no cache | **$6.24–$9.24** | MEASURED usage × PUBLISHED dashboard prices | Crustdata billing page (pay-as-you-go, screenshot 2026-10-10): Company Enrich $0.60–$1.20 per record, Search (person, company, jobs) $9.00 per 1k records. 5 enriches = $3.00–$6.00; 360 job results = $3.24. Implies ≈ $0.30–$0.60 per credit. Assumes each job result is billed as one search record |
| Hosting, one small instance | ≈ $0.0208/h → **≈ $15.2/month** at 730 h | PUBLISHED (third-party) | instances.vantage.sh/aws/ec2/t3.small, checked 2026-10-10. The page does not confirm region and OS; check the AWS console before relying on it |
| Development spend during the hackathon | **$0** to the team | MEASURED | Gemini free tier, OpenRouter `:free`, hackathon-provided OpenAI and Crustdata credits |

Why paid-equivalent: we developed on free tiers, but a paying customer's runs cannot depend on free quotas. The main model is now gpt-5-nano. If we fall back to Gemini Flash, note that its prices rise on 2027-01-01 (3.6/3.8-flash go from $0.75/$3.75 to $1.50/$7.50 per 1M tokens).

## 2. Usage assumptions

| Input | Value | Type |
|---|---|---|
| Runs per customer per month | 8 (weekly refresh × 2 scenarios, e.g. budget-cycle what-ifs) | ASSUMPTION |
| Competitors per run | 5 | MEASURED design default |
| Support/onboarding time per new customer | 2 h | ASSUMPTION |

## 3. Proposed pricing tiers (PROPOSAL)

| Tier | Price / month | Includes |
|---|---|---|
| Starter | $99 | 1 company, 5 competitors, 8 runs/month, Markdown report |
| Team | $399 | 3 entities, 10 competitors, 40 runs/month, report history, CSV export |
| Enterprise | from $1,500 | SSO, custom policy rules, private deployment (customer data stays off free LLM tiers) |

Cost per run, no cache = $0.0285 LLM + $6.24–$9.24 Crustdata = **$6.27–$9.27**. Crustdata is over 99% of variable cost.

| Tier | All runs cold: COGS / gross margin | Half the runs reuse cached competitor data: COGS / gross margin |
|---|---|---|
| Starter ($99, 8 runs) | $50–$74 / 25–49% | $25–$37 / 62–75% |
| Team ($399, 40 runs) | $251–$371 / 7–37% | $126–$186 / 53–68% |

Takeaway for the plan: margin depends on caching competitor data (it changes slowly; the agent already caches Crustdata responses) and on sharing one fetch across customers who track the same competitors. Without caching, Team at 40 runs is barely profitable.

## 4. Customer-growth scenarios (ASSUMPTION, deliberately modest)

| Month | Base: paying customers (Starter / Team) | Growth: paying customers (Starter / Team) |
|---|---|---|
| 1–3 | 0 (design partners, free) | 0 |
| 6 | 5 / 1 | 10 / 2 |
| 12 | 15 / 3 | 35 / 8 |
| 24 | 40 / 10 | 100 / 25 |

Churn: 3%/month (base), 2%/month (growth). No market-size (TAM) claims.

## 5. Fixed costs and runway (to fill)

| Input | Value | Type |
|---|---|---|
| Founder salary | ? | Akarsh |
| Starting cash | ? | Akarsh |
| Tools/SaaS | neatlogs, Crustdata plan, domain: ? | Akarsh |

The cfo.ai plan should output monthly revenue, COGS (LLM + Crustdata + hosting), gross margin, burn, and months of runway under both scenarios. Export it to `business/` when done.
