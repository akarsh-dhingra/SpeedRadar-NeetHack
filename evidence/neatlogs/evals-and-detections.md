# Evals and detections in neatlogs

Our ground-truth scoring stays in Python (`spendradar/evals.py`), because only we know which errors were planted. Since 2026-10-11, `python -m spendradar eval` also **publishes every scorecard to neatlogs**, and a group of detections watches those results and the agent's own spans.

## 1. Eval traces (`spendradar_eval` workflow)

`spendradar/neatlogs_evals.py` emits one trace per scorecard:

| Span | Input | Output | Status |
|---|---|---|---|
| `spendradar_eval` (WORKFLOW) | variant, scorecard path, git sha, n runs | passed `k/n`, summary | ERROR if any run failed |
| `eval:run` (GUARDRAIL), one per run | run id, **the run's own trace id**, dataset, data mode, ground-truth file | **verdict PASS/FAIL**, why, planted caught, false alarms, unsupported numbers, overturned, downgraded, non-default recoveries, fallback hops, LLM calls, provider mix, Crustdata credits | ERROR on FAIL |
| `eval:planted_error` (GUARDRAIL), one per planted error | run id, planted error id | caught true/false | ERROR if missed |

PASS means: every planted error caught, 0 unsupported numbers, 0 false alarms, and the run finished. The rule is `verdict()` in `neatlogs_evals.py`, unit-tested in `tests/test_agent_rules.py`.

| Eval trace | What | Scorecard |
|---|---|---|
| `f15f0cd35832043d1bddb67b34cd8ba7` | fresh evidence run 1011-b7b09d (run trace `b960a9851f7b4f9d406dcf88b4fe6e54`): **PASS**, 5/5 planted, 0 unsupported, 5 non-default recoveries. Ingested and checked over the neatlogs MCP | `evidence/evals/20261011T103627-be17d42-neatlogs-evals.json` |
| `5f65daeaad3fe74ad5a47917df5b0137` | re-score of the 6 gpt-5-nano evidence runs | `evidence/evals/20261011T102258-bb61e37-gpt5nano-evidence-rescore.json` |
| `edb79383802e8ec64ad3e3c4d39a4296` | re-score of fixture run 1010-824ed7 (6/6) | `evidence/evals/20261011T102307-bb61e37-fixture-rescore.json` |
| `62f49bd316c891feabb88daba872b0a1` | all 20 local Acme runs, including the killed early runs | `evidence/evals/20261011T102319-d1ff728-history-all-acme-runs.json` |
| `7bd86a1de6d857afcecbdd24daa9325c` | the 4 runs before the case-study-03 fix, each **FAIL** (missed `invoice_miscategorised`) | `evidence/evals/20261011T104734-d1ff728-before-fix-misses.json` |

The last four were sent while neatlogs ingestion was stalled (`neatlogs doctor --probe`: `TRACE_READBACK_TIMEOUT`, "processing at raw_durable"). Their status is in §3.

## 2. Detections (group "Spend Radar")

These were created over the neatlogs MCP (`create_detection`). Regex detections match the **humanized** span text that neatlogs builds from JSON output (`{"differs_from_default": true}` becomes `Differs From Default: true`). I learned this from `preview_detection`; my first group ("Spend Radar evals") used raw-JSON patterns that could never match.

| Detection | Runs on | Pattern | Why |
|---|---|---|---|
| Eval: run FAILED | span `eval:run` | `verdict:\s*fail` | regression alarm for the eval |
| Eval: planted error missed | span `eval:planted_error` | `caught:\s*false` | which planted error regressed |
| LLM rejected input (400 INVALID_ARGUMENT) | LLM spans | `INVALID_ARGUMENT\|status.?code.?400` | the corrupt-PDF bug (neatlogs fix 2cd5e9df). Preview matched **16** historical spans |
| Recovery substituted a competitor | span `decide:recovery` | `chosen:\s*substitute_competitor` | case study 02 regression guard |
| Recovery chose a non-default action | span `decide:recovery` | `differs from default:\s*true` | shows the LLM's recovery choice differing from the rule default (brief §4.1) |
| Model fallback hop | CHAIN spans | `fallback to:` | runs to exclude from clean comparisons (brief §7) |
| Self-audit overturned a claim | AGENT spans | `status:\s*overturned` | the self-audit disproving its own finding |

`preview_detection` checks on ingested data (2-day window): non-default recovery 1 match (run 1011-b7b09d, `fetch_more_signal`), eval verdict PASS 1 match, planted caught 5 matches, LLM 400 16 matches.

To make detections possible, `decide:recovery`, `verify:*`, `audit:*` and `fallback:*` spans now set OpenInference `input.value`/`output.value` (`tracing.set_io`). Before this, neatlogs showed them with empty Input/Output panes.

## 3. Status log
- 2026-10-11 10:40 IST: `f15f0cd3…` and run trace `b960a985…` ingested. `5f65daea…` and `62f49bd3…` return HTTP 409, and `edb79383…` and `7bd86a1d…` return not found. The doctor probe fails, so ingestion is stalled server-side.
- 2026-10-11 13:29 IST: FAIL eval trace `7bd86a1de6d857afcecbdd24daa9325c` ingested: 4 `eval:run` spans with status ERROR, trace status error. `preview_detection` with the "Eval: run FAILED" pattern matched **4** spans, and with "Eval: planted error missed" **5** spans (4 × invoice_miscategorised, 1 × invoice_scanned). That matches scorecard `20261011T104734-d1ff728-before-fix-misses.json` exactly. The trace's own `detections` list was still empty when I checked, because detection backfill is asynchronous. `get_detection_trend` returned an empty response.
