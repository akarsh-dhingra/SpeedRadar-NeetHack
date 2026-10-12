# 02 — One weak category made the agent throw away 3 of 5 peers

- **Symptom (what the trace showed):** run `1010-b31657`, neatlogs trace `af0df27e2d3433e0c608fb28a018a22d`, commit `11a5108`. For Honeycomb, Arize and Chronosphere, the ML/AI estimate had only 1 signal. In each case the `decide:recovery` spans show the same two steps: `fetch_more_signal`, then `substitute_competitor`. All three peers of Acme's size were replaced by New Relic (3,095 people, 9.4× Acme) and Datadog (10,482, 31.8×), skewing every median in the report. The report also printed "None replaced by New Relic".
- **Root cause (3 bugs):**
  1. The recovery menu for a weak *ML/AI* estimate offered `substitute_competitor`, which drops the competitor's good engineering, sales and marketing data too.
  2. `fetch_more_signal` re-ran the **identical** jobs query, which came back from the cache. It added no information, so the follow-up check failed again.
  3. Classify tasks carry no competitor name, so the note printed `None`.
- **Fix:** commit `13effec`.
  - Substitution is offered only when a competitor has no data at all.
  - `fetch_more_signal` fetches a different real sample: engineering postings over the last 2 years.
  - After one extra signal, the only remaining option is `mark_low_confidence`.
  - The note uses the real name.
- **After:** evidence run `1010-7bf26d`, trace `288f07d84bb84e15754a241eef40d779`, commit `22f00b0`.
- **Numbers (n = 1 per side):**

| Metric | Before (`1010-b31657`) | After (`1010-7bf26d`) |
|---|---|---|
| Chosen peers kept (of 5) | 2 | 5 |
| `substitute_competitor` decisions | 3 | 0 |
| Crustdata credits used | 26.6 | 5.4 |
| Planted errors caught | 5/5 | 5/5 |
| Unsupported numbers in report | 0 | 0 |
| Recovery decisions (non-default) | 13 (10) | 10 (7) |

- **Caveats:**
  - n = 1 per side.
  - The before run's LLM latency and token totals predate the cached-call accounting fix (`8747783`), so they are not compared here.
  - The provider mix differs (see case study 01).
  - The metrics above (peers kept, substitutions, credits) come from agent logic, not model quality.
  - A same-mix n = 3 comparison is planned after the quota reset. *(Done at n = 5; see below.)*

## Rerun, 11 Oct 2026 (n = 5 per side, same code, models and data)

The original "before" commit (`11a5108`) only supports Gemini and OpenRouter, so re-running it would have changed the models as well as the logic. Instead, **before** is current code with only this fix put back the way it was (branch `ablation/cs02-fix-reverted`, commit `d311fb5`, not for merge): a weak ML/AI estimate may again choose `substitute_competitor`, and `fetch_more_signal` re-runs the identical jobs query. **After** is current code unchanged (`0d8b35c` for the first run, `40607a7` for the other four; those two commits differ only in the site export and an eval script, not in agent code). Both sides: evidence runs (LLM cache off), Acme data, the same Crustdata cache, models `gpt-5-nano` + `gemini-3.5-flash-lite`, **0 fallback hops in all 10 runs**.

| Metric (per run) | Before (fix reverted) | After (current code) |
|---|---|---|
| Chosen peers kept (of 5) | 2, 2, 2, 2, 2 | 5, 5, 5, 5, 5 |
| `substitute_competitor` decisions | 3, 3, 3, 3, 3 | 0, 0, 0, 0, 0 |
| Peers in the final comparison | Sentry, Grafana Labs + New Relic, Datadog (all 5 runs) | Honeycomb, Sentry, Arize, Chronosphere, Grafana Labs (all 5 runs) |
| Planted errors caught | 5/5 in all 5 | 5/5 in all 5 |
| Unsupported numbers in report | 0 in all 5 | 0 in all 5 |
| Recovery decisions (non-default) | 13 (8), 12 (7), 13 (8), 14 (9), 13 (8) | 10 (5), 10 (5), 11 (5), 10 (5), 10 (5) |

- Scorecards: `evidence/evals/20261011T221740-d311fb5-cs02-before-n5.json` (neatlogs eval trace `3b37c999443a09deed0f37c324972fa1`) and `evidence/evals/20261011T220804-0d8b35c-cs02-after-n5.json` (eval trace `eb1a9d341b791d403449dcac10f05764`).
- One run trace per side: before `1011-324f77` → `139c076ca99acaf06901377eeadee8c1`; after `1011-efdab4` → `2d28f557b12e42454b035de19eeb1ff0`.
- Crustdata credits are not compared: the first before-run spent 7.6 credits fetching the substitutes' job posts, and every later run on both sides was served from the cache (0 credits).
- The New Relic and Datadog headcounts are 9.4× and 31.8× Acme's (from the original case), so every median in the "before" reports is skewed by companies of a different size.
