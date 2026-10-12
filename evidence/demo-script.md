# Demo video script

This is the narration of the submitted demo video, line by line, with the source of every number. The film is generated (branch `demo-video`) from `demo-video/script.json` (voice, timing and captions) and `demo-video/comp/comp.js` (the animation), and rendered in GitHub Actions (`.github/workflows/demo-film.yml`). Captions are burned in. Each number is taken from the file in the Source column.

Voice: Chatterbox (open source), timbre cloned from LibriSpeech dev-clean reader 1673 (CC BY 4.0). Pauses follow the script's punctuation.

Presenter: "Niziiro Mao", a Live2D Inc. sample model, animated from the narration (lip sync, poses). The model files are loaded from Live2D's own repository at render time and are not stored in this repo. Credit: This content uses sample data owned and copyrighted by Live2D Inc. The sample data are utilized in accordance with terms and conditions set by Live2D Inc. This content itself is created at the author's sole discretion.

The neatlogs segment shows screenshots of our own neatlogs project (Incidents and Traces views, taken 12 Oct; the sidebar is cropped out).


## Hook

| Caption (what is said) | Source |
|---|---|
| So… your competitor just doubled their ML team. | — |
| And you? You'll find out next quarter. | — |
| Unless your agent finds out first. | — |

## Meet Spend Radar

| Caption (what is said) | Source |
|---|---|
| This is Spend Radar. It reads your books, checks the market, then tries to prove itself wrong. | — |

## A real run, step by step (run 1011-777bb7)

| Caption (what is said) | Source |
|---|---|
| Let's watch it work, on a real run. | runs/1011-777bb7 (data mode: real) |
| The model writes a plan, and the agent works through it, one tool call at a time. | runs/1011-777bb7/state.json plan_rationale, done (41) |
| It reads the budget, the invoices and the policy, then pulls real competitor headcount from Crustdata. | state.json done; competitors (5) |
| Python checks every single result — 71 checks in all. And here's one that fails: a budget row that doesn't add up. | state.json checks (71); decisions[t01] 1.45% off |
| The rule says: just mark it low confidence. But the model decides to re-read that exact row instead. | decisions[t01]: default mark_low_confidence, chosen narrow_range |
| A scanned PDF gets read another way. A corrupt one gets flagged, and the run keeps going. | decisions t15 reparse_alt; t16/t16r reparse_alt, skip; not_analysed |
| In this run, 5 of its 10 recovery calls beat the default rule. | run 1011-777bb7 metrics recovery_non_default 5 / recovery_decisions 10 |

## Self-audit

| Caption (what is said) | Source |
|---|---|
| Now, here's our favourite part. | — |
| The agent flagged a gap of up to $5.28M in Acme's ML team. | run 1011-777bb7 finding f_ml_ai |
| Then it argued with itself — and overturned its own claim. | — |
| So that wrong number never reaches the report. | — |

## Held-out companies

| Caption (what is said) | Source |
|---|---|
| Seven companies. Six it had never seen. | summary.companies 7, held_out_companies 6 |
| Every planted error caught — with zero false alarms. | summary.latest_runs_all_caught 7, latest_runs_false_alarms 0 |

## neatlogs: the incident it raised, and bugs found in traces

| Caption (what is said) | Source |
|---|---|
| When it broke, neatlogs found the incidents for us. | neatlogs Traces view (screenshot 12 Oct): Execution Failed detections |
| It saw a spike in failed executions — over 100× normal — and raised an incident on its own. | neatlogs incident (screenshot 12 Oct): Detection spike 13 negative detections, baseline 0.1, 108.5x, group Execution Failed; Raised by Neatlogs |
| Its investigation found the root cause: a corrupt invoice, passed to Gemini anyway. | neatlogs incident Investigation v1 root cause: read_pdf falls back to mode llm on 13_brightloop_2026-10.pdf (PdfminerException); before trace 36362eb966cdbb85dcb2fb1b280e1034 (Gemini 400) |
| We sent it to Claude Code, shipped the fix, and the incident closed. Now that file fails in under 1 ms, with no model call. | incident: Sent to Claude Code, status Resolved; fix 8d11308 (triage 2cd5e9df); after trace 953bb991e2547b1591bb2bb6adb555b8: 0.8 ms, no LLM span (evidence/traces.md) |
| Traces caught more. Before one fix, the agent dropped 3 of its 5 competitors. After it, it kept all 5 — in 5 runs out of 5. | evidence/case-studies/02-competitor-substitution.md, rerun n = 5 per side |
| And on 24 real invoices, the reader copied the net amount, not the total. After the fix: zero silent wrong totals. | evidence/case-studies/06-real-invoices-gross-vs-net.md (12 tuned-on + 12 held-out, n = 3 passes: 2 and 4 per pass -> 0) |

## Entire: memory and review

| Caption (what is said) | Source |
|---|---|
| Entire gave our coding agent a memory: 90+ checkpoints, each linking a commit to its prompt. | evidence/frontend_data.json entire.checkpoints (91 on 12 Oct) |
| So any trace leads back to the code, the commit, and the prompt that wrote it. | evidence/explain/5fcef2f7f2f8-decide-recovery.md |
| 6 review trails: Entire's runners caught 4 real bugs — all 4 fixed. | evidence/frontend_data.json entire.trails: 6 trails, 4 findings, all resolved (a16758f, 62c6b69, bd079ca) |

## cfo.ai: the business plan

| Caption (what is said) | Source |
|---|---|
| Then cfo.ai turned our measured costs into a business plan. | — |
| The AI costs under 3¢ a run. Competitor data is about 99% of the cost. | cfo.ai Assumptions: LLM cost per run $0.0285; judge summary: Crustdata ~99% of COGS |
| Across 7 scenarios, the base case turns cash-flow positive in January 2028. Even with human review, it still does. | frontend_data.json business.cfoai_model: Base first positive 2028-01; Managed review 2028-01 (month 15) |

## Close

| Caption (what is said) | Source |
|---|---|
| Spend Radar. Every number has a source. | — |
| team qwep · #neatHack | — |

Spoken word count: 434. Hard cap 3:00.
