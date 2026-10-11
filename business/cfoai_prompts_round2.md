# cfo.ai round 2: prompts for Ari

Round 1 built the Base and Growth model (`cfoai_plan.md`). Ari suggested three next steps: a Downside scenario, finding a better Team price, and checking the cache assumption. Round 2 does those, using costs measured in the held-out runs.

**How to run them.** Prompts 1–3 each create their own scenario and leave Main alone, so they can run in parallel in separate Ari chats. If Ari says another chat is editing the model, run them one after another. Run prompt 4 last. After each one, export the changed pages to `business/cfoai/round2/` and screenshot the view named under "Capture".

## What was measured (source for the numbers below)

| | Value | Source |
|---|---|---|
| LLM cost per run, before the new checks | $0.023–$0.026 (3 runs) | runs 1010-19fbf2, 1010-dd2fc1, 1010-a49f44 × published prices in `compute_unit_costs.py` |
| LLM cost per run, after the new checks | $0.028–$0.040 (2 runs; the $0.040 run used one fallback to a pricier model) | runs 1010-d514dc, 1010-da4413 |
| Crustdata credits per run with no cache | observability 24.4, digital health 24.4, fintech 11.0 | state.json of the runs above |
| Crustdata USD per run with no cache | observability and digital health $7.32–$10.32; fintech $3.30–$6.30 | 5 company enrich calls × $0.60–$1.20 + job results × $9 per 1,000 (Crustdata billing page). Estimate: assumes each job result is billed as one search record |

---

## Prompt 1: Downside scenario

```
Add a new scenario called "Downside", copied from Base. Do not change Main or Growth.
Changes in Downside:
- Every customer milestone arrives 3 months later (month 6 targets reached in month 9, month 12 in month 15, month 24 in month 27; cap the model at month 24 and interpolate).
- Cache hit rate 25% instead of 50%.
- Crustdata cost per uncached run $10.32 (measured high end for observability and digital-health customers).
- LLM cost per run $0.040 (highest measured, after adding new validation checks).
Show for Downside: first cash-flow-positive month (or "not within 24 months"), lowest cash balance and month, cash at month 24, and the month cash would hit zero if it does. Compare side by side with Base and Growth.
```
**Capture:** the three-scenario cash chart or table.

## Prompt 2: Fix the Team tier

```
    In a new scenario "Team repriced" copied from Base (do not change Main), answer two questions:
    1. What Team price per month gives Team the same gross margin per customer as Starter (62.4% in Base)? Keep 40 runs and the 50% cache rate.
    2. Alternative without a price change: keep Team at $399 but cap uncached runs at 10 per month (the other 30 runs use cached competitor data and cost only the LLM inference, $0.0285 each). What is Team's gross margin then?
    Show both options' effect on month-24 revenue, gross margin and cash versus Base. Recommend one and say why in two sentences.
```
**Capture:** the unit-economics comparison for the two options.

## Prompt 3: Cost differences by industry

```
Add a scenario "Industry mix" copied from Base (do not change Main). Competitor-data cost per uncached run differs by the customer's industry; these are measured:
- Observability and digital-health customers: $10.32 per uncached run (high end).
- Fintech customers: $6.30 per uncached run (high end).
Assume 60% of customers are observability or digital health and 40% are fintech, in both tiers.
Show the blended Crustdata cost per run, gross margin per tier, and month-24 cash versus Base. Then show gross margin per tier if every customer were fintech, and if every customer were observability.
```
**Capture:** the gross-margin-by-industry table.

## Prompt 4 (run last): one-page summary for the demo

```
Write a one-page plan summary covering pricing, costs, revenue and runway across Base, Growth, Downside, Team repriced, Team uncached cap and Industry mix. Include: price per tier, cost to serve per tier, the biggest cost driver, the first cash-flow-positive month and lowest cash for each scenario, and the single decision this model supports. Keep it to what a judge can read in 30 seconds.
```
**Capture:** the summary page; it goes in the demo video at 1:45–2:20.

---

## After running them, send me

1. The exported xlsx files (put them in `business/cfoai/round2/`), or screenshots of the four "Capture" views.
2. Ari's written answers to prompts 1, 2 and 4, pasted as text.

I'll check every number against our own calculation, as in round 1, and then update `cfoai_plan.md`, the README, the demo script and Post 6.
