# Building in public — #neatHack (team qwep)

Each entry: draft text, what image to attach, and once posted, the link and timestamp.

---

## Post 1 — the idea + the loop (Sat 10 Oct, ~1 PM IST)

**Status:** draft — not posted

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

**Status:** draft — not posted

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

> #neatHack: I stopped trusting "it looks better" and made Spend Radar score itself against a ground-truth file the agent never reads. Every run's @neatlogs trace id goes into the scorecard.
>
> Two commits so far:
>
> 11a5108 → 22f00b0
> planted errors caught: 5/5 → 5/5
> unsupported numbers: 0 → 0
> peers kept: 2/5 → 5/5
> Crustdata credits: 26.6 → 5.4
> recovery decisions (non-default): 13 (10) → 10 (7)
>
> Honest caveat: n = 1 per side, both runs used fallback models, and the provider mix differs. So it's indicative, not clean. Same-mix n = 3 runs: {{n3_results}}, after the free-tier quota resets.
>
> Accuracy didn't move. Waste did.

**Image:** the scorecard table from `evidence/evals/README.md`, with the two trace ids visible in the neatlogs dashboard.

**Sources:** `evidence/evals/README.md`, `20261010T141541-11a5108-before-fix.json`, `20261010T141541-22f00b0-after-fix-02.json`.

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
> Final scorecard: {{N}} claims caught before reporting.

**Image:** the report's "Overturned claims" section next to the `audit:f_ml_ai` span (trace `af0df27e2d3433e0c608fb28a018a22d`).

**Sources:** `README.md` (Limitations), `evidence/traces.md` (trace `36362eb966cdbb85dcb2fb1b280e1034`, run 1010-9e86fc), commit `15d1109`.

**Posted:** —  
**Link:** —

---

## Post 6 — cfo.ai unit economics from real tokens (Mon)

**Status:** draft — not posted

**Text:**

> What does one Spend Radar run cost? I didn't guess. I read it off the @neatlogs traces. #neatHack
>
> Evidence run 1010-7bf26d (LLM cache off):
> 30 LLM calls
> 10,260 tokens in / 25,126 out
> paid-equivalent LLM cost: $0.0692
> Crustdata: 20.8 credits on a cold run (5 competitors x 2 credits + job results x 0.03)
>
> I built on free tiers, so actual spend was $0. These are what a paying deployment would face: measured tokens x the published paid price of the same model.
>
> Those numbers went into cfo.ai: monthly cost {{monthly_cost}}, price {{price}}, runway {{runway_months}} months.
>
> Caveats: n = 1 run (target 5), and Crustdata doesn't publish a USD price per credit ({{usd_per_credit}} needed).

**Image:** the per-model table from `business/unit_costs.md` beside the cfo.ai plan screen.

**Sources:** `business/unit_costs.md`, trace `288f07d84bb84e15754a241eef40d779`.

**Posted:** —  
**Link:** —
