# Resume after crash (step 12)

1. `python -m spendradar run data/acme --variant resume-demo --crash-after-step 15` saved state after step 15, then called `os._exit(137)`, a simulated `kill -9` right after an atomic state write. The process exited with code 137, leaving the run in phase `execute` with 13 tasks done and 20 queued.
2. `python -m spendradar resume 1010-bdda52` loaded `runs/1010-bdda52/state.json`, continued from the queue head, and finished every phase: execute → audit → report, done at step 47 with 41 tasks done. The report's notes record "resumed at phase 'execute', step 15".

- First process: neatlogs trace `522dfe5f0903595439c960a5e3b081c6`.
- Resumed process: same neatlogs **session** `1010-bdda52` (`session_id = run_id`). Its trace id was not stored, because state kept only the first id. Fixed afterwards: state now keeps `trace_ids`, one per process.
- The LLM cache was on, so this is a dev run, not an evidence run.
