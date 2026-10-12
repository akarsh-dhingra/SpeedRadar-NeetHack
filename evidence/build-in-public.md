# Building in public — #neatHack (team qwep)

Each entry: draft text, what image to attach, and once posted, the link and timestamp.

---

## Post 1 — the idea + the loop (Sat 10 Oct, ~1 PM IST)

**Status:** posted (Akarsh confirmed 2026-10-11 10:18 IST; post time and link to add)

**Text:**

> Building Spend Radar for #neatHack 🛰️
>
> Finance teams budget against their own ledger, not the market. They find out a competitor doubled its ML team a quarter too late.
>
> Spend Radar reads a company's budget + invoices, pulls competitor hiring data, and reports where competitors are outspending them on people — with a source behind every number.
>
> The twist: before it reports anything, it tries to disprove its own findings. Claims that don't survive get listed as "overturned", not hidden.
>
> The loop:
> plan → act → verify → (fail? the LLM picks a recovery) → self-audit → report
>
> Every LLM call, tool call, retry and recovery decision traced in @neatlogs. Building with @EntireHQ checkpoints, business plan in cfo.ai.
>
> Solo, 48 hours, all free tiers. Updates as it breaks 👇

**Image:** a clean diagram of the loop (PLAN → ACT → OBSERVE → VERIFY → DECIDE:RECOVERY → SELF-AUDIT → REPORT). It goes in the README too, so draw it once as Mermaid, export it to PNG, and attach that.

