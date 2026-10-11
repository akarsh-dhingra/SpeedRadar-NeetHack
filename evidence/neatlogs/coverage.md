# neatlogs feature coverage

What we use, where it is in the code, and what we deliberately left out and why. Checked on 2026-10-11 against https://docs.neatlogs.com/llms.txt and the installed SDK (`neatlogs` Python package).

## SDK

| Feature | Used | Where |
|---|---|---|
| `init(api_key, workflow_name, instrumentations, tags, mask)` | yes | `spendradar/tracing.py` `_init`. Instrumentations are `google_genai` and `openai`. If the key is missing or init fails, the agent runs untraced instead of crashing |
| Auto-instrumented LLM spans (tokens, cost, model) | yes | every Gemini and OpenAI call. neatlogs computes cost for gpt-5-nano: trace `b960a985…` shows `total_cost` $0.0116 for its 11 ingested LLM calls |
| Custom spans `@neatlogs.span(kind="TOOL")` | yes | all 6 tools (`tools/files.py`, `crustdata.py`, `classify.py`). `tracing.tool_errors` puts a tool's exception into the span's Output |
| `neatlogs.trace()` with kinds WORKFLOW / AGENT / CHAIN / GUARDRAIL / TOOL | yes | `spendradar_run`, `plan`, `decide:recovery`, `verify:*`, `audit:*`, `fallback:<model>`, `http:crustdata/*`, `fault:injected:*`, `report`, `eval:*` |
| Span input/output (`input.value` / `output.value`) | yes | `tracing.set_io`: root run, recovery, verify, audit, fallback, Crustdata HTTP, eval spans. Values over 10k chars stay valid JSON (`truncated`) |
| ERROR status on caught failures | yes | `tracing.record_error`: empty budget, bad policy rule, unavailable second opinion, out-of-folder planner path. Failed evals and missed planted errors |
| **Prompt templates + versions** (`system_prompt_template`, `user_prompt_template`, `version`) | yes | `spendradar/prompts.py`: 6 named prompts (`plan`, `decide_recovery`, `audit_judge`, `line_items_vs_cost_centre`, `classify_titles`, `read_pdf_llm`), all `v1`. The nested LLM span carries the template, its variables and the version. Rendered text is byte-identical to the old f-strings at all 7 call sites |
| Sessions (`session_id`) | yes | session = run id, so a resumed run (crash → `resume`) joins its first trace. Eval traces use `eval-<timestamp>` |
| **End-user identity** (`end_user_id`, `end_user_metadata`) | yes | root `spendradar_run`: `customer:<dataset>` (acme, kestrel, …, all fictional) plus data mode. This is the per-customer unit the cfo.ai plan prices |
| **`neatlogs.log()` timeline steps** | yes | run start/finish, every task outcome (verified / failure, attempt, queue left), retry-cap hits |
| Tags (process-wide) | yes | `sha:`, `run:`, `variant:`, `evidence`, `fixture`, `inject:<fault>`, `eval` |
| `mask` (client-side redaction) | yes | `tracing.mask_secrets`: key-name blanking, key regexes, every `.env` secret value; unit-tested |
| `flush` / `shutdown` | yes | per process. Failures are warned, never masking the run's result |
| `identify()` context manager | equivalent | we pass `end_user_id` directly to the root `trace()` (same fields, per the SDK source) |
| Server-side PII redaction (`pii_enabled`) | no | project-wide setting; we only send fictional and public data and mask client-side (brief §6.1) |
| Distributed tracing (`inject/extract_trace_context`), `wrap`, OTLP, browser SDK | no | one process per run, no service hops; instrumentations already cover the LLM clients |
| Managed prompts (`create_prompt`/`get_prompt`/`save_as_version`) | not yet | templates are versioned in code and in traces. Fetching prompts at runtime would add a network dependency to every run; candidate for later |

## Platform (dashboard / MCP)

| Feature | Used | Evidence |
|---|---|---|
| Traces, span tree, cost/token columns | yes | `evidence/traces.md` |
| **Detections** (regex), detection groups | yes | 7 detections in group "Spend Radar": eval FAIL, planted error missed, LLM 400, competitor substitution, non-default recovery, fallback hop, self-audit overturn. `evidence/neatlogs/evals-and-detections.md` |
| **Fixes / auto-triage** | yes | fix 2cd5e9df (corrupt PDF sent to the LLM): investigated over the MCP, fixed in 8d11308, set in_progress then resolved with trace proof |
| **MCP server** | yes | connected at local scope. Used for `get_trace_context`, `search_traces`, `triage_*`, `create_detection(_group)`, `preview_detection` |
| **Evals** | yes, two layers | (1) ground-truth scorecards published as `spendradar_eval` traces (`eval:run` PASS/FAIL, `eval:planted_error`). (2) a native neatlogs Eval on `decide:recovery` spans, set up in the dashboard by Akarsh |
| Span votes (thumbs up/down) | manual | dashboard-only (no SDK/API without a service token) |
| Comments, Investigate (Neat AI), Analytics, Alerts, Session Replay | dashboard | available on our traces; no code needed |
| Experiments / Playground | no | needs a provider key stored in neatlogs; replaying prompts there spends that key. Our before/after comparisons run through `spendradar eval` instead |
| Datasets / classifier training | no | public workflow disabled and needs a paid budget (zero-spend rule) |
| Public API / CLI (`neatlogs feedback`, `evals`) | no | needs a service-account `NEATLOGS_TOKEN`, which we don't have; the project API key is ingest-only |
| Public trace links | no | not documented; evidence uses trace IDs and screenshots |
