# hackathon.md — Spend Radar (neatHack 2026)

## Project
Spend Radar: an agent that tells a finance team where competitors are outspending them on people, with a source behind every number, and tries to disprove its own findings before reporting them.

## Team
qwep — Akarsh Dhingra (solo)

## Stack
Python 3.12, plain agent loop, Pydantic · neatlogs (tracing) · Entire (checkpoints + entire-graph) · cfo.ai (business plan) · Crustdata (competitor data) · Gemini free tier + OpenRouter `:free` models (LLM)

## Build log

### 2026-10-10 (Sat)
- **13:23 IST — Step 1 started.** Planned: new public repo, `.gitignore`, `.env.example`, Entire re-enabled, Crustdata probe for 7 candidate competitors.
  - Done: repo initialised, Entire enabled for Claude Code (`entire enable --agent claude-code`), first commit.
  - Tests run: none yet (no code).
- **13:35 IST — Step 1 done.** Crustdata probe: 28 credits (14 wasted on a duplicate enrich; fixed). All 7 candidates have role-level headcount, timeseries, funding, news; Chronosphere lacks hiring data; no ML/AI role exists, so ML/AI uses title classification. Competitors: Honeycomb, Sentry, Arize, Chronosphere, Grafana Labs (see `spikes/FINDINGS.md`).
  - Tests run: probe script against live API (7 enrich, 7 job aggregations).
- **13:41 IST — Step 2 done.** neatlogs tracing with a client-side secret mask (doctor --probe PASS); gitleaks + .env-value pre-commit scan (verified it blocks a fake key and a real .env value); `llm.py` with `:free` guard, quota ledger, rate limiter, cache, Gemini→Gemini→OpenRouter fallback, JSON re-ask, native function calling. Finding: Gemini Pro has zero free-tier quota → Flash plans.
  - Tests run: `pytest` 7 passed (mask, guard, ledger-not-polluted-by-injection); live probes `spikes/neatlogs_probe.py`, `spikes/llm_probe.py`.
  - Bug found and fixed: injected 429s were marking real models exhausted in the ledger.
  - Case-study plan: deferred until the first full run measures LLM calls per run (needed with the RPD limits to size n=3 comparisons).
- **13:43 IST — Step 3 done.** `scripts/make_acme_data.py` (seeded) generates the fictional Acme folder: budget xlsx (People + NonPeople), 13 invoices from invented vendors, policy.yaml (people-cost share-of-headcount rules + internal infra check), salary_table.csv (labelled ASSUMPTION), and `evals/ground_truth.json` with 5 planted errors (budget total mismatch, invoice total mismatch, mis-categorised invoice, scanned PDF, corrupt PDF). Contracts are cut, as agreed.
  - Tests run: pdfplumber over all invoices (11 text, 1 empty text layer, 1 PdfminerException); scanned page checked visually.
- **13:47 IST — Step 4 done.** Tools: `list_files`, `read_spreadsheet` (keeps row numbers), `read_pdf` text (pdfplumber + deterministic parse) and llm (Gemini reads PDF bytes), `crustdata_company` / `crustdata_jobs` (cache, backoff, stale-cache fallback, per-run credit cap, fault injection), `classify_titles` (Flash-Lite, schema-validated), and deterministic `analysis.py` (signals, ranges, agreement, policy compare, gap in heads/USD). Added an "other" staff row to the Acme budget so share-of-headcount is comparable with competitors' company totals.
  - Tests run: pytest 14 passed; live LLM PDF read of the scanned invoice (total 91,287, matching what is printed).
  - Bug found and fixed: Gemini 400 on the corrupt PDF crashed the process; non-retryable provider errors now become `LLMError` → `ToolError`.
- **14:05 IST — Step 5 (loop) in progress.** Agent loop with LLM plan + coverage check, per-task verification, LLM `decide:recovery` via native function calling, retry cap 3, atomic state save per step, `resume`, simulated crash flag, self-audit (recompute, sources, contradiction evidence, LLM verdict, OpenRouter second opinion), sourced Markdown report.
  - Run 1010-6f37e8 (trace 6f2d2dd7…): planner/recovery calls averaged 143 s → killed; root cause no client timeout on Gemini → 40 s timeout + fall through to next model (commit 11a5108).
  - Run 1010-b31657: found cached calls inflating usage totals (fixed 8747783); observed LLM choosing `substitute_competitor` for a single weak ML/AI estimate (under review).
  - Tests run: pytest 19 passed.
