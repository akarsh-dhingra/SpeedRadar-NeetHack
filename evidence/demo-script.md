# Demo video script (target 2:45, hard cap 3:00)

Covers all three tools (neatlogs, Entire, cfo.ai) as CLAUDE.md §13 requires. Captions on. Every number below is copied from the file in [brackets]; the brackets are for us, not for the voice-over. Record at 1440×900 or larger, dark theme, browser zoom 100%.

**Before recording**
- Open the live site: https://akarsh-dhingra.github.io/SpeedRadar-NeetHack/ . Leave Motion on.
- Second tab: the neatlogs dashboard, trace `af0df27e2d3433e0c608fb28a018a22d` open on its `decide:recovery` spans.
- Third tab: cfo.ai, the Spend Radar plan's Summary page.
- Fourth tab: Entire trail #2, https://entire.io/gh/akarsh-dhingra/SpeedRadar-NeetHack/trails/2 , scrolled to the runner finding.
- Terminal in the repo, font large, with `python -m spendradar explain f8b07091ded7e21b530712e83b174931` ready to paste (output: `evidence/explain/f8b07091ded7-errors.md`).
- Reload the site right before you hit record so the radar intro plays.

---

## 0:00–0:15 · Hook (site intro → Overview)
**On screen:** reload the site. The radar sweeps; seven companies blip in. The overview assembles: headline, ✓ matrix.
**VO:** "Seven companies. On the latest run of each, this agent caught every error we planted in their books. Six of them were never used to build it."
[evidence/frontend_data.json `summary`: companies 7, held_out_companies 6, latest_runs_all_caught 7, latest_runs_false_alarms 0]

## 0:15–0:35 · The problem and the loop
**On screen:** scroll to "How one run works". Let the pulse run along the seven steps.
**VO:** "Finance teams budget against their own ledger, not the market. Spend Radar reads a company's budget and invoices, pulls real competitor headcount from Crustdata, and reports where competitors out-invest it in people. The LLM plans, picks recoveries and audits. Python runs every tool and does all the maths."

## 0:35–0:55 · It disproves itself
**On screen:** scroll to "It argues with itself". Click **Replay**. Let the four steps deal in and the 6.7% get struck.
**VO:** "Here it claimed Acme's ML team breaks policy, a gap of up to five point two eight million dollars a year. Before reporting, it tried to disprove that. The competitor signals disagreed, its own confidence was zero, and the auditor overturned it. That claim never reached the report."
[run 1011-777bb7, finding f_ml_ai: statement "$5,280,000", confidence 0.0, status overturned]

## 0:55–1:30 · neatlogs: how we found and fixed bugs
**On screen:** switch to the neatlogs tab: the `decide:recovery` spans of run 1010-b31657 (`fetch_more_signal` → `substitute_competitor`). Then back to the site: **Before / after**, card "One weak signal threw away 3 of 5 peers".
**VO:** "Every LLM call, tool call and recovery is traced in neatlogs. This trace showed the agent throwing away three of its five competitors and replacing them with companies up to thirty-two times bigger. After the fix it kept all five, and Crustdata credits fell from twenty-six point six to five point four. Another trace showed model calls taking a hundred and twenty-one seconds each. A timeout brought that to six and a half."
[evidence/case-studies/02-competitor-substitution.md: peers kept 2 → 5, credits 26.6 → 5.4, "31.8×" Datadog; 01-unbounded-llm-latency.md: 120.9 s → 6.5 s]

## 1:30–1:50 · Recovery, live
**On screen:** **Recovery log**: the three injected-fault cards. Click the Bastion card; Run detail opens and the replay plays: a failed check shakes, the recovery menu appears, the chosen option stamps in.
**VO:** "We also broke it on purpose: forced rate limits from Crustdata and the LLM. Three runs, every planted error still caught. When a check fails, the model picks a recovery from a fixed menu. In a hundred and sixty-one of two hundred and eighty-nine decisions it chose something other than the default rule."
[summary: injected_runs 3, all planted caught; recovery_overrides 161, recovery_decisions 289]

## 1:50–2:10 · Entire
**On screen:** site **Entire** page (stats, the closed-loop callout, the three trails). Cut to trail #2 on entire.io, scrolled to the runner finding. Then the terminal: run `spendradar explain` on the corrupt-PDF trace and scroll the dossier to "Prompt".
**VO:** "Entire ties every run to the code behind it. Each run records its commit and Entire checkpoint. Every change since Sunday went through a trail, reviewed by six runners tailored to this repo, and they caught two real issues before merge: here, a fix that silently skipped news evidence. And this command follows a neatlogs error back through the code line to the checkpoint and the prompt that wrote it. For the corrupt-PDF bug, that prompt is neatlogs' own triage report."
[evidence/frontend_data.json `entire`: checkpoints 69, trails 3, 2 findings resolved; evidence/explain/f8b07091ded7-errors.md: files.py:139 → checkpoint 01M4K4TJNC7JY16812XTZKSBKA]

## 2:10–2:35 · cfo.ai
**On screen:** site **cfo.ai business plan** page (callout, then the tiers table). Cut to the cfo.ai Summary page.
**VO:** "Cfo dot A I built the business plan from measured costs. The model costs under three cents a run. Competitor data costs six to nine dollars, about ninety-nine percent of the cost. So caching decides the margin: capping fresh data at ten runs a month lifts the Team tier to seventy-six point six percent. Base case: cash-flow positive in month fifteen."
[business/cfoai_plan.md: $0.0285 per run, $6.24–$9.24, ~99%, 76.6%, Jan 2028 (month 15)]

## 2:35–2:50 · Close
**On screen:** **neatlogs** page (detections, evals, the auto-triage fix) scrolling, then the repo on GitHub.
**VO:** "Sixty-one scored runs, each with its trace, its commit and its checkpoint. Spend Radar, by team qwep. Hashtag neatHack."
[summary: runs_scored 61]

---

Spoken word count: 410, roughly 2.7 min at 150 words a minute. If it runs long, cut the latency sentence in 0:55–1:30 first, then the code-graph sentence in Entire.

**Do not say:** "AI-powered", "magic", any number not in brackets above. If a number changes after a new export, update it here from `evidence/frontend_data.json` before recording.
