# Front-end data format

The front end reads one file: `evidence/frontend_data.json`. Regenerate it after any eval with:

```bash
uv run python -m spendradar export
```

Every value is copied from a scorecard (`evidence/evals/*.json`), a run's state (`runs/<id>/state.json`, local only) or a ground-truth file. The front end should display these values, not recompute them. All company finance data is fictional; competitors are real companies with data from Crustdata.

## Top level

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | int | Bumped when a field changes meaning. Currently `1`. |
| `generated_at` | ISO datetime | When the export ran. |
| `companies` | Company[] | Acme first (the development set), then held-out companies A–Z. |
| `business` | object | Paths to the cfo.ai plan (`plan`), unit costs (`unit_costs`) and the cfo.ai exports folder (`cfoai_exports`). |

## Company

| Field | Type | Meaning |
|---|---|---|
| `key` | string | Folder name under `data/`, e.g. `ledgerly`. |
| `name` | string | e.g. `Ledgerly Payments Inc.` |
| `industry` | string | e.g. `fintech (spend management)` |
| `role` | `"development"` \| `"held_out"` | Acme is the company the agent was built against. Held-out companies were never used to tune it. |
| `fictional` | bool | Always `true`; show a "fictional data" label. |
| `competitors` | {name, domain}[] | Real peers the agent compares against. |
| `negative_controls` | string[] | Planted items the agent must NOT flag (e.g. a 0.4% rounding difference). A flag on one counts as a false alarm. |
| `runs` | Run[] | Oldest first. The last one is the current state. |

## Run

| Field | Type | Meaning |
|---|---|---|
| `run_id` | string | e.g. `1010-d514dc` |
| `variant` | string | Label for what was being tested, e.g. `baseline-kestrel`, `after-heldout-fixes-kestrel`. Use it to pair before/after. |
| `scored_at` | ISO datetime | When the scorecard was written. |
| `git_sha` | string | Commit the run used. A `-dirty` suffix means uncommitted changes were present. |
| `neatlogs_trace_id` | string | Searchable in the neatlogs dashboard (app.neatlogs.com). |
| `scorecard` | path | The JSON this run was copied from. |
| `data_mode` | `"real"` \| `"fixture"` | `fixture` = altered competitor data, eval only. Must be shown prominently. |
| `injected_faults` | string[] | Faults deliberately injected (e.g. `crustdata:429`); empty for normal runs. |
| `metrics` | object | See below. |
| `planted` | {id, label, caught}[] | Each planted error and whether this run caught it. Good for a ✓/✗ grid. |
| `false_alarm_detail` | string[] | What the agent flagged that the ground truth says is fine. |
| `report` | {markdown, html, available_locally} | Paths to the run's full report. `runs/` is not committed, so `available_locally` is false on other machines. |
| `findings` | Finding[] | Empty unless the run's state is available locally. |
| `recovery` | Recovery[] | Each recovery decision; empty unless state is local. |

### `metrics`

`planted_caught`, `planted_total`, `false_alarms` (null on older scorecards that predate the count), `unsupported_numbers_in_report` (target 0), `findings_overturned`, `findings_downgraded`, `recovery_decisions`, `recovery_non_default` (the LLM chose something other than the fixed rule's default), `llm_calls`, `llm_tokens_in`, `llm_tokens_out`, `llm_latency_s`, `fallback_hops` (runs with >0 are excluded from clean before/after comparisons), `crustdata_credits` (0 when served from cache), `models`.

### Finding

`id`, `category` (engineering, ml_ai, sales, marketing, infra_cloud, internal), `kind` (`policy` = vs competitors, `internal` = own books, `gap`), `status` (`confirmed`, `downgraded`, `overturned` — overturned findings are not in the report and belong in an "agent disproved itself" view), `confidence` (0–1, computed; formula in `spendradar/verify.py`), `statement`, `policy_violated`, `audit_notes` (the self-audit's reasoning, including second opinions).

### Recovery

`task_id`, `chosen`, `rule_default`, `reason`. Highlight rows where `chosen != rule_default`: those are the LLM's own decisions.

## Suggested views (for the design, not prescriptive)

1. **Generalisation table**: one row per company, first vs latest run (`planted_caught/planted_total`, `false_alarms`).
2. **Run detail**: metrics tiles, the planted ✓/✗ grid, findings grouped by status, the recovery list, trace id.
3. **Overturned claims**: findings with `status = overturned` or `downgraded`, with `audit_notes`.
4. **Business**: link to `business/cfoai_plan.md`; the numbers there are from cfo.ai and are not in this file.