**Before posting, check:**
- [ ] The @-handles for Entire and cfo.ai are correct on X (I haven't verified `@EntireHQ`)
- [ ] The repo is public, and adding the link is optional
- [ ] The post contains no numbers that need a source

**Posted:** —  
**Link:** —

---

## Post 2 — first full traced run (Sat 10 Oct, evening)

**Status:** posted (Akarsh confirmed 2026-10-11 10:18 IST; post time and link to add)

**Text:**

> First full end-to-end run of Spend Radar for #neatHack, every step traced in @neatlogs.
>
> The agent read a (fictional) company's budget + 13 invoices, pulled real competitor headcount from Crustdata, and wrote a sourced report.
>
> ✅ caught 5/5 errors we planted (bad totals, a mis-filed invoice, a scanned PDF, a corrupt file)
> ✅ 0 numbers in the report without a source
> 🔁 its self-audit overturned its own ML/AI finding: the competitor signals contradicted each other
>
> The traces also caught bugs in *my* agent. One recovery path silently swapped 3 of 5 peer companies for companies 9–32× our size. Fixing that next 👇

**Image:** the report's "Overturned claims" section next to the neatlogs trace for `audit:f_ml_ai` (trace `af0df27e2d3433e0c608fb28a018a22d`).

**Source for every number:** run `1010-b31657`, scorecard `evidence/evals/20261010T141541-11a5108-before-fix.json`. The 9–32× range is Acme’s 330 people (end FY27, budget sheet) vs New Relic (3,095 → 9.4×) and Datadog (10,482 → 31.8×), headcount from Crustdata.

---

## Post 3 — a bug the traces caught (Sun morning)

**Status:** posted (Akarsh confirmed 2026-10-11 10:12 IST; link to add)

**Text:**

> #neatHack day 2: the @neatlogs traces caught my agent quietly wrecking its own analysis.
>
> When one competitor's ML/AI estimate was weak, the agent's recovery step *replaced the whole competitor*, dropping its good engineering, sales and marketing data. It did that 3 times. 3 of 5 peers became companies 9–32× our size.
>
> The `decide:recovery` spans showed it plainly: fetch_more_signal (which re-ran the identical cached query, so no new info) → substitute_competitor.
>
> Fix: substitution only when a competitor has *no* data, and "more signal" now fetches a genuinely different sample.
>
> Before → after (1 run each):
> peers kept 2/5 → 5/5
> Crustdata credits 26.6 → 5.4
> planted errors caught 5/5 → 5/5

**Image:** the before trace's `decide:recovery` span list (trace `af0df27e2d3433e0c608fb28a018a22d`) next to the case-study table.

**Sources:** `evidence/case-studies/02-competitor-substitution.md`, scorecards `20261010T141541-11a5108-before-fix.json` and `20261010T141541-22f00b0-after-fix-02.json`.

---

## Post 4 — eval scorecard across commits (Sun afternoon)

**Status:** draft — not posted

**Text:**

> #neatHack: my agent's self-audit gave three different verdicts on the same data.
>
> 5 identical Spend Radar runs, same models, 0 fallbacks. The ML/AI finding came back confirmed once, overturned three times, downgraded once. The @neatlogs traces showed why: the deciding fact (two competitors' signals contradict each other) was already computed in Python, but an LLM was still judging it.
>
> Fix: Python decides what Python can see. The LLM only judges real ambiguity (news, mis-billed invoices).
>
> n = 5 per side:
> distinct verdicts: 3 → 1
> runs agreeing: 3/5 → 5/5
> planted errors caught: 5/5 → 5/5
> fixture run: 6/6
>
> Then an @EntireHQ trail runner reviewed the fix and caught a gap I'd missed: news evidence was being skipped. Fixed before merge.

**Image:** the "Same data, three different audit verdicts" card on the site's Before / after page (each run shows its ML/AI verdict), next to trail #2's runner finding.

**Sources:** `evidence/case-studies/05-audit-verdict-variance.md`, scorecard `evidence/evals/20261011T145242-bb2fb2f-cs05-after-deterministic-audit.json`, before runs 1010-767322/bf52d4/4d1835/bd4980/a67b26, Entire trail https://entire.io/gh/akarsh-dhingra/SpeedRadar-NeetHack/trails/2.

**Before posting, check:** the @-handle for Entire on X (not verified).

**Posted:** —  
**Link:** —

---

## Post 5 — self-audit overturning its own claims (Sun night)

**Status:** draft — not posted

**Text:**

> The part of Spend Radar I trust most is the part that argues with it. #neatHack
>
> Before reporting, a self-audit recomputes each finding, checks its sources, and looks for contradictions. An LLM gives a verdict, and a second provider gives an independent opinion.
>
> It overturned the ML/AI finding in runs 1010-b31657 and 1010-a32118 (the competitor signals contradicted each other), and downgraded it in 1010-7bf26d. In a fixture run, a marketing figure disagreed 19 vs 95 and was downgraded.
>
> Then the @neatlogs trace caught a bug in the auditor itself: the "second opinion" used the same model as the first verdict, so it wasn't independent. Fixed: it must now be a different model.
>
> Overturned claims go in the report, not in the bin.
>
> Across every run with an exported audit log: 5 findings overturned and 31 downgraded before reporting. The latest: a $5,280,000 ML/AI gap its own auditor threw out (run 1011-777bb7).

**Image:** the report's "Overturned claims" section next to the `audit:f_ml_ai` span (trace `af0df27e2d3433e0c608fb28a018a22d`).

**Sources:** `evidence/frontend_data.json` (`summary.findings_overturned` 5, `findings_downgraded` 31; run 1011-777bb7 finding f_ml_ai), `README.md` (Limitations), `evidence/traces.md` (trace `36362eb966cdbb85dcb2fb1b280e1034`, run 1010-9e86fc), commit `15d1109`.

**Posted:** —  
**Link:** —

---

## Post E — how Entire runs through Spend Radar (Sun evening)

**Status:** draft — not posted

**Text:**

> My agent cites a source for every number. With @EntireHQ, the code behind the agent gets the same treatment. #neatHack
>
> Spend Radar compares a finance team's people spend against real competitors, then tries to disprove its own findings. Here's where Entire sits in that system:
>
> 1/ Every run knows who wrote its code
> Each report and @neatlogs trace records its commit and its Entire checkpoint. A number links to its source, the source to its trace, and the trace to the agent session that wrote the code.
>
> 2/ A debugger for agent mistakes
> `spendradar explain <trace>` follows a failing neatlogs span to the code line, runs `entire why`, and returns the commit, checkpoint, session and prompt behind it, plus `entire graph impact` for what a fix would touch.
> On our corrupt-PDF bug the chain closed on itself: the prompt behind the fix was neatlogs' own auto-triage report.
>
> 3/ Every change gets reviewed before it merges
> Each change goes on a trail. 6 runners tailored to this repo (risk, confidence, drift, security, review, summary) know what matters here: secrets, zero spend, unsourced numbers.
> They caught 2 real issues before merge:
> - my self-audit fix silently skipped news evidence (layoffs, acquisitions)
> - a trace-reading loop that could run forever
> Both fixed, tested and resolved on the trail.
>
> 69 checkpoints · 3 trails · 6 runners · 2 bugs caught before merge
>
> The agent got more consistent, and every change to it now has to survive review first.
>
> https://akarsh-dhingra.github.io/SpeedRadar-NeetHack/#entire

**Images (up to 4):**
1. Trail #2 on entire.io, scrolled to the runner finding (medium, resolved): https://entire.io/gh/akarsh-dhingra/SpeedRadar-NeetHack/trails/2
2. The runners list for the repo (`.entire/runners/` or the Runners page on entire.io).
3. The site's Entire page: the stats row and the "Closed loop" callout.
4. The `spendradar explain` dossier for trace f8b07091…, cropped to Code → Commit · checkpoint → Prompt (`evidence/explain/f8b07091ded7-errors.md`).

**Sources:** `evidence/frontend_data.json` (`entire`: checkpoints 69, trails 3, runners 6, 2 findings resolved); trails 1–3 on entire.io; `evidence/explain/`; `evidence/case-studies/05-audit-verdict-variance.md`.

**Before posting, check:**
- [ ] Entire's handle on X (`@EntireHQ` is not verified)
- [ ] The trail and runner screenshots show no secrets or tokens

**Posted:** —  
**Link:** —

---

## Post 6 — cfo.ai unit economics from real tokens (Mon)

**Status:** draft — not posted

**Text:**

> What does one Spend Radar run cost? I didn't guess. I read it off the @neatlogs traces. #neatHack
>
> 5 evidence runs on gpt-5-nano (LLM cache off), mean per run:
> 29–30 LLM calls
> 13,188 tokens in / 66,327 out
> paid-equivalent LLM cost: $0.0285 (range $0.0270–$0.0296)
> Competitor data (Crustdata): $6.24–$9.24 per uncached run
>
> I built on free tiers, so actual spend was $0. These are what a paying deployment would face: measured usage x published paid prices.
>
> Those numbers went into cfo.ai. The surprise: the LLM is under 1% of the cost; competitor data is ~99%.
> Starter ($99) keeps 62% gross margin if half the runs are cached. With no cache, Team ($399) keeps 7%.
> So caching is the business model, and the Team tier needs repricing.
>
> Caveat: the 50% cache rate is an assumption I still have to measure.

**Image:** the cfo.ai Unit Economics cache-sensitivity view beside the `business/unit_costs.md` table.

**Sources:** `business/cfoai_plan.md`, `business/cfoai/Unit Economics.xlsx`, `business/unit_costs.md`, `business/unit_costs.json` (traces `5c512d38…`, `d4a8716f…`, `0dcf2297…`, `96bb7958…`, `c4c0b55a…`).

**Posted:** —  
**Link:** —

## Post R — tested on real invoices (Sun night / Mon)

**Status:** draft — not posted

**Text:**

> Our test companies are fictional. So tonight Spend Radar read 36 REAL invoices: public FCC political-ad bills (amazon/ConfBench, verified totals). #neatHack
>
> First pass: 7 of 12 totals right. The bug: TV invoices print Gross Total, then Agency Commission, then Net Amount Due, and the model kept copying the net.
>
> Fixed the prompt, then checked it on 12 invoices picked AFTER the fix:
> totals right: 6-7 of 12 -> 12 of 12 (3 passes each)
> wrong totals nobody was warned about: 4 per pass -> 0
>
> A second fix (accept line items that match the printed net) cut false review flags from 7 to 2 per pass on that set. On a third fresh set it made no clear difference, and I'm saying so.
>
> Every pass is a @neatlogs trace. The measured 17.6% review rate is now a scenario in our cfo.ai plan: checking flags ourselves costs ~5 points of gross margin.

**Image:** the site's Real invoices page (before/after table) next to one neatlogs trace of a pass.

**Sources:** `evidence/case-studies/06-real-invoices-gross-vs-net.md`, `evidence/case-studies/07-printed-net-line-items.md`, `evidence/real-invoices/*.json`, `business/cfoai/managed_review_2026-10-11.json`.

**Posted:** —  
**Link:** —