- **14:05 IST — Step 9 harness written** (`python -m spendradar eval`), scoring planted errors, cost error, unsupported numbers, overturns, LLM usage, provider mix.
- **14:09 IST — Run 1010-b31657 finished** (trace af0df27e…, commit 11a5108): 5/5 planted errors caught, 0 unsupported numbers in the report, ML/AI finding overturned by the self-audit (Gemini overturn, OpenRouter second opinion: downgrade). Bug: 3 of 5 chosen peers were substituted away (Honeycomb, Arize, Chronosphere → New Relic, Datadog) because one weak ML/AI category triggered `substitute_competitor`. Fixed in 13effec. This run's LLM latency/tokens predate the cached-call accounting fix, so they are inflated.
- **Case-study plan (from real quota):** gemini-3.8-flash hit its free-tier daily limit after 15 requests (429 PerDay). One run uses ~15 reasoning calls, so ~2–3 runs fit per day across the 3.8/3.6/2.5-flash chain. Plan: today, 1 evidence run after each fix; after the quota reset (~12:30 IST Sun) add runs toward n=3 per side for case study 02 (competitor substitution). Case study 01 (latency) stays n=1 before (killed partial run), stated as such.
- **14:22 IST — Steps 8, 10, 12, 13 (first pass).** Evidence run 1010-7bf26d after fixes: 5/5 planted errors, 5/5 peers kept, 5.4 credits (vs 26.6). Case studies 01 (latency 120.9 s → 6.5 s per reasoning call, n=1, different model mix, stated) and 02 (substitution 3 → 0). Resume after simulated crash: 1010-bdda52. Injected Crustdata 429 recovered: 1010-a32118. Recovery table in `evidence/recovery/`. Paid-equivalent cost $0.0692 LLM + 20.8 Crustdata credits per cold run (n=1). `business/inputs.md` ready for cfo.ai (Crustdata $/credit to fill).
  - Quota: gemini-3.8-flash exhausted at 15 req/day, 3.6-flash at 11; 2.5-flash left for reasoning today.
  - Noted for later: an audit verdict gave a muddled reason (competitor signal vs Acme's own share). Candidate case study 03.
  - Tests run: pytest 20 passed.
- **14:27 IST — Fixture eval + audit fix.** Fixture run 1010-9e86fc: Sentry marketing ×5 caught (6/6), marketing finding downgraded. Found and fixed: the second opinion reused the primary verdict's model once Gemini quota ran out (now excludes it); single-option recoveries skip the LLM. HTML report + sample reports committed. README draft done.
  - All Gemini reasoning models exhausted for the day (3.8-flash 15, 3.6-flash 11, 2.5-flash 18 requests). Next evidence runs after the ~12:30 IST reset.
  - Tests run: pytest 22 passed.
- **18:1x IST — Secret handling incident (caught before any push).** A new provider key was pasted into the coding-agent chat. Entire's checkpoint transcript stored it unredacted: a 32-hex key scores 4.0 bits of entropy, below Entire's 4.5 threshold, and no built-in pattern matched it. Caught by searching all git objects before pushing. Deleted the local checkpoint ref, added a personal Entire redactor pack (git-ignored), and extended the neatlogs mask and gitleaks rules. Nothing was pushed with the key.

## Demo
_TBD_

## Limitations
See README "Limitations (honest)". In short: competitor people cost is an estimate (Crustdata headcount × our loaded cost); people cost only; all company finance data is fictional; ML/AI is the weakest estimate; development ran on free LLM tiers plus hackathon OpenAI credits, with only fictional and public data sent; business costs are paid-equivalent estimates; several before/after comparisons are n = 1 per side.

## Submission
_TBD_

### 2026-10-10 20:22 IST — corrupt PDF no longer reaches the LLM (neatlogs auto-triage fix 2cd5e9df)
- Planned: act on the neatlogs triage "Handle corrupt PDF files in read_pdf" (8 linked traces, e.g. 36362eb966cdbb85dcb2fb1b280e1034, the Gemini 400 INVALID_ARGUMENT on invoice 13).
- Already done earlier (6edff38): the 400 is wrapped as a ToolError and a task error never kills the run.
- Done now: `read_pdf(mode="llm")` checks the PDF opens with pdfplumber first; a file with no /Root fails fast as "corrupt PDF, not sent to the LLM reader". Scanned PDFs still go to the LLM.
- Tests run: pytest 55 passed (2 new: corrupt PDF makes no LLM call; scanned PDF still does). Run 1010-4f8453 (trace a8d7a3e9cef5f60e6fc5ee9e22ba70ad, LLM cache on, not an evidence run): invoice 13 → reparse_alt fails without an LLM call → skip, listed under Not analysed; 5/5 planted errors, 0 unsupported numbers.
- 2026-10-10 20:55 IST follow-up: connected the Neatlogs MCP server (local scope, key not in repo) and read the triage and the original trace 36362eb966cdbb85dcb2fb1b280e1034 (invoice 13: read_pdf text-mode ERROR, then the LLM fallback). Evidence run 1010-7309e6 (LLM cache off, trace 953bb991e2547b1591bb2bb6adb555b8): invoice 13 skipped with 0 LLM calls, 5/5 planted, 0 unsupported numbers, 0 fallback hops. Neatlogs ingestion was stalled server-side at the time (`neatlogs doctor --probe`: TRACE_READBACK_TIMEOUT, "processing at raw_durable"), so the new traces showed 0 spans.

### 2026-10-10 22:15 IST — cfo.ai business plan built and cross-checked (Step 15)
- Planned: turn `business/inputs.md` into a cfo.ai plan covering pricing, costs, revenue and runway.
- Done: priced Crustdata in USD from the billing page (Company Enrich $0.60–$1.20/record, Search $9/1k records): $6.24–$9.24 per uncached run, ~99% of the cost per run (LLM $0.0285). Wrote the prompt for Ari (`business/cfoai_prompt.md`). Ari built Base and Growth scenarios; exports are in `business/cfoai/`, summary in `business/cfoai_plan.md`. Base: cash-flow positive in month 15, cash low $7,149, 57.7% gross margin. Growth: positive in month 8, 71.4%. With no caching, Team's Base margin is 7.1%. Founder salary, tools and starting cash are labelled placeholders.
- Tests run: `business/make_cfoai_sheet.py` rebuilds the model independently. The first comparison differed on half-customer months (Python's `round()` rounds half to even, cfo.ai rounds half up); after the fix, customers, revenue, burn and cash match the export on all 24 months of both scenarios to within $0.01.

### 2026-10-10 22:53 IST (commit 21de57c; earlier draft wrongly said 23:05) — held-out eval across industries; fixes for what it exposed (in progress)
- Planned: test whether the agent generalises beyond Acme, the one company it was built against (every recent Acme run scored 5/5).
- Done:
  - Fixed: all file I/O now UTF-8. On Windows the report write crashed on "→" (6 tests failed on this machine).
  - Fixed: company name was hard-coded as "Acme" in the report and findings; now read from the budget sheet title.
  - `scripts/make_heldout_data.py` builds 3 held-out fictional companies with their own industry, real competitors, headcount mix, vendors and error placements: Kestrel Metrics (observability, Acme's peers), Ledgerly Payments (fintech: Ramp, Brex, Mercury, Airwallex, Spendesk), Carebridge Health (digital health: Spring Health, Headway, Sword Health, Cityblock, Komodo). New error types: duplicate (re-sent) invoice, zero-byte PDF, mis-categorised invoice from a vendor that appears once, and a negative control (0.4% rounding difference inside the 1% tolerance, must NOT be flagged). Ground truth in `evals/ground_truth_<key>.json`; the eval picks it from the input folder and now also counts false alarms.
  - Baseline (code before the fixes below), evidence runs: Acme 1010-19fbf2 5/5, 0 false alarms, 24.4 credits cold (trace 4d36eebb1dcdeec569f7436aa8d40743). Kestrel 1010-f3a894 5/6, missed the duplicate, 0 false alarms (trace d148c048822af4954479e25dd567a2ea). Ledgerly 1010-dd2fc1 4/5, missed the duplicate, 0 false alarms, 11.0 credits (trace 8a5762c951ba6e8ea6d1108368753167). Carebridge baseline: run 1010-a49f44 (result pending). Run 1010-bcb5c4 was a duplicate Ledgerly run started by mistake and aborted; not scored.
  - Bugs found by the held-out runs and fixed: (1) no duplicate-invoice check → `verify:duplicate_invoices` (same vendor + number, or vendor + date + amount; the duplicate is counted once); (2) mis-categorisation only caught when a vendor appears under two categories → one LLM call `verify:line_items_vs_cost_centre` classifies each invoice's line items, Python flags mismatches for the audit; (3) the audit prompt had an Acme-specific hint ("GPU hours are ML/AI work") → replaced with a general rule; (4) planner wrote "fetch Ramp data" into the competitor name and it reached the report → names now come from competitors.yaml by domain; (5) runs recorded the HEAD sha even with uncommitted changes → `-dirty` suffix.
  - After-fix evals queued for carebridge, kestrel, ledgerly and acme (Acme = regression check without the GPU hint); scorecards land in `evidence/evals/`.
- Tests run: pytest 57 passed (2 new: duplicate detection; different vendors sharing an invoice number are not duplicates).
- Setup on this laptop: Entire CLI 0.11.4 enabled (hooks only load when VS Code opens the repo folder itself, not its parent); secret-scan pre-commit hook installed and verified to block a fake .env value.

### 2026-10-10 22:49 IST — Entire session check before committing
- Planned: confirm Entire tracks this Claude Code session, then commit the pending work with `Entire-Checkpoint` trailers.
- Done: `entire session list` and `entire status --detailed` show this session active. The step 15 commit (eb9dfb5) got no trailer: the edits it contains came from a session Entire was not tracking, so there was no session context to link.
- Tests run: pytest 57 passed (`.venv`).
- 2026-10-10 23:14 IST follow-up — after-fix results (one evidence run each, LLM cache off):
  - Kestrel 1010-d514dc: 5/6 → **6/6** (duplicate now caught), 0 false alarms, 0 fallback (trace d9f640f09022a87f323639df6203aa09).
  - Ledgerly 1010-d94102: 4/5 → **5/5** (duplicate caught), 0 false alarms, 0 fallback (trace 19d1939a2077ba4f7e55850c4e881932). Competitor names now "Ramp", "Brex", … instead of "fetch Ramp data".
  - Carebridge 1010-da4413: 4/5 → **5/5** (one-off-vendor mis-categorisation caught by the line-item check, audit confirmed corrected category ml_ai), 0 false alarms; 1 fallback hop, so not a clean comparison by our rule (trace 21f52eb2627e8d4da8d67840dd9c3bc3).
  - Acme 1010-c2cd0c (regression check without the Acme-specific audit hint): **5/5**, 0 false alarms, 0 fallback (trace 8ee89e38980b54f4e6d633b19dea9af8).
  - Caveats: n = 1 per side; baseline scorecards say commit 771deef but ran with uncommitted UTF-8 and company-name changes (no effect on what is scored; the `-dirty` marker did not exist yet). The new line-item check adds model calls: LLM cost per run went from $0.023–$0.026 to $0.028–$0.040 (n = 2).
  - Added three more held-out companies, built after the fixes and never used to tune them: Bastion Security (cybersecurity), Parcelwise Commerce (e-commerce logistics), Peoplegraph HR (HR tech). Runs in progress.
  - `python -m spendradar export` writes `evidence/frontend_data.json` for a front end; format in `docs/frontend-data.md`. cfo.ai round-2 prompts in `business/cfoai_prompts_round2.md`; shared cfo.ai page: https://cfo.ai/s/lwDIEZtRrqJOM07Z.

### 2026-10-11 10:49 IST — Entire gap fixed going forward; held-out batch results committed
- Planned: find why recent commits had no `Entire-Checkpoint` trailer and fix it without rewriting pushed history.
- Done:
  - Cause: Claude session `d332d8e0` was opened on the parent folder `neathack/`, so the repo's `.claude/settings.json` (Entire's hooks) never loaded; 14 commits `e867e62`..`983b080` have no trailer. Its transcript had been attached as checkpoint `01M4KERS89ZG64HPC8G9CP34VG` but `entire checkpoint explain` showed it linked to no commit. Commit `871b757` now carries that trailer. Both transcripts were scanned for `.env` values and key formats before pushing (0 hits).
  - That session finished its runs and handed off; all commits now come from the session opened on the repo folder. Committed its results: Bastion re-runs after the Windows coverage fix 1011-f679dc, 1011-257f61 (6/6, 6/6); fault-injection re-runs with fired-fault recording fixed 1011-3cd178 (Ledgerly 5/5) and 1011-4d998b (Bastion 6/6); case study 04 update; regenerated `evidence/frontend_data.json`.
  - Open, not fixed: (1) Acme mis-categorised invoice overturned by the gpt-5-nano audit in 1011-4f1f02 after the Acme-specific hint was removed; (2) `evals.run_eval` scores runs whose phase is not `done` and drops their stderr (1011-d2d05c stopped at step 26); (3) `fallback_hops` reads 0 in injected runs despite a gemini-3.1-flash-lite fallback call.
- Tests run: pytest 63 passed after merging `eccd33f`.

### 2026-10-11 11:25 IST — three open bugs fixed (`de18e4f`); Acme n = 3 after the audit fix
- Planned: fix the three open items from the 10:49 entry.
- Done: audit now sees the line-item check result (Acme mis-categorised invoice: before 1 of 2 complete runs, after **3 of 3**, each 5/5, 0 false alarms, 0 fallback hops; scorecard `evidence/evals/20261011T112120-de18e4f-dirty-after-audit-linecheck.json`); eval keeps unfinished runs out of averages and saves their stderr; fallback hops counted for tool LLM calls, and PDFs routed to Gemini up front. Details and traces in case study 04. Front-end data regenerated.
- Tests run: pytest 68 passed (5 new).

### 2026-10-11 12:05 IST — evidence site and demo script
- Done: static evidence site in `site/` (`63c0490`) on the Audit Console design system, reading the export; export now orders runs by start time and carries task logs, recovery menus and a counts-only summary. Demo script rewritten around the site with every number cited (`evidence/demo-script.md`, 368 spoken words). Post 5 placeholder filled from the export summary.
- Tests run: pytest 68 passed; `node --check` on site scripts; headless Edge screenshots of the overview and run pages.
