<!-- entire-graph:begin -->
This repo has the entire-graph code graph installed. Before exploring code with
grep/find/whole-file reads, read .entire/graph-agent.md — resolution-first guidance
for using graph retrieval, focused source inspection, and verification.
@.entire/graph-agent.md
<!-- entire-graph:end -->

# CLAUDE.md — Spend Radar (neatHack 2026)

You are building **Spend Radar** with Akarsh (team **qwep**, solo) for **neatHack**, a 48-hour online AI-agent hackathon run by neatlogs. This file is the full brief: the rules, the scoring, what to build, the order to build it, and what evidence to produce. Read all of it before writing code. Re-read "Hard rules" whenever you are unsure.

Source of rules: https://neatlogs.com/hackathon (fetched 10 Oct 2026). Build-log skill: https://neatlogs.com/hackathon/skill. If anything here conflicts with those pages, the pages win; tell Akarsh.

---

## 0. Hard rules (breaking any of these can disqualify us or cost money)

1. **All code is written during the hackathon**: Sat 10 Oct 2026, 12:30 PM IST → Mon 12 Oct 2026, 11:55 PM IST. Do not copy in code from any earlier project, including Akarsh's other repos (Glance, SecureAgent, etc.). Open-source libraries installed via pip/npm are fine.
2. **Public GitHub repo**, with commits made throughout the event so judges can see the dates. Commit small and often (at least every hour of work). Never squash or rewrite history. The repo's first commit must be after 12:30 PM IST, 10 Oct.
3. **Must use all three: neatlogs, Entire, cfo.ai**, each with a clear role, and the demo must cover all three.
4. **Demo video ≤ 3 minutes** (not stated on the rules page; we keep it as the safe limit).
5. **Submission** = a public quote-post on X of the official neatlogs submission post, between **Mon 12 Oct, 7:00 PM and 11:55 PM IST**, containing team name (qwep), project name, public repo link, demo link. Late = not judged.
6. **Do not use Glance** or any of Akarsh's existing projects in this repo.
7. **No fabricated numbers anywhere** — not in code, README, report, posts, or the video. Every confidence score is computed. Every metric comes from a saved scorecard or trace link. Unmeasured numbers in drafts are written as `{N}` placeholders and filled only from a real run. Estimates are labelled as estimates.
8. **Never commit secrets.** `.env` (git-ignored) plus `.env.example`. Secrets never appear in commits, logs, neatlogs traces, or screenshots (see §6.1).
9. **Zero spend, everywhere.** No billing on any service. Free tiers only for LLMs (§3). Never add credits or a payment method to OpenRouter, Google AI Studio, or anything else. cfo.ai is cancelled in Settings → Billing immediately after signup. AWS use stays inside the organisers' allowance and instances are stopped whenever idle. Anything that could incur a charge → ask Akarsh first.
10. **Real customer finance data never goes through free LLM providers.** We only send fictional Acme data and public Crustdata facts.

---

## 1. Judging (optimise for this, in this order)

| Category | Weight | What the judges look at |
|---|---|---|
| The agent | 30% | How well the agent handles a substantial task start to finish |
| Use of neatlogs, Entire, cfo.ai | 25% | How effectively they were used to build, improve, and plan a business around the agent |
| Demo video | 20% | How clearly it explains the agent and the use of all three tools |
| Building in public | 15% | What was shared publicly during the hackathon, tagged #neatHack |
| Usefulness & originality | 10% | A real problem solved in a new way |

Focus areas for the agent: **planning, tool use, state, context, execution, recovery, verification, iteration**. The design must visibly hit every one.

**Evidence judges require (each claim must be checkable):**
- *Agent improved*: runs before and after a change (neatlogs traces) with numbers compared (§7).
- *Used neatlogs*: trace links or screenshots.
- *Used Entire*: checkpoints or entire-graph output from the repo.
- *Used cfo.ai*: a business plan covering pricing, costs, revenue, runway.
- *Recovers from failure*: a run where an action failed, showing what the agent did next.
- *Built in public*: links to posts tagged #neatHack.
- *Wrote code during hackathon*: public repo with dated commits.

