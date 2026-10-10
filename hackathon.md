# hackathon.md — Spend Radar (neatHack 2026)

## Project
Spend Radar: an agent that tells a finance team where competitors are outspending them on people, with a source behind every number, and tries to disprove its own findings before reporting them.

## Team
qwep — Akarsh Dhingra (solo)

## Stack
Python 3.12, plain agent loop, Pydantic · neatlogs (tracing) · Entire (checkpoints + entire-graph) · cfo.ai (business plan) · Crustdata (competitor data) · Gemini free tier + OpenRouter `:free` models (LLM)

## Build log

### 2026-10-10 (Sat)
- **13:23 IST — Step 1 started.** Planned: new public repo, `.gitignore`, `.env.example`, Entire re-enabled, Crustdata probe for 7 candidate competitors.
  - Done: repo initialised, Entire enabled for Claude Code (`entire enable --agent claude-code`), first commit.
  - Tests run: none yet (no code).
- **13:45 IST — Step 1 done.** Crustdata probe: 28 credits (14 wasted on a duplicate enrich; fixed). All 7 candidates have role-level headcount, timeseries, funding, news; Chronosphere lacks hiring data; no ML/AI role exists, so ML/AI uses title classification. Competitors: Honeycomb, Sentry, Arize, Chronosphere, Grafana Labs (see `spikes/FINDINGS.md`).
  - Tests run: probe script against live API (7 enrich, 7 job aggregations).

## Demo
_TBD_

## Limitations
_TBD_

## Submission
_TBD_
