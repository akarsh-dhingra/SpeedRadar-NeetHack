# 01 — Planner/recovery calls took two minutes each

- **Symptom (what the trace showed):** run `1010-6f37e8`, neatlogs trace `6f2d2dd7d3cc60d33157d5ac4f16746a`, commit `d96e16f`. The `plan` and `decide:recovery` spans on `gemini-3.8-flash` took **604.7 s across 5 calls (120.9 s per call on average)**. After 16 of roughly 40 tasks, the run was on course to take most of an hour, so I killed it. Saved state: `data/01-before-1010-6f37e8-state.json`.
  - My commit message for 11a5108 says "143 s each". That came from a snapshot one call earlier (4 calls, 573.6 s). The figures above come from the final saved state.
- **Root cause:** Gemini calls had **no client-side timeout**. A few minutes later, calling the same models directly took 4–10 s, but the first call to 4 of the 5 Flash models returned `503 UNAVAILABLE … high demand`. Under free-tier load, a call could hang for minutes, and our fallback chain only reacts to errors, never to slowness.
  - What I ruled out: the google-genai SDK does not retry by default (`retry_args(None)` → `stop_after_attempt(1)`).
- **Fix:** commit `11a5108`. Each Gemini call now has a 40 s timeout (`HttpOptions(timeout=…)`), and a timeout moves the call to the next model in the role's chain.
- **After:** evidence run `1010-7bf26d` (LLM cache off), neatlogs trace `288f07d84bb84e15754a241eef40d779`, commit `22f00b0`. Scorecard: `evidence/evals/20261010T141541-22f00b0-after-fix-02.json`.
- **Numbers (n = 1 per side, NOT the same provider mix):**
  - Mean reasoning-call latency: **120.9 s** (5 calls, all `gemini-3.8-flash`) → **6.5 s** (16 calls: `gemini-2.5-flash` 10 calls 81.6 s + `gemini-3.6-flash` 6 calls 22.9 s).
  - Run outcome: killed unfinished after 16 tasks → completed all phases (plan, execute, audit, report).
- **Caveats, stated plainly:**
  - n = 1 per side, and the before run is a partial run that I killed. Re-running the old code 3 times would cost about an hour of free-tier quota each.
  - The provider mix differs. By the after run, `gemini-3.8-flash` had hit its free-tier daily limit (429 PerDay after 15 requests), so reasoning ran on 3.6/2.5-flash. Part of the latency drop may come from the model, not only from the timeout.
  - The after run had 2 fallback hops. Our rule excludes fallback runs from clean comparisons, so this result is indicative. A same-mix n = 3 comparison is planned after the quota reset.