Judges: 2 from Entire (devrel, solutions engineer), 2 from neatlogs (founder, head of product engineering), 1 founder of Orchestrator.inc. They build agent/dev tooling. They will notice fake metrics and will appreciate real traces, real bugs found and fixed, and clean engineering.

Prizes: 1st $2,000 + $5,000 Dodo credits; 2nd $1,000 + $3,000; 3rd $500 + $1,000; each winner gets 3 months neatlogs Pro. Separate $500 community award for genuine community interest. Winners announced 16 Oct.

---

## 2. The product

**One-liner:** An agent that tells a finance team where competitors are outspending them on people, and shows its work — every number has a source, and the agent tries to disprove its own findings before reporting them.

**Problem:** Finance teams budget against their own ledger, not the market. They learn a competitor doubled its ML team or raised a round a quarter late.

**The task the agent completes end to end:**
> Input: a folder of the company's finance files (budget spreadsheet, invoice PDFs, spend policy) and a hard-coded competitor list (`data/acme/competitors.yaml`).
> Output: a report per spend category with our actual spend, the competitor estimate range, the gap, whether policy is violated, a recommendation, and a link to every source behind every number — plus a list of claims the agent checked and overturned.

**Category scope (decided):**
- **Competitor comparison is on people cost only**: engineering, ML/AI, sales, marketing *team*. Each category states "people cost only" in the report. Policy rules in `policy.yaml` are written against people cost.
- **Infra/cloud** is checked only internally (our invoices vs budget vs policy). No competitor estimate for it.

**Competitors:** real dev-tools / AI-infra companies. Step 1 probes 7 candidates — Datadog, Grafana Labs, Chronosphere, Honeycomb, Arize, New Relic, Sentry — and keeps the 4–5 with the best Crustdata coverage. Never include neatlogs or Entire (their people judge). Competitor auto-selection is a stretch goal only.

**Our company:** "Acme Observability Inc." — fictional, labelled as such everywhere.

---

## 3. Tool stack and the role of each tool

| Job | Tool | Notes |
|---|---|---|
| Trace every LLM call, tool call, retry, decision, state change; find bugs; compare runs | **neatlogs** (required) | Docs: https://docs.neatlogs.com, https://docs.neatlogs.com/sdk. Integrate before agent logic so the first run is traced. Details in §6. |
| Repo context and checkpoints for the coding agent (you) | **Entire** (required) | Already enabled for Claude Code (`entire enable --agent claude-code`; re-run after any `git init`). Checkpoints add an `Entire-Checkpoint` trailer to commits. Evidence: `entire checkpoint list/explain`, `entire graph stats`, entire-graph output → `evidence/entire/`. |
| Business plan: pricing, costs, revenue, runway | **cfo.ai** (required) | Akarsh signs up at https://cfo.ai/neathacks and cancels the subscription immediately. He builds the model; you prepare inputs (§9). |
| Competitor data | **Crustdata** | 5,000 credits. Auth: `authorization: Bearer <key>`, `x-api-version: 2025-11-01`. `POST /company/enrich` (`fields`: headcount incl. `by_role_absolute`/`by_role_percent`, growth `mom/qoq/six_months/yoy/two_years`; funding) ≈ 2 credits/company. `POST /job/search` (`job_details.title`, `job_details.category`, `metadata.date_added`; `group_by` aggregations, `limit:0` for aggregation-only) at 0.03 credits/result. No headcount timeseries — trend comes from growth fields. Confirm all fields with the Step 1 probe; check real prices via `GET /account/endpoints`. |
| LLM — primary | **Google Gemini, free tier only** (`google-genai>=1.55.0`) | Role split: Pro → plan, `decide:recovery`, self-audit; Flash → report prose; Flash-Lite → extraction, title classification, JSON re-asks. **Read the real model list and rate limits from AI Studio in Step 2; do not trust model names from memory.** If Pro's daily quota is too small, the eval decides whether Flash is good enough for planning (becomes a case study). |
| LLM — secondary | **OpenRouter, `:free` models only** | Never add credits. A guard in `llm.py` refuses any model ID not ending in `:free`. Free limits without credits: 20 req/min, 50 req/day. Roles: (1) cross-provider failover after Gemini retries + model fallback are exhausted; (2) independent second opinion in the self-audit, max 5 calls/run, only on findings Gemini marked uncertain or overturned. Pick the model in Step 2 by listing free models via the API; it must support JSON output or tool calling and pass our Pydantic schemas. |
| Hosting (optional) | **AWS** | Organisers' allowance ($25, us-east-1 only) covers EC2, Lambda, IAM and load balancers only; Bedrock is not available. One instance, t3.micro or t3.small, in Hackathon_VPC, for a live report / scheduled runs. Stop it whenever not needed (the access page does not track spend). Never on the critical path. AWS keys stay in `.env` and never appear in commits, logs, traces or screenshots. |
| File parsing | `openpyxl` (xlsx), `pdfplumber` (PDF), Gemini PDF input as fallback for scanned PDFs | Test both PDF routes early; keep the one that works. |
| Language | Python 3.11+, plain hand-written loop, Pydantic for state | No heavy agent framework. |

