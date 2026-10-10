# cfo.ai inputs: Spend Radar

Akarsh enters these into cfo.ai to build the plan, which must cover **pricing, costs, revenue and runway**. Each line is tagged **MEASURED** (from a real run, with source), **PUBLISHED** (a vendor price, with link and the date I checked it), **PROPOSAL** (a pricing choice we are making), or **ASSUMPTION** (a guess, kept modest and labelled).

## 1. Cost per analysis run

| Input | Value | Type | Source |
|---|---|---|---|
| LLM cost per run (paid-equivalent) | **$0.0692** | MEASURED tokens × PUBLISHED prices | `business/unit_costs.md`. Run `1010-7bf26d`, 30 LLM calls, 10,260 in / 25,126 out tokens. n = 1 for now; target n = 5 |
| Crustdata credits per run, no cache | **20.8 credits** | MEASURED | 5 competitors × 2 credits (enrich) + 360 job results × 0.03 |
| Crustdata USD per credit | **? (to fill)** | PUBLISHED, not public | Crustdata sells credits in the dashboard: https://app.crustdata.com/billing/credits |
| Hosting, one small instance | ≈ $0.0208/h → **≈ $15.2/month** at 730 h | PUBLISHED (third-party) | instances.vantage.sh/aws/ec2/t3.small, checked 2026-10-10. The page does not confirm region and OS; check the AWS console before relying on it |
| Development spend during the hackathon | **$0** | MEASURED | Free tiers only (Gemini free tier, OpenRouter `:free`, Crustdata hackathon credits) |

Why paid-equivalent: we developed on free tiers, but a paying customer's runs cannot depend on free quotas. Gemini Flash prices rise on 2027-01-01 (3.6/3.8-flash go from $0.75/$3.75 to $1.50/$7.50 per 1M tokens). Model a price increase from Q1 2027.

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

Per-run variable cost for Starter = 8 × ($0.0692 + 20.8 × Crustdata $/credit). Gross margin depends mainly on the Crustdata credit price, so fill that in first.

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
