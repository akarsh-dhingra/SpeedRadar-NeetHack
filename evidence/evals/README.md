# Eval scorecards

`python -m spendradar eval` scores runs against `evals/ground_truth.json`, which the agent never reads. Each scorecard JSON includes every run's neatlogs trace id. All numbers below are copied from the scorecard files.

| Scorecard | Commit | Variant | n | Planted caught | Unsupported numbers | Peers kept | Overturned / downgraded | Recovery (non-default) | Crustdata credits | Fallback hops |
|---|---|---|---|---|---|---|---|---|---|---|
| `20261010T141541-11a5108-before-fix.json` | 11a5108 | before-fix | 1 | 5/5 | 0 | 2/5 | 1 / 0 | 13 (10) | 26.6 | 4 |
| `20261010T141541-22f00b0-after-fix-02.json` | 22f00b0 | after-fix-02 (evidence) | 1 | 5/5 | 0 | 5/5 | 0 / 1 | 10 (7) | 5.4 | 2 |

Both runs used fallback and different provider mixes, so per our rule they are indicative, not clean comparisons. Same-mix n = 3 runs are planned after the free-tier quota reset. See `../case-studies/`.