All LLM calls go through one module, `llm.py`: `llm(role=..., ...)` picks the model per role, enforces the `:free` guard, the rate limiter, and the quota ledger, and records provider/model on every span.

---

## 4. Agent architecture

### 4.1 The loop

```
PLAN → ACT → OBSERVE → VERIFY ─┬─ pass → next task
                               └─ fail → DECIDE:RECOVERY (LLM) → fix-up task → ACT
when queue empty → SELF-AUDIT → REPORT
```

1. **Plan** (LLM): reads goal, file listing, competitor list; emits a typed task list validated against a Pydantic schema. Traced as `plan`.
2. **Act** (Python): run the next task; exactly one tool call.
3. **Observe**: store the result in state *with its source* (file path + sheet/row or page; Crustdata endpoint + request id + fetch timestamp).
4. **Verify** (Python): deterministic check for that result type (§4.4).
5. **Decide:recovery** (LLM, native tool/function calling): on a failed check, choose one action from a fixed menu — `reparse_alt`, `narrow_range`, `fetch_more_signal`, `substitute_competitor`, `mark_low_confidence`, `skip` — with a one-line reason. Each decision is its own span `decide:recovery` recording the options offered and the one picked. The LLM may also decide that a surprising result warrants a new task.
6. **Self-audit**: tries to *disprove* each finding — re-checks sources, looks for a contradicting signal (headcount growth reversal, layoffs/freeze, funding timing), recomputes the number. OpenRouter second opinion on uncertain/overturned findings (≤ 5 calls). Downgraded/removed findings logged as "overturned".
7. **Report**: `runs/<run_id>/report.md` (+ `report.html` if time) with every number linked to its source, an "Overturned claims" section, and a header stating **data mode: real | fixture** and the provider mix.

**Who decides what:** the LLM decides the plan, recovery choices, and whether to add tasks. Python decides task execution, all maths, retry caps, and quota/credit limits. The demo must show at least one recovery choice that differs from the obvious default (e.g. fetching an extra signal instead of skipping).

### 4.2 Tools

| Tool | Deterministic? | Purpose |
|---|---|---|
| `list_files(folder)` | yes | inventory inputs |
| `read_spreadsheet(path, sheet, range)` | yes | budget lines |
| `read_pdf(path, pages, mode="text"/"llm")` | text: yes; llm: no | invoices |
| `crustdata_company(name_or_domain)` | yes (API) | headcount by role, growth, funding |
| `crustdata_jobs(company, filters)` | yes (API) | open roles, grouped by `job_details.category` |
| `classify_titles(titles)` | no (LLM) | only if Crustdata categories prove unusable in Step 1 |
| `estimate_spend(headcount_by_category, salary_table)` | yes | headcount → estimated annual people cost |
| `compare(ours, theirs, policy)` | yes | gap + policy violation per category |
| `find_contradictions(finding)` | mixed | used by self-audit |
| `write_report(state)` | yes | final output |

