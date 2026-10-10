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
_TBD_

## Submission
_TBD_

### 2026-10-10 20:22 IST — corrupt PDF no longer reaches the LLM (neatlogs auto-triage fix 2cd5e9df)
- Planned: act on the neatlogs triage "Handle corrupt PDF files in read_pdf" (8 linked traces, e.g. 36362eb966cdbb85dcb2fb1b280e1034, the Gemini 400 INVALID_ARGUMENT on invoice 13).
- Already done earlier (6edff38): the 400 is wrapped as a ToolError and a task error never kills the run.
- Done now: `read_pdf(mode="llm")` checks the PDF opens with pdfplumber first; a file with no /Root fails fast as "corrupt PDF, not sent to the LLM reader". Scanned PDFs still go to the LLM.
- Tests run: pytest 55 passed (2 new: corrupt PDF makes no LLM call; scanned PDF still does). Run 1010-4f8453 (trace a8d7a3e9cef5f60e6fc5ee9e22ba70ad, LLM cache on, not an evidence run): invoice 13 → reparse_alt fails without an LLM call → skip, listed under Not analysed; 5/5 planted errors, 0 unsupported numbers.
- 2026-10-10 20:55 IST follow-up: connected the Neatlogs MCP server (local scope, key not in repo) and read the triage and the original trace 36362eb966cdbb85dcb2fb1b280e1034 (invoice 13: read_pdf text-mode ERROR, then the LLM fallback). Evidence run 1010-7309e6 (LLM cache off, trace 953bb991e2547b1591bb2bb6adb555b8): invoice 13 skipped with 0 LLM calls, 5/5 planted, 0 unsupported numbers, 0 fallback hops. Neatlogs ingestion was stalled server-side at the time (`neatlogs doctor --probe`: TRACE_READBACK_TIMEOUT, "processing at raw_durable"), so the new traces showed 0 spans.
