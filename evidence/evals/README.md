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

## 10–11 Oct: held-out companies, fixes and re-scores

Generated from the scorecard files (values copied, one entry per run in run order). `-dirty` = uncommitted changes were present (see each case study for what they were). A run listed under Unfinished stopped early; scorecards written since `de18e4f` keep such runs out of their averages.

| Scorecard | Commit | Variant | Dataset | n | Planted caught per run | False alarms | Unsupported numbers | Fallback hops | Unfinished |
|---|---|---|---|---|---|---|---|---|---|
| `20261010T142549-6bc76af-fixture-dev.json` | 6bc76af | fixture-dev | acme | 1 | 6/6 | — | 0 | 6 | — |
| `20261010T185535-bb61e37-gpt5nano-cost.json` | bb61e37 | gpt5nano-cost | acme | 2 | 5/5, 5/5 | —, — | 0, 0 | 0, 0 | — |
| `20261010T205437-8d11308-eval.json` | 8d11308 | eval | acme | 1 | 5/5 | — | 0 | 0 | — |
| `20261010T225455-771deef-dirty-after-heldout-fixes-carebridge.json` | 771deef-dirty | after-heldout-fixes-carebridge | carebridge | 1 | 5/5 | 0 | 0 | 1 | — |
| `20261010T230215-21de57c-dirty-after-heldout-fixes-kestrel.json` | 21de57c-dirty | after-heldout-fixes-kestrel | kestrel | 1 | 6/6 | 0 | 0 | 0 | — |
| `20261010T230301-771deef-baseline-acme.json` | 771deef | baseline-acme | acme | 1 | 5/5 | 0 | 0 | 0 | — |
| `20261010T230302-771deef-baseline-kestrel.json` | 771deef | baseline-kestrel | kestrel | 1 | 5/6 | 0 | 0 | 0 | — |
| `20261010T230304-771deef-baseline-ledgerly.json` | 771deef | baseline-ledgerly | ledgerly | 1 | 4/5 | 0 | 0 | 0 | — |
| `20261010T230306-771deef-baseline-carebridge.json` | 771deef | baseline-carebridge | carebridge | 1 | 4/5 | 0 | 0 | 0 | — |
| `20261010T230731-21de57c-dirty-after-heldout-fixes-ledgerly.json` | 21de57c-dirty | after-heldout-fixes-ledgerly | ledgerly | 1 | 5/5 | 0 | 0 | 0 | — |
| `20261010T231337-21de57c-dirty-after-heldout-fixes-acme.json` | 21de57c-dirty | after-heldout-fixes-acme | acme | 1 | 5/5 | 0 | 0 | 0 | — |
| `20261010T232222-21de57c-dirty-heldout-bastion-new.json` | 21de57c-dirty | heldout-bastion-new | bastion | 1 | 6/6 | 0 | 0 | 0 | — |
| `20261010T232957-d172a62-dirty-heldout-parcelwise-new.json` | d172a62-dirty | heldout-parcelwise-new | parcelwise | 1 | 5/5 | 0 | 0 | 0 | — |
| `20261010T233724-d172a62-dirty-heldout-peoplegraph-new.json` | d172a62-dirty | heldout-peoplegraph-new | peoplegraph | 1 | 5/5 | 0 | 0 | 0 | — |
| `20261011T005427-d172a62-dirty-n3-after-fixes-kestrel.json` | d172a62-dirty | n3-after-fixes-kestrel | kestrel | 2 | 3/6, 6/6 | 3, 0 | 0, 0 | 0, 0 | — |
| `20261011T084358-d172a62-dirty-n3-after-fixes-kestrel-rescored-path-fix.json` | d172a62-dirty | n3-after-fixes-kestrel-rescored-path-fix (re-score of saved runs) | kestrel | 2 | 6/6, 6/6 | 0, 0 | 0, 0 | 0, 0 | — |
| `20261011T084642-d172a62-dirty-n3-after-fixes-ledgerly.json` | d172a62-dirty | n3-after-fixes-ledgerly | ledgerly | 2 | 5/5, 5/5 | 0, 0 | 0, 0 | 2, 2 | — |
| `20261011T090256-b217ef2-dirty-n3-after-fixes-carebridge.json` | b217ef2-dirty | n3-after-fixes-carebridge | carebridge | 2 | 5/5, 5/5 | 0, 0 | 0, 0 | 0, 0 | — |
| `20261011T092110-b217ef2-dirty-n3-after-fixes-bastion.json` | b217ef2-dirty | n3-after-fixes-bastion | bastion | 2 | 6/6, 4/6 | 0, 0 | 0, 0 | 0, 2 | — |
| `20261011T093510-b217ef2-dirty-n3-after-fixes-parcelwise.json` | b217ef2-dirty | n3-after-fixes-parcelwise | parcelwise | 2 | 5/5, 5/5 | 0, 0 | 0, 0 | 0, 0 | — |
| `20261011T094939-b217ef2-dirty-n3-after-fixes-peoplegraph.json` | b217ef2-dirty | n3-after-fixes-peoplegraph | peoplegraph | 2 | 5/5, 5/5 | 0, 0 | 0, 0 | 0, 0 | — |
| `20261011T095953-d2e9663-dirty-n3-after-fixes-acme.json` | d2e9663-dirty | n3-after-fixes-acme | acme | 2 | 4/5, 4/5 | 0, 0 | 0, 0 | 0, 0 | 1011-d2d05c |
| `20261011T102307-bb61e37-fixture-rescore.json` | bb61e37 | fixture-rescore (re-score of saved runs) | acme | 1 | 6/6 | 0 | 0 | 0 | — |
| `20261011T102319-d1ff728-history-all-acme-runs.json` | d1ff728 | history-all-acme-runs (re-score of saved runs) | acme | 20 | 0/5, 4/5, 5/5, 5/5, 4/5, 2/5, 5/5, 5/5, 5/5, 5/5, 6/6, 6/6, 5/5, 5/5, 5/5, 4/5, 5/5, 5/5, 5/5, 3/5 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 | 6, 11, 0, 0, 10, 0, 0, 0, 2, 5, 0, 6, 0, 0, 4, 6, 0, 0, 0, 17 | 1010-21b4e0, 1010-6f37e8 |
| `20261011T103253-34d83f8-dirty-after-coverage-fix-bastion.json` | 34d83f8-dirty | after-coverage-fix-bastion | bastion | 2 | 6/6, 6/6 | 0, 0 | 0, 0 | 0, 0 | — |
| `20261011T104734-d1ff728-before-fix-misses.json` | d1ff728 | before-fix-misses (re-score of saved runs) | acme | 4 | 4/5, 4/5, 4/5, 3/5 | 0, 0, 0, 0 | 0, 0, 0, 0 | 11, 10, 6, 17 | — |
| `20261011T104804-f325e59-dirty-inject-fixed-heldout.json` | f325e59-dirty | inject-fixed-heldout | bastion, ledgerly | 2 | 5/5, 6/6 | 0, 0 | 0, 0 | 0, 0 | — |
| `20261011T112120-de18e4f-dirty-after-audit-linecheck.json` | de18e4f-dirty | after-audit-linecheck | acme | 3 | 5/5, 5/5, 5/5 | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 | — |
