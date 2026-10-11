# Hand-off for Akarsh (11 Oct 2026, night session)

Everything below is pushed to GitHub. This page says where each piece is and what only you can do.

## Get it

```bash
git fetch origin
git checkout main && git pull          # the site deploys from main
git fetch origin 'refs/entire/*:refs/entire/*'   # Entire checkpoint refs (pushed by Entire's pre-push hook; 87 were on origin before tonight's push)
```

`runs/` and `cache/` are git-ignored, so raw run folders stay on the machine that made them. Everything the site and the case studies need is committed: scorecards (`evidence/evals/`, `evidence/real-invoices/`), and every run's findings, step log and recovery decisions inside `evidence/frontend_data.json`. `python -m spendradar export` now keeps those details from the previous export when a run folder is missing, so re-exporting on your machine will not drop them.

## What changed tonight

| Part | What | Where |
|---|---|---|
| Agent | Invoice check accepts line items that match the printed net amount (Python arithmetic); prompt `read_pdf_llm` v3 | `spendradar/verify.py`, `spendradar/prompts.py`, case study 07 |
| Agent | Job-title classifier survives a schema-echoed reply (lost a competitor's ML/AI estimate in 2 of 10 runs) | `spendradar/tools/classify.py`, `tests/test_tools.py` |
| Agent | Gross-vs-net prompt fix found on real invoices | case study 06 |
| Evidence | 36 real public invoices (FCC, amazon/ConfBench, CC BY-NC 4.0, evaluation use) in 3 sets; 25 scored passes (one scorecard each) | `evals/real_invoices*.json`, `evals/real_invoices.py`, `evidence/real-invoices/` |
| Evidence | Case study 02 re-run at n = 5 per side (fix reverted on `ablation/cs02-fix-reverted`) | `evidence/case-studies/02-competitor-substitution.md` |
| Site | "How it works" walkthrough, plain-English boxes, glossary, Real invoices page, Latest results; follows the Audit Console design system | `site/` (live after merge to main) |
| cfo.ai | New inputs + "Invoice review cost" in COGS (0 in Main, so Main's numbers did not change); new scenario **Managed review** using the measured 17.59% flag rate | cfo.ai workspace (change-log 282657–282732), `business/cfoai/managed_review_2026-10-11.json` |
| neatlogs | Every run and invoice pass above is traced; trace ids are in each scorecard and in `evidence/traces.md` | neatlogs project used by `NEATLOGS_API_KEY` |

Branches that hold deliberately broken "before" code, for checking the case studies (never merge them): `ablation/cs02-fix-reverted` (`d311fb5`), `ablation/prompt-v1` (`5ed7b0e`), `ablation/invoice-v2` (= `7c59831`).

## Only you can do these

1. **Entire trails.** `entire login`, then create a trail for tonight's branch so the 6 runners review it:
   `entire trail create --title "Real invoices, case studies 06-07, plain-English site" --branch feat/story-page` (or on main after the merge), then `entire trail show` / `entire trail finding list`. Copy the result into `TRAILS` in `spendradar/export.py` and run `python -m spendradar export`.
2. **neatlogs.** Open the neatlogs dashboard and check that the new traces are there (e.g. case study 02 rerun `139c076ca99acaf06901377eeadee8c1`, real invoices `36f7827e6ac6c02ca5c95f2188f45da8`). If public trace links exist for your plan, add them to `evidence/traces.md`.
3. **cfo.ai.** Open the Assumptions page: the "Invoice review" text block explains the four new inputs. Check the *Managed review* scenario against Main on the Monthly P&L page. Three of the inputs are labelled assumptions (13 invoices per customer per month, 5 minutes, $40/hour); change them if you have better numbers.
4. **Demo video** (README still has `{demo link}`): suggested new beat, "we tested on 36 real invoices; it found its own bug; we fixed it and checked on invoices it never saw".
5. **Posts:** draft "Post R" in `evidence/build-in-public.md`; posts 4–6 and E are still unposted.
6. **Submission:** Mon 12 Oct, 19:00–23:55 IST, quote-post with team qwep, project, repo link, demo link.
