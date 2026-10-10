# Demo video script (target 2:40, hard cap 3:00)

Timing follows CLAUDE.md section 13. Captions on. Every number is copied from the cited evidence file or is a {{placeholder}} to fill from a later run. Voice-over lines are the lines in quotes; word count is at the end.

## 0:00-0:15 Hook
**On screen:** `runs/{{final_run_id}}/report.md`, "Overturned claims" section, next to the neatlogs trace of the `audit:f_ml_ai` span (trace `{{final_trace_id}}`). Scorecard table from `evidence/evals/` beside it.
**VO:** "This agent caught {{N}} of its own mistakes before reporting them." [{{N}} from the final scorecard; if N = 1 say "Here's the moment it caught itself."]

## 0:15-0:40 Problem, loop, tools
**On screen:** the Mermaid diagram from `README.md` ("How it works"). Then terminal: `uv run python -m spendradar run data/acme --evidence`.
**VO:** "Finance teams budget against their own ledger, not the market. Spend Radar reads a fictional company's budget and invoices, pulls real competitor headcount, and reports where competitors out-invest it. Plan, act, verify, recover, self-audit, report. Every number has a source."

## 0:40-1:20 neatlogs
**On screen:** neatlogs dashboard, trace `af0df27e2d3433e0c608fb28a018a22d` (run 1010-b31657): `decide:recovery` spans showing `fetch_more_signal` then `substitute_competitor` [evidence/case-studies/02-competitor-substitution.md]. Cut to the table in that file, then `evidence/evals/README.md` table.
**VO:** "Neatlogs is how I debugged it. This trace shows the recovery step replacing three of five competitors, with companies up to thirty-two times our size. [evidence/case-studies/02-competitor-substitution.md] After the fix: peers kept, two of five to five of five. Crustdata credits, twenty-six point six to five point four. Planted errors caught, five of five both times. [evidence/evals/README.md] Another trace showed model calls averaging one hundred twenty-one seconds. A timeout brought that to six point five. [evidence/case-studies/01-unbounded-llm-latency.md]"

## 1:20-1:45 Entire
**On screen:** terminal: `git log -3` showing `Entire-Checkpoint:` trailers; `evidence/entire/checkpoint-list.txt`; `evidence/entire/graph-impact-decide_recovery.txt`.
**VO:** "Entire kept the coding agent's context. Every commit links to its prompt and transcript. Before changing the recovery menu, I used the code graph to list the callers of decide recovery. [evidence/entire/README.md]"

## 1:45-2:20 cfo.ai
**On screen:** `business/unit_costs.md` table, then the cfo.ai plan with inputs from `business/inputs.md` and the plan export in `business/`.
**VO:** "Cfo dot A I builds the plan from measured costs. One evidence run: thirty model calls, ten thousand tokens in, twenty-five thousand out. Paid-equivalent cost, six point nine cents, plus twenty point eight Crustdata credits. [business/unit_costs.md] Price per run {{price_per_run}}, monthly cost {{monthly_cost}}, revenue {{monthly_revenue}}, runway {{runway_months}} months."

## 2:20-2:50 Final report
**On screen:** `evidence/sample-report/report.md` (or the final run's report): data-mode header, a finding with its numbered sources, the Overturned claims section, the recovery log.
**VO:** "The report lists its sources, its data mode, and the claims it disproved itself. Five of five planted errors caught, zero unsupported numbers. [evidence/evals/README.md] Estimates are labelled as estimates."

## 2:50-3:00 Close
**On screen:** repo URL `{{repo_url}}`, team qwep, #neatHack.
**VO:** "Spend Radar, team qwep. Repo linked. Hashtag neatHack."

---
Spoken word count: 240 (limit 400; counted excluding bracketed citations and stage notes, each placeholder as one word), about 1:35 at normal pace.
