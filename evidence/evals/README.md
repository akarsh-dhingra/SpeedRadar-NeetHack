# Eval scorecards

`python -m spendradar eval` scores runs against `evals/ground_truth.json`, which the agent never reads. Each scorecard JSON includes every run's neatlogs trace id. All numbers below are copied from the scorecard files.

| Scorecard | Commit | Variant | n | Planted caught | Unsupported numbers | Peers kept | Overturned / downgraded | Recovery (non-default) | Crustdata credits | Fallback hops |
|---|---|---|---|---|---|---|---|---|---|---|
| `20261010T141541-11a5108-before-fix.json` | 11a5108 | before-fix | 1 | 5/5 | 0 | 2/5 | 1 / 0 | 13 (10) | 26.6 | 4 |
| `20261010T141541-22f00b0-after-fix-02.json` | 22f00b0 | after-fix-02 (evidence) | 1 | 5/5 | 0 | 5/5 | 0 / 1 | 10 (7) | 5.4 | 2 |

Both runs used fallback and different provider mixes, so per our rule they are indicative, not clean comparisons. Same-mix n = 3 runs are planned after the free-tier quota reset. See `../case-studies/`.


## Batches (one row per scorecard; per-run values listed)

| Scorecard | Commit | Variant | n | Planted caught per run | Unsupported numbers | Fallback hops |
|---|---|---|---|---|---|---|
| `20261010T171003-fd9a4ef-gemma-mix-n3.json` | fd9a4ef | gemma-mix (fallback-heavy) | 3 | 5, 4, 0 (of 5) | 0, 0, 0 | 5, 11, 6 |
| `20261010T180156-6edff38-after-cs03-n3.json` | 6edff38 | after-cs03 (fallback-heavy) | 3 | 4, 4, 3 (of 5) | 0, 0, 0 | 6, 10, 17 |
| `20261010T183713-bb61e37-gpt5nano-n3.json` | bb61e37 | gpt-5-nano (evidence) | 3 | 5, 5, 5 (of 5) | 0, 0, 0 | 0, 0, 0 |
| `20261010T184259-bb61e37-gpt5nano-fixture.json` | bb61e37 | gpt-5-nano FIXTURE | 1 | 6 (of 6) | 0 | 0 |

The gpt-5-nano batch is the first with **0 fallback hops in every run**, so it is the first clean same-mix batch by our rule.
