# Entire evidence

Entire is enabled for Claude Code in this repo (`entire enable --agent claude-code`). Agent commits carry an `Entire-Checkpoint:` trailer that links the change to the prompt, transcript and tool calls behind it, and checkpoint refs are pushed to origin with each `git push` (40 on GitHub on 11 Oct).

**Gap, stated plainly:** 14 commits made from the second laptop between 10 Oct 23:15 and 11 Oct 10:22 IST (`e867e62` … `983b080`, author RedtRocks) have no trailer. That Claude Code session (`d332d8e0`) was opened on the parent folder `neathack/`, so the repo's `.claude/settings.json`, where Entire's hooks live, never loaded. Its whole transcript was captured afterwards with `entire session attach` as checkpoint `01M4KERS89ZG64HPC8G9CP34VG`. Because attach could not amend an already-pushed commit, that checkpoint was at first linked to no commit (`entire checkpoint explain` showed "commits (none on this branch)"). It is now linked by a new commit that carries its trailer (see `hackathon.md`, 11 Oct). We did not rewrite the 14 pushed commits: scorecards, run states and neatlogs `sha:` tags quote their hashes, and the commit dates are part of the evidence. From 11 Oct, all commits are made from the session opened on the repo folder.

One more checkpoint has a trailer but no ref, on purpose: `01M4JX7270SGA4WHPPEH245D60` (`6f7aa48`). Its transcript held a pasted API key, so the ref was deleted before any push (`hackathon.md`, 10 Oct 18:1x).

| File | What it shows |
|---|---|
| `checkpoint-list.txt` | checkpoints on `main`, one per agent commit (10 Oct) |
| `checkpoint-list-2026-10-11.txt` | all 38 commit-linked checkpoints after fetching every checkpoint ref from GitHub, both team members |
| `checkpoint-explain-11a5108-latency-fix.txt` | header of the checkpoint for the latency fix (case study 01) |
| `graph-search-recovery.txt` | `entire graph search` resolves "where does the agent choose a recovery action" to `decide_recovery` (rank 1) |
| `graph-impact-decide_recovery.txt` | callers, callees and type consumers of `decide_recovery` (used before changing the recovery menu) |
| `graph-stats.txt` | session graph usage. It honestly shows a 0% graph-first rate early in the build, while most work was writing new files |
