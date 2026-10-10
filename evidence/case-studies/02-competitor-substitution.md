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
  - A same-mix n = 3 comparison is planned after the quota reset.
