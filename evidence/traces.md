# neatlogs traces

One line per important trace: date (IST) · trace id · what it shows. Dashboard: https://app.neatlogs.com (the trace id is searchable there).

- 2026-10-10 13:38 · `4f62da47ebec7e3189b9481d72ad8bde` · first traced run: WORKFLOW `probe_run` → TOOL `act:echo` → auto-instrumented Gemini call (`gemini-3.5-flash-lite`), secret mask active (`spikes/neatlogs_probe.py`)
- 2026-10-10 13:40 · `3a3a392154ddcf7195bbdaeffe4b5b04` · `llm.complete` with schema (Flash-Lite → `ml_ai`), `llm.choose` native function calling picks `reparse_alt`, injected `llm:429` → `fallback:gemini-3.6-flash` span (`spikes/llm_probe.py`)
- 2026-10-10 13:51 · `6f2d2dd7d3cc60d33157d5ac4f16746a` · run 1010-6f37e8 (killed): planner/recovery spans averaged 120.9 s/call → case study 01 "before"
- 2026-10-10 14:08 · `af0df27e2d3433e0c608fb28a018a22d` · run 1010-b31657: first complete run. 5/5 planted errors caught; `audit:f_ml_ai` overturned (Gemini) + OpenRouter second opinion; `decide:recovery` → `substitute_competitor` ×3 (case study 02 "before"); `recover:json_reask` / `fallback:gemini-3.6-flash` spans
- 2026-10-10 14:15 · `288f07d84bb84e15754a241eef40d779` · run 1010-7bf26d (evidence, LLM cache off): after both fixes; 5/5 peers kept, 6.5 s mean reasoning latency, corrupt PDF → `reparse_alt` → `skip`