All money/maths is deterministic Python. The LLM never does arithmetic that ends up in the report.

### 4.3 State and resumability

- One `RunState` (Pydantic) per run: goal, task queue, completed tasks, extracted figures (value + source), competitor figures (value + source), verification results, retry counts, recovery decisions, overturned findings, token/request totals per model, provider mix, data mode.
- Save to `runs/<run_id>/state.json` after **every** step. `python -m spendradar resume <run_id>` continues from the last saved step.
- Cache every Crustdata response to `cache/crustdata/<hash>.json`. Cache LLM responses to `cache/llm/` in development.

### 4.4 Verification checks (confidence is computed, never typed in)

- Spreadsheet/invoice line items sum to the stated total within 1%.
- Each invoice amount appears in the budget category it is mapped to (or is flagged).
- Each competitor estimate rests on ≥ 2 independent signals, else `low_confidence`.
- Every number in the report has a stored source; a number without one is dropped.
- `confidence = f(checks passed, number of signals, data freshness)` — implement in `verify.py`, document the formula in the README.

### 4.5 Recovery paths (each must appear in at least one saved trace)

1. Corrupt/unreadable PDF → other parser → skip and list under "Not analysed".
2. Crustdata timeout / 429 / 5xx → exponential backoff, max 3 retries → cached response if available → mark data missing.
3. Competitor with no data → substitute next-closest company, noted in report.
4. Totals mismatch → re-read with narrower range → flag the file.
5. LLM returns malformed JSON → re-ask with the validation error, max 2 times.
6. LLM 429 / 5xx → backoff → different free Gemini model (own quota) → OpenRouter `:free` model. Each hop is a `fallback:<model>` span.

**Failure traces:** save **natural** failures whenever they happen (free tiers will 429 on their own) *and* deliberate ones via a fault-injection switch, `--inject <target>:<fault>` (e.g. `crustdata:429`). Injected runs are tagged `inject:<...>` in neatlogs and labelled in the run report. `evidence/recovery/` lists each path with whether its trace was natural or injected.

### 4.6 Budgets and quotas

- **Crustdata:** cap 60 credits per run; never more than 100 credits in one go without asking Akarsh.
- **LLM quota ledger** `cache/ledger.json` (git-ignored): requests and tokens per model per day, against free-tier limits read from AI Studio / OpenRouter in Step 2. A run does not start if remaining quota can't cover it. A client-side rate limiter keeps calls under per-minute limits. `python -m spendradar ledger` prints remaining quota.
- **Caches:** everything cached in development. **Evidence runs** turn the LLM cache off (real model calls) and keep the Crustdata cache on (no re-spend); the report shows each Crustdata response's fetch date. Evidence runs are tagged `evidence` and labelled.

---

## 5. Build order (commit after each numbered step)

All times IST. If behind schedule, see §11.

### Saturday 10 Oct — working skeleton by midnight

**Step 0 (before 12:30, no code):** Akarsh does web check-in, Luma, Discord, cfo.ai signup + immediate cancel. Plan and read docs only.

**Step 1 — Repo + Crustdata spike (12:30–1:15, ≤ 25 credits):**
- Reset local git (the pre-12:30 `.git` is discarded — confirm with Akarsh before deleting), `git init`, re-run `entire enable --agent claude-code`, push to a new empty public repo. First commit: this CLAUDE.md, `.gitignore`, `.env.example`.
- `spikes/crustdata_probe.py`: enrich + jobs `group_by job_details.category` (`limit:0`) for the 7 candidates; raw JSON to `cache/`. Report exactly which fields exist. Pick the 4–5 best-covered → `data/acme/competitors.yaml`.
- **Decision by 2:00 PM:** role-level headcount exists → use directly; only totals + titles → `classify_titles` + 30-title labelled eval set; neither usable → stop and tell Akarsh.

