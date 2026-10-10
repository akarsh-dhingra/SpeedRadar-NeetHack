# cfo.ai: what Akarsh does (≈ 45 min)

The plan must cover **pricing, costs, revenue and runway**, built from the measured unit costs. Every driver, with its type (MEASURED / PUBLISHED / PROPOSAL / ASSUMPTION) and source, is in [`cfo-ai-drivers.csv`](cfo-ai-drivers.csv); the reasoning behind each is in [`inputs.md`](inputs.md).

The coding agent could not open cfo.ai (blocked by the cloud environment's network policy), so the UI steps below are written generically. Follow whatever cfo.ai actually offers (upload, chat or manual entry).

## 0. Fill the three blanks first (5 min)
In `cfo-ai-drivers.csv`, fill:
- `crustdata_usd_per_credit`: from https://app.crustdata.com/billing/credits (Crustdata does not publish it). If the dashboard shows no price, write a labelled ASSUMPTION and say so in the plan.
- `founder_salary` and `starting_cash`: your own numbers (they can be modest, e.g. part-time founder pay). They are ASSUMPTIONS and the plan must say so.
- `tools_saas_per_month`: the neatlogs, Crustdata and domain plans you would pay for after the hackathon.

## 1. Build the model (25 min)
1. New company/model in cfo.ai: "Spend Radar (neatHack, team qwep)".
2. Load the drivers: upload `cfo-ai-drivers.csv` if cfo.ai accepts files, otherwise paste it into the chat or enter each row by hand. Keep the type labels (MEASURED / ASSUMPTION…) in the notes.
3. **Revenue:** Starter $99 and Team $399 per month, customer counts per month from the base and growth scenarios (0 paying customers in months 1–3), churn 3% (base) and 2% (growth). Leave Enterprise out of the scenarios.
4. **COGS per customer per month:** runs × ($0.0285 LLM + 20.8 credits × $/credit) + a share of hosting ($15.2/month).
5. **Opex:** founder salary, tools/SaaS, support time (2 h per new customer).
6. **Outputs to ask for, per scenario, 24 months:** monthly revenue, COGS, gross margin %, burn, cash balance and **months of runway**; break-even month if any.

## 2. Sanity checks before exporting (5 min)
- The LLM cost per run in the model is $0.0285 and Crustdata credits are 20.8 per run, matching `unit_costs.md`.
- Gross margin is driven mostly by the Crustdata credit price; if margin looks odd, check that number first.
- No market-size (TAM) claims, no numbers that are not in the drivers file.

## 3. Export and hand back (10 min)
Save into `business/` (or send them to Claude to commit):
- `cfo-ai-plan.pdf` (or `.xlsx`), the full export, and the share link if cfo.ai gives one.
- 2–3 screenshots: the driver/assumption view, the P&L/revenue chart, and the runway view. These go in the demo at 1:45–2:20.
- **Cancel the cfo.ai subscription** in Settings → Billing if it is not already cancelled (hard rule 9).

Claude then adds the export and links to the README cfo.ai section, `hackathon.md`, the demo script, and post 6 (unit economics), using only numbers from the export.
