# 04 — Held-out companies: did the agent only work on Acme?

Every recent Acme run scored 5/5 planted errors. That could mean the agent works, or that it was tuned to one company's files. To find out, `scripts/make_heldout_data.py` builds fictional companies the agent was never developed against. Each has its own industry, real competitors (Crustdata), headcount mix, vendors and error placements. They include error types Acme does not have: a re-sent duplicate invoice, a zero-byte PDF, and a mis-categorised invoice from a vendor that appears only once. Each also has a **negative control**, a 0.4% rounding difference inside the 1% tolerance that must *not* be flagged. A flag on it counts as a false alarm, which the eval now measures.

Ground truth for each company is in `evals/ground_truth_<key>.json`, which the agent never reads. All runs below are evidence runs (LLM cache off), on gpt-5-nano.

## Round 1: three companies, before any change

| Company | Industry | Run · trace | Caught | Missed | False alarms |
|---|---|---|---|---|---|
| Kestrel Metrics | observability | 1010-f3a894 · `d148c048822af4954479e25dd567a2ea` | 5/6 | duplicate invoice | 0 |
| Ledgerly Payments | fintech | 1010-dd2fc1 · `8a5762c951ba6e8ea6d1108368753167` | 4/5 | duplicate invoice | 0 |
| Carebridge Health | digital health | 1010-a49f44 · `8985b2010ca297275006a2ffdf241b02` | 4/5 | mis-categorised invoice, one-off vendor | 0 |

Scorecards: `evidence/evals/20261010T2303*-771deef-baseline-*.json`.

## What the misses showed (bugs found)

1. **No duplicate-invoice check.** A re-sent invoice was simply counted twice.
2. **Mis-categorisation was only caught when a vendor appeared under two categories** (`verify:vendor_category`). A vendor billed once, to the wrong cost centre, passed.
3. **The audit prompt had an Acme-specific hint**: "GPU training/inference hours are ML/AI work". It was added in `bb61e37` (case study 03) to help fallback models confirm Acme's planted error. It is tuning to the test.
4. **The planner's text leaked into the report.** In Ledgerly's report, competitors were named "fetch Ramp data", "fetch Brex data" (`runs/1010-dd2fc1/report.md`), because the code trusted the planner's `name` field. On Acme the model happened to write the name correctly.
5. **The company name was hard-coded** as "Acme" in the report and findings, and the report write crashed on Windows (cp1252 encoding). Both were found while setting up the held-out runs.

## Fixes (commit `21de57c`)

- `verify:duplicate_invoices`: same vendor + same invoice number, or same vendor + date + amount → flagged, counted once (unit tests added).
- `verify:line_items_vs_cost_centre`: one LLM call classifies each invoice's line items; Python flags a mismatch with its cost centre, and the self-audit then confirms or overturns the flag.
- The audit prompt now says "the kind of work decides the category, not which cost centre paid", with no example from any test company.
- Competitor names come from `competitors.yaml` by domain, never from the planner.
- Company name read from the budget sheet; all file I/O UTF-8; runs record `<sha>-dirty` when the code has uncommitted changes.

## After the fixes

| Company | Run · trace | Before | After | False alarms | Fallback hops |
|---|---|---|---|---|---|
| Kestrel Metrics | 1010-d514dc · `d9f640f09022a87f323639df6203aa09` | 5/6 | **6/6** | 0 | 0 |
| Ledgerly Payments | 1010-d94102 · `19d1939a2077ba4f7e55850c4e881932` | 4/5 | **5/5** | 0 | 0 |
| Carebridge Health | 1010-da4413 · `21f52eb2627e8d4da8d67840dd9c3bc3` | 4/5 | **5/5** | 0 | 1 |
| Acme (regression, no GPU hint) | 1010-c2cd0c · `8ee89e38980b54f4e6d633b19dea9af8` | 5/5 | **5/5** | 0 | 0 |

## Round 2: companies created after the fixes

These were built after the fixes above and never used to change the agent, so they are the fairest test.

| Company | Industry | Run · trace | Caught | False alarms | Notes |
|---|---|---|---|---|---|
| Bastion Security | cybersecurity | 1010-bad760 · `3be608d7b07d7dd1add861facacf3742` | **6/6** | 0 | Abnormal Security had no usable Crustdata data; the agent substituted Drata (first natural, correct substitution) |
| Parcelwise Commerce | e-commerce logistics | 1010-b8ac1c · `58491885cae433ddcd02d0716b27dc1a` | **5/5** | 0 | caught a duplicate of a *scanned* invoice and an ML API billed to Sales (one-off vendor) |
| Peoplegraph HR | HR tech | 1010-87092f · `49f936076a84fb08702674bac263c074` | **5/5** | 0 | all 5 real peers had data; 0 fallback hops |

All three: 0 unsupported numbers, 0 fallback hops. Crustdata credits for a first (uncached) run: 31.8, 28.0 and 28.0.

## Caveats

- **n = 1 per side**, not the n = 3 our rule asks for; this is indicative.
- Carebridge's after-run used one fallback hop, so by our rule it is not a clean comparison.
- The baseline scorecards say commit `771deef`, but those runs also had the uncommitted UTF-8 and company-name changes (the `-dirty` marker did not exist yet). Neither change affects what the eval scores.
- Removing the GPU hint was re-checked on gpt-5-nano only. Case study 03 showed fallback models were weaker auditors on exactly this finding, so a fallback-heavy run may still miss it.
- The two Acme runs on the Windows laptop read invoice PDFs whose line endings Git had rewritten on checkout (fixed in `d172a62` with `.gitattributes`). Both still scored 5/5.
- The line-item check adds model calls: LLM cost per run went from $0.023–$0.026 to $0.028–$0.040 (paid-equivalent, n = 2).