**Step 2 — Instrumentation + providers (by 2:30, may run to 3:00):**
- neatlogs `init()` with `instrumentations=["google_genai"]`, the `mask` callback (§6.1), and run tags. One traced dummy Gemini call visible in the dashboard. Check whether `neatlogs sharing` can produce public trace links; if not, evidence uses screenshots.
- List real Gemini models + rate limits from AI Studio; list OpenRouter `:free` models via API and pick one that passes our schemas. Write the limits into `config.yaml` and the ledger.
- Secret-masking unit test passes (required before Step 2 counts as done).
- gitleaks pre-commit hook (§6.1), added alongside Entire's hooks; verify the Entire checkpoint trailer still appears.
- **Plan the case studies:** from the real quotas, work out how many before/after comparisons (n=3 runs per side, §7) fit in the remaining days, and write that plan into `hackathon.md` before running any.

**Step 3 — Sample data (by 4:00):** under `data/acme/` (fictional, labelled):
- `budget_fy27.xlsx` — spend by category × month
- `invoices/` — 12–15 PDFs incl. **one scanned-image PDF, one corrupt file, one whose line items don't sum to its total, one mis-categorised**
- `policy.yaml` — people-cost rules, e.g. "ML/AI team cost within 20% of competitor median"
- `salary_table.csv` — loaded cost per role category (cite a public source or label as assumption)
- `competitors.yaml` — from Step 1
- `ground_truth.json` — planted errors and correct totals (evals only, never shown to the agent)

**Step 4 — Tools (by 7:00):** §4.2 tools + `llm.py`, unit tests for the deterministic ones.

**Step 5 — Loop + state (by 10:00):** plan → act → observe → verify → decide, state saved per step; end-to-end run with a rough report.

**Step 6 — First full traced run (by midnight):** trace link → `evidence/traces.md`. Draft post #2.

### Sunday 11 Oct — trustworthy and measurable

**Step 7 — Verification + computed confidence.**
**Step 8 — Recovery paths (§4.5):** collect natural failure traces; inject the rest; save links.
**Step 9 — Eval harness (§7):** `python -m spendradar eval [--n 3]` → scorecard.
**Step 10 — Find real bugs in neatlogs traces** (hallucinated totals, wasted retries, token blow-ups, wrong tool choice, slow spans). Fix 2–3, within the case-study plan from Step 2. Each → `evidence/case-studies/NN-<slug>.md`.
**Step 11 — Self-audit pass:** measure overturn rate on planted errors and fixtures.
**Step 12 — Resume-after-crash** (kill mid-run, resume, finish). Save trace.
**Step 13 — Cost per run:** tokens/latency per model from neatlogs for 5 runs → `business/unit_costs.md` as paid-equivalent cost (§9).
**Sunday night:** record a backup demo video.

### Monday 12 Oct — package and submit

**Step 14 (by noon):** README (§10), report polish, architecture diagram (Mermaid + PNG).
**Step 15 (by 3 PM):** cfo.ai plan finalised by Akarsh, exported to `business/`.
**Step 16 (by 5 PM):** final demo video, captioned, uploaded (YouTube unlisted or Loom), ≤ 3:00.
**Step 17 (6:30 PM):** final commit, all README links verified.
**Step 18 (7:00 PM sharp):** Akarsh quote-posts the official neatlogs post (aim for the first 50).

---

## 6. neatlogs usage (25% category — central, not decorative)

- Install `neatlogs[google-genai]`; call `neatlogs.init(...)` **before** constructing the Gemini client. OpenRouter calls get custom spans (or an instrumentation key if verified in docs).
- Trace every LLM call (prompt, response, tokens, model, provider), every tool call (`@neatlogs.span(kind="TOOL", ...)`), every retry, every `decide:recovery`, every `fallback:<model>`, verification results, self-audit verdicts. Span kinds per https://docs.neatlogs.com/sdk/span-kinds.
- Span names: `plan`, `act:read_pdf`, `verify:totals`, `decide:recovery`, `fallback:<model>`, `audit:finding_<id>`, `report`.
- Tags are process-wide, so each `spendradar run` is its own process with tags `sha:<short-sha>`, `run:<run_id>`, `variant:<label>`, plus `evidence` / `inject:<...>` / `fixture` when applicable.
- neatlogs has no run-comparison feature we found; our eval scorecards store trace IDs and our table does the comparison. Use neatlogs evals/experiments features only per docs; never invent APIs.
- Every bug fix starts from a trace link and ends with comparison traces.

