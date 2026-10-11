# Entire evidence

Entire is enabled for Claude Code in this repo (`entire enable --agent claude-code`). Agent commits carry an `Entire-Checkpoint:` trailer that links the change to the prompt, transcript and tool calls behind it, and checkpoint refs are pushed to origin with each `git push` (40 on GitHub on 11 Oct).

**Gap, stated plainly:** most commits made from the second laptop on 10–11 Oct (author RedtRocks) have no trailer. That Claude Code session was opened on the parent folder, so the repo's Entire hooks never loaded. It was captured afterwards with `entire session attach` (checkpoint `01M4KERS89ZG64HPC8G9CP34VG`, linked to `e867e62`); Entire cannot re-attach a session, and adding trailers later would mean rewriting pushed commits, which we don't do. Commits made after `commit_linking: always` was set (e.g. `34d83f8`) are linked again.

| File | What it shows |
|---|---|
| `checkpoint-list.txt` | checkpoints on `main`, one per agent commit (10 Oct) |
| `checkpoint-list-2026-10-11.txt` | all 38 commit-linked checkpoints after fetching every checkpoint ref from GitHub, both team members |
| `checkpoint-explain-11a5108-latency-fix.txt` | header of the checkpoint for the latency fix (case study 01) |
| `graph-search-recovery.txt` | `entire graph search` resolves "where does the agent choose a recovery action" to `decide_recovery` (rank 1) |
| `graph-impact-decide_recovery.txt` | callers, callees and type consumers of `decide_recovery` (used before changing the recovery menu) |
| `graph-stats.txt` | session graph usage. It honestly shows a 0% graph-first rate early in the build, while most work was writing new files |
