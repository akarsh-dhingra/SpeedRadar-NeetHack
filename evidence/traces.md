# neatlogs traces

One line per important trace: date (IST) · trace id · what it shows. Dashboard: https://app.neatlogs.com (the trace id is searchable there).

- 2026-10-10 13:38 · `4f62da47ebec7e3189b9481d72ad8bde` · first traced run: WORKFLOW `probe_run` → TOOL `act:echo` → auto-instrumented Gemini call (`gemini-3.5-flash-lite`), secret mask active (`spikes/neatlogs_probe.py`)
- 2026-10-10 13:40 · `3a3a392154ddcf7195bbdaeffe4b5b04` · `llm.complete` with schema (Flash-Lite → `ml_ai`), `llm.choose` native function calling picks `reparse_alt`, injected `llm:429` → `fallback:gemini-3.6-flash` span (`spikes/llm_probe.py`)
