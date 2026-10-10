# 01 — Planner/recovery calls took two minutes each

- **Symptom (what the trace showed):** run `1010-6f37e8`, neatlogs trace `6f2d2dd7d3cc60d33157d5ac4f16746a`, commit `d96e16f`. The `plan` and `decide:recovery` spans on `gemini-3.8-flash` took **604.7 s across 5 calls (120.9 s per call on average)**. After 16 of roughly 40 tasks, the run was on course to take most of an hour, so I killed it. Saved state: `data/01-before-1010-6f37e8-state.json`.
  - My commit message for 11a5108 says "143 s each". That came from a snapshot one call earlier (4 calls, 573.6 s). The figures above come from the final saved state.
- **Root cause:** Gemini calls had **no client-side timeout**. A few minutes later, calling the same models directly took 4–10 s, but the first call to 4 of the 5 Flash models returned `503 UNAVAILABLE … high demand`. Under free-tier load, a call could hang for minutes, and our fallback chain only reacts to errors, never to slowness.
  - What I ruled out: the google-genai SDK does not retry by default (`retry_args(None)` → `stop_after_attempt(1)`).
- **Fix:** commit `11a5108`. Each Gemini call now has a 40 s timeout (`HttpOptions(timeout=…)`), and a timeout moves the call to the next model in the role's chain.
- **After:** {{run id / trace id of the evidence runs}}
- **Numbers (n = 1 before, a partial run that I killed; after n = {{n}}, same provider mix):**
  - Mean reasoning-call latency: 120.9 s → {{after}}
  - Wall-clock time per run: unfinished at 16 tasks → {{after}}
  - The before side is a single partial run. Re-running the old code 3 times would cost about an hour of free-tier quota per run, so I chose not to. This is stated plainly, not rounded up.
