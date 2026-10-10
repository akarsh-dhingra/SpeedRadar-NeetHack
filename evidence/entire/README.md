# Entire evidence

Entire is enabled for Claude Code in this repo (`entire enable --agent claude-code`). Every agent commit carries an `Entire-Checkpoint:` trailer that links the change to the prompt, transcript and tool calls behind it, and checkpoint refs are pushed to origin with each `git push`.

| File | What it shows |
|---|---|
| `checkpoint-list.txt` | checkpoints on `main`, one per agent commit |
| `checkpoint-explain-11a5108-latency-fix.txt` | header of the checkpoint for the latency fix (case study 01) |
| `graph-search-recovery.txt` | `entire graph search` resolves "where does the agent choose a recovery action" to `decide_recovery` (rank 1) |
| `graph-impact-decide_recovery.txt` | callers, callees and type consumers of `decide_recovery` (used before changing the recovery menu) |
| `graph-stats.txt` | session graph usage. It honestly shows a 0% graph-first rate early in the build, while most work was writing new files |
