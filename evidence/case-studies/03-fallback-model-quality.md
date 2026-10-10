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

- **After:** {{evidence runs on the fixed commit}}
- **Numbers:** n = 3 before (all fallback-heavy, so by our rule not a clean comparison): planted errors caught 5, 4 and 0 (crashed) of 5. After: {{to fill}}.
