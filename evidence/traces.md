# neatlogs traces

One line per important trace: date (IST) · trace id · what it shows. Dashboard: https://app.neatlogs.com (the trace id is searchable there).

- 2026-10-10 13:38 · `4f62da47ebec7e3189b9481d72ad8bde` · first traced run: WORKFLOW `probe_run` → TOOL `act:echo` → auto-instrumented Gemini call (`gemini-3.5-flash-lite`), secret mask active (`spikes/neatlogs_probe.py`)
- 2026-10-10 13:40 · `3a3a392154ddcf7195bbdaeffe4b5b04` · `llm.complete` with schema (Flash-Lite → `ml_ai`), `llm.choose` native function calling picks `reparse_alt`, injected `llm:429` → `fallback:gemini-3.6-flash` span (`spikes/llm_probe.py`)
- 2026-10-10 13:51 · `6f2d2dd7d3cc60d33157d5ac4f16746a` · run 1010-6f37e8 (killed): planner/recovery spans averaged 120.9 s/call → case study 01 "before"
- 2026-10-10 14:08 · `af0df27e2d3433e0c608fb28a018a22d` · run 1010-b31657: first complete run. 5/5 planted errors caught; `audit:f_ml_ai` overturned (Gemini) + OpenRouter second opinion; `decide:recovery` → `substitute_competitor` ×3 (case study 02 "before"); `recover:json_reask` / `fallback:gemini-3.6-flash` spans
- 2026-10-10 14:15 · `288f07d84bb84e15754a241eef40d779` · run 1010-7bf26d (evidence, LLM cache off): after both fixes; 5/5 peers kept, 6.5 s mean reasoning latency, corrupt PDF → `reparse_alt` → `skip`
- 2026-10-10 14:25 · `36362eb966cdbb85dcb2fb1b280e1034` · run 1010-9e86fc (FIXTURE, dev, LLM cache on): Sentry marketing ×5 fixture → `verify:agreement` failed (19 vs 95) → `audit:f_marketing` downgraded, 6/6 planted caught. Found: the "second opinion" used the same model as the primary verdict (nemotron), so it was not independent (fixed)
- 2026-10-10 17:10 · `6f93a257acc67b3e7df1a245d10673e8`, `b16cc16a4424fc85ad5478646523ad6e`, `682db8d165a0c041fc26ab495438e142` · evidence runs 1010-7d05cb / 4c9a03 / 21b4e0 on fallback models: natural JSON re-ask, re-ask model downgrade (bug), planner path crash (bug) → case study 03
- 2026-10-10 18:37 · `5c512d38b1cc95f99d0682619343c0b0`, `d4a8716f6d2ed79322ca0d252764837e`, `0dcf22977776591d6c8e47e0dffeed33` · gpt-5-nano evidence batch (1010-767322 / bf52d4 / 4d1835): 5/5 planted errors each, 0 fallback hops, mis-categorised invoice confirmed with corrected category
- 2026-10-10 18:43 · `eb46da9f5383934b351975949f9584ba` · FIXTURE run 1010-824ed7 on gpt-5-nano: 6/6; `audit:f_marketing` downgrade by gpt-5-nano, independent second opinion by gemini-3.5-flash-lite says confirm → kept as downgrade
- `953bb991e2547b1591bb2bb6adb555b8`: evidence run 1010-7309e6 after commit 8d11308. Corrupt invoice 13: read_pdf mode=llm fails in 0.8 ms with no LLM span. This closed neatlogs auto-triage fix 2cd5e9df (before: `36362eb966cdbb85dcb2fb1b280e1034`, where the LLM fallback got a Gemini 400).
