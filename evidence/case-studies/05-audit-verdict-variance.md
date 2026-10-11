# 05 — Same data, three different audit verdicts

- **Symptom (what the traces showed):** the self-audit is meant to try to disprove each finding before it is reported. On identical Acme data, with the same model mix (gpt-5-nano + gemini-3.5-flash-lite, 0 fallback hops), the ML/AI finding got a different verdict depending on the run:

  | Run | Trace | ML/AI verdict |
  |---|---|---|
  | 1010-767322 | `5c512d38b1cc95f99d0682619343c0b0` | confirmed |
  | 1010-bf52d4 | `d4a8716f6d2ed79322ca0d252764837e` | overturned |
  | 1010-4d1835 | `0dcf22977776591d6c8e47e0dffeed33` | downgraded |
  | 1010-bd4980 | `96bb795859c9f184fbcebb996b0e5b8f` | overturned |
  | 1010-a67b26 | `c4c0b55ade5fdbae4032698bc949e0ac` | overturned |

  Across all 23 finished Acme runs in `runs/`, the split was 3 confirmed / 12 downgraded / 8 overturned. Engineering, sales and marketing were stable (5/5 confirmed). The `audit:f_ml_ai` spans show the same input every time: a computed confidence of 0.00, plus "Honeycomb / Sentry ml_ai signals disagree" as the evidence against.

- **Root cause:** the deciding fact was already computed in Python. Two competitors' independent ML/AI signals contradict each other (agreement below 0.6). The verdict for that fact was nevertheless left to the LLM judge, which read the same evidence as "weakens it" in some runs and "proves it wrong" or "survives" in others. The brief's own split (§4.1) says Python decides what can be decided deterministically; this decision had slipped through to the LLM.

- **Fix:** branch `feat/deterministic-audit`, commit `bb2fb2f` (`spendradar/audit.py`).
  - A policy finding where any competitor's signals disagree (agreement < `AGREEMENT_MIN` = 0.6) is **downgraded deterministically**. Its confidence is halved, and the note names the competitors.
  - A policy finding with no evidence against it, after recomputation and source checks pass, is **confirmed deterministically**.
  - The LLM judge (and its second opinion) now only handles real judgement calls: news evidence, and mis-categorisation flags.
  - Unit test: `tests/test_report_audit.py::test_disagreeing_signals_downgrade_without_asking_the_llm`.

- **After:** `spendradar eval --n 5 --evidence --variant cs05-after-deterministic-audit`. Scorecard `evidence/evals/20261011T145242-bb2fb2f-cs05-after-deterministic-audit.json`, neatlogs eval trace `23dc44d364685f2d715d92bd8dce6194`.

  | Run | Trace | ML/AI verdict |
  |---|---|---|
  | 1011-41090d | `bfd41c0e603782c9df549da8292fac15` | downgraded |
  | 1011-656492 | `2f61f9f5415d17b790ef4d97e6794101` | downgraded |
  | 1011-8ae79e | `c550b7b7b63566303e1ca322503d2a38` | downgraded |
  | 1011-e1f008 | `77a9f435452087e4a45f6ae9032ad340` | downgraded |
  | 1011-d1cade | `80803385d7b0ba70104eefb85a7574f7` | downgraded |

- **Numbers (n = 5 per side, same provider mix, 0 fallback hops on both sides):**

  | Metric | Before mean [min–max] | After mean [min–max] |
  |---|---|---|
  | **Distinct ML/AI verdicts across 5 identical runs** | **3** | **1** |
  | **Runs agreeing with the most common verdict** | **3/5** | **5/5** |
  | Planted errors caught | 5/5 [5–5] | 5/5 [5–5] |
  | Unsupported numbers in report | 0 | 0 |
  | False alarms | 0 | 0 |
  | Other policy findings stable (eng / sales / marketing) | 5/5 each | 5/5 each |
  | LLM calls per run | 29.8 [29–30] | 25.8 [25–26] |
  | Output tokens per run | 66,327 [62,274–68,930] | 57,184 [54,509–60,307] |
  | LLM latency per run (s) | 329.7 [310.9–360.5] | 281.3 [264.2–288.5] |

- **Caveats, stated plainly:**
  - The before batch ran at commits `bb61e37`/`e896b86`. Other changes (held-out-company fixes, the line-item check, hardening) also landed between the two sides. The verdict stability is attributable to this fix, because every after-run's `audit:f_ml_ai` note reads "deterministic: competitor signals disagree…". The drop in LLM calls, tokens and latency is **indicative only**: part of it comes from skipping the judge on the other policy findings, and part may come from the other commits.
  - "Downgraded" is a policy choice: a gap built on contradicting signals may be real, but it is not confirmed. It matches the majority verdict before the fix (12 of 23 runs). It also satisfies the planted fixture (Sentry Marketing ×5), which expects a downgrade or overturn: fixture run `1011-2b916a` (trace `61f10e4d251c44b8674ac263b353efa2`, scorecard `evidence/evals/20261011T145816-bb2fb2f-dirty-cs05-after-fixture.json`) caught **6/6**, with the marketing finding downgraded deterministically (confidence 0.041) and 0 fallback hops. The `-dirty` tag on that scorecard is only this file and the new unit test, which were uncommitted when it ran.
  - This removes variance, not judgement. The LLM still decides cases that need reading (news, mis-categorisation).