### 6.1 Secret safety

- Client-side `mask` callback in `neatlogs.init(mask=...)`: blank attributes whose key contains key/secret/token/password; regex-mask key formats (`AIza…`, `sk-or-…`, `AKIA…`, `Bearer …`, Crustdata key) in all text values; mask every secret value loaded from `.env`. Do not change server-side PII settings (they are project-wide).
- Unit test: a fake key through a span comes out masked.
- Pre-commit: gitleaks (open source) via `.git/hooks/pre-commit`, appended to Entire's hook, with custom rules for Crustdata and OpenRouter key formats.

## 7. Evals (turn "it improved" into a number)

`ground_truth.json` lists planted errors (mismatched totals, mis-categorised invoice, corrupt file) and correct category totals, plus the fault-injected fixtures.

**Fixtures rule:** Altered fixtures are allowed only in `evals/`, and every run report labels whether it used real data or a fixture. Fixtures in `evals/fixtures/` are cached real Crustdata responses with one field changed on purpose (e.g. ML job postings × 5), each logged in `ground_truth.json`. Product runs only ever read real data. `--fixtures` refuses any folder outside `evals/`, tags the run `fixture`, and sets the report's data mode to FIXTURE.

The eval reports:
- planted errors caught / total
- category total accuracy (abs % error)
- unsupported numbers in report (target 0)
- planted/fixture false findings overturned by self-audit / total (scored)
- competitor findings overturned on real data: N (no ground truth — unscored; report shows both sources side by side)
- title-classifier accuracy on 30 labelled titles (only if used)
- tokens, requests, latency per run, per model; `provider_mix`

**Comparisons:** each side of a before/after = 3 runs with the same provider mix; runs that used fallback are excluded. Report mean and min–max; link one trace per side and list all in the case study. If quota allows fewer than 3, say so — never round up. Check the ledger before starting.

Scorecards → `evidence/evals/<timestamp>-<sha>.json` (including trace IDs); improvement table in `evidence/evals/README.md`.

## 8. Evidence folder

```
evidence/
  traces.md                 # every important trace link, one line each, with what it shows
  case-studies/NN-<slug>.md
  recovery/                 # per recovery path: trace link/screenshot, natural or injected
  evals/                    # scorecards + improvement table
  entire/                   # checkpoint list/explain output, entire graph stats, graph output
  build-in-public.md        # every #neatHack post, with timestamp and link
```

Case-study template:
```
# <Bug title>
- Symptom (what the trace showed): <trace link before>
- Root cause:
- Fix: <commit link>
- After: <trace link after>
- Numbers (n=<runs> per side, same provider mix): <metric before mean [min–max]> → <after mean [min–max]>
```

## 9. cfo.ai inputs (you prepare; Akarsh enters them)

`business/inputs.md`:
- **Paid-equivalent cost per run**: measured tokens per model (neatlogs) × the published paid price of the same model, with price-page link and date checked. Labelled as an estimate; development ran on free tiers, but paying customers can't.
- Crustdata credits per run (measured) and their cost at a cited public price (or labelled assumption).
- Runs per customer per month (assumption), hosting estimate, proposed pricing tiers (labelled proposals), base and growth customer scenarios.
- Modest, explicit assumptions; no unsupported TAM claims. The plan must cover **pricing, costs, revenue, runway**.

## 10. README structure

