# 03 — Two bugs that only showed up on fallback models

Scorecard: `evidence/evals/20261010T171003-fd9a4ef-gemma-mix-n3.json` (3 evidence runs, commit `fd9a4ef`). All three ran mostly on fallback models (`gemini-3.7-flash` → `gemma-4-31b-it` → OpenRouter `:free`), because the main Flash models were out of free-tier quota.

| Run | Trace | Result |
|---|---|---|
| 1010-7d05cb | `6f93a257acc67b3e7df1a245d10673e8` | done, 5/5 planted errors caught, 5/5 peers kept |
| 1010-4c9a03 | `b16cc16a4424fc85ad5478646523ad6e` | done, **4/5**: the mis-categorised invoice finding was wrongly overturned |
| 1010-21b4e0 | `682db8d165a0c041fc26ab495438e142` | **crashed in execute** at step 11 with 37 tasks queued |

## Bug A: a JSON re-ask quietly switched to a weaker model
- **Symptom:** in run 1010-4c9a03, the audit verdict on "Tensorforge GPU billed to [marketing, ml_ai]" was an *overturn* attributed to `gemini-3.5-flash-lite`. The audit is meant to use the `reason` models.
- **Root cause:** Gemma returned malformed JSON for the verdict, which correctly triggered the JSON re-ask (recovery path 5; its first natural occurrence). But `llm.complete` hard-coded the re-ask to the `extract` role, so the cheapest model re-made the decision.
- **Fix:** the re-ask stays on the same role and honours the same `exclude`. Test: `test_json_reask_stays_on_the_same_role`.

## Bug B: the planner's paths crashed the run
- **Symptom:** in run 1010-21b4e0, every file task failed with `data/acme/data/acme/...: No such file`, and the run then died.
- **Root causes:**
  - Gemma's plan included the input folder in each path, which nothing normalised.
  - `read_pdf(mode="llm")` called `read_bytes()` with no error handling, and the execute loop only caught known error types, so one `FileNotFoundError` ended the process.
- **Fix:** planner paths are normalised (`_normalise_path`), LLM-mode file errors become `ToolError`, and any unexpected exception inside a task is recorded as a tool error and goes through recovery instead of crashing.

- **After:** scorecard `evidence/evals/20261010T180156-6edff38-after-cs03-n3.json`, commit `6edff38`. Runs 1010-bbc370 (`f2c2d7221ee763829581aec9aaeffd1b`), 1010-5a3921 (`20f905ed5d9cb2614953d04a7b1e5ef8`), 1010-ef57b1 (`c39723ed4937eaccf37b3562de567024`).
- **Numbers (n = 3 per side; all runs fallback-heavy, so by our rule indicative, not clean):**

| Metric | Before (`fd9a4ef`) | After (`6edff38`) |
|---|---|---|
| Runs that crashed | 1 of 3 | 0 of 3 |
| Planted errors caught per run | 5, 4, 0 (mean 3.0) | 4, 4, 3 (mean 3.67) |
| Unsupported numbers in report | 0, 0, 0 | 0, 0, 0 |

- **What the after runs exposed (not fixed by this change):**
  - **The mis-categorised invoice was overturned in all 3 runs.** The audit verdicts came from fallback models (`nemotron-3-super:free` twice, `gemma-4-31b-it` once). Their reasoning, e.g. "two separate invoices, each assigned to a single appropriate cost centre", accepts GPU training hours billed to Marketing. On Gemini Flash (runs 1010-b31657, 1010-7bf26d) the same finding was confirmed with the corrected category `ml_ai`. **Audit quality depends on the model**, and the fallback models are weaker auditors here.
  - **Run 1010-ef57b1 skipped the scanned invoice.** Every reasoning model was unavailable for that decision, so the rule default `skip` was used, but for "no text layer" the right default is `reparse_alt`.
  - Both are addressed in the next commit.
