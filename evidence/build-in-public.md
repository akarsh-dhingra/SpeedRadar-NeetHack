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

**Status:** draft — not posted

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