1. One-liner + 20-second GIF of a run
2. The problem (3 sentences)
3. What the agent does end to end
4. Architecture diagram + the loop
5. Each focus area (planning, tool use, state, context, execution, recovery, verification, iteration) — one line + one trace link each
6. How we used neatlogs / Entire / cfo.ai — one section each with evidence links
7. Results: eval improvement table, case studies
8. Run it yourself (setup, `.env`, `python -m spendradar run data/acme`, `resume`, `eval`, `ledger`)
9. Limitations: estimates; people cost only; fictional company data; Crustdata coverage; developed on free LLM tiers which may use prompts for training (only fictional/public data was sent); business costs are paid-equivalent estimates
10. Built during neatHack, 10–12 Oct 2026 — links to build-in-public posts

## 11. If behind schedule — cut in this order

1. HTML report (keep Markdown)
2. Resume-after-crash
3. Competitor auto-selection (already a stretch goal)

Already cut: contracts parsing (return only if ahead on Sunday 6 PM).

**Never cut:** neatlogs tracing, verification, at least one recovery trace, at least one before/after case study, eval scorecard, cfo.ai plan, Entire evidence, the video, the posts.

Cut entirely: Slack alerts, custom dashboards, mock competitor data in product runs, hand-typed confidence scores, any demo longer than 3 minutes.

## 12. Building in public (15%) — draft these for Akarsh

Draft each post in `evidence/build-in-public.md` when its moment arrives; Akarsh posts them. Every post: #neatHack, tag @neatlogs where natural, a real screenshot, and only numbers from saved scorecards/traces.

1. Sat ~1 PM — the idea + the loop sketch
2. Sat night — first full traced run
3. Sun morning — a bug the traces caught
4. Sun afternoon — eval scorecard across commits
5. Sun night — self-audit overturning its own wrong claims
6. Mon — cfo.ai unit economics built from real trace token counts
7. Mon 7:00 PM — submission quote-post (team qwep, project, repo, demo)

Also genuinely help other teams in Discord and on X.

## 13. Demo video script (≤ 3:00, covers all three tools)

| Time | Show | Say |
|---|---|---|
| 0:00–0:15 | Self-audit overturning a claim in a trace, with the scorecard on screen | "This agent caught {N} of its own mistakes before reporting them." (N from the final scorecard; if N = 1: "Here's the moment it caught itself.") |
| 0:15–0:40 | Architecture diagram; run starts | Problem; the loop; tools |
| 0:40–1:20 | **neatlogs**: failure → `decide:recovery` (a non-default choice) → recovery; before/after case study; eval table | The bug we found in traces and the numbers after the fix |
| 1:20–1:45 | **Entire**: checkpoints / entire-graph | How context was kept across the coding agent's changes |
| 1:45–2:20 | **cfo.ai**: plan built from measured tokens → paid-equivalent cost | Pricing, costs, revenue, runway |
| 2:20–2:50 | Final report with source links, data-mode header | Result + usefulness |
| 2:50–3:00 | Repo + #neatHack | Close |

Captions on. Every number on screen must come from a saved scorecard or trace.

## 14. Working agreements for Claude Code

- Before using any external SDK/API (neatlogs, Entire, Crustdata, cfo.ai, Gemini, OpenRouter, AWS), read its current docs; never guess function names or model IDs. If docs are unclear, write a tiny probe and inspect real output.
- Timestamps in `hackathon.md`, `evidence/` and posts come from `date` or commit times, never estimated.
- Keep `hackathon.md` at the repo root per the neatHack skill: sections Project, Team, Stack, Build log, Demo, Limitations, Submission. Append a dated entry per work session separating planned vs done and listing tests actually run; never delete old entries; no secrets, private traces, or made-up results.
- Commit messages: imperative, specific, with step number (e.g. `step 8: add backoff+cache fallback for crustdata 429`).
- Ask Akarsh before: switching ideas, spending > 100 Crustdata credits in one go, anything that could cost money, starting/leaving an AWS instance running, or anything irreversible.
- Small, working, traced increments over big rewrites. Every evening main runs end to end.
- When reporting progress, lead with what works, what's broken, and the next decision needed.
- Open decision: whether neatlogs public trace links work (resolve in Step 2).
