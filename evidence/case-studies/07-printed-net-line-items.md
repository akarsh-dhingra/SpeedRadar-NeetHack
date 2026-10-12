# 07 — Correct totals flagged for review: line items printed net of commission

Follows case study 06. After the gross-total prompt fix, every real FCC invoice's total was read correctly, but the agent's own check (line items must add up to the total) still sent 7 of the 12 held-out invoices to a human. Their line items are printed **net** of the agency commission and other deductions, so they never add up to the gross.

- **Symptom:** held-out set, prompt v2 (`4290ffe`): correct-but-flagged 7, 7, 7 of 12 per pass (traces `28cbcce7f2808041468d0f67e65f3b03`, `9e9a2708a2fe2759df60f4a31749a574`, `7182ef015c37b912412faf51363a10f9`). Example: invoice `08e2649c`, lines sum to 15,563.32 (its printed Net Amount Due) against a gross of 22,466.00.
- **First idea, rejected before running:** accept the lines when gross − commission = net. The verified annotations show that 9 of the 24 invoices deduct more than the commission, so gross − commission ≠ net on them. (Found while writing the unit test.)
- **Fix (commit `398b322`):**
  - `read_pdf_llm` v3 also copies `agency_commission` and `net_amount_due` (required-but-nullable fields, so OpenAI strict schemas still validate).
  - `verify.invoice_totals_check`: line items are consistent if they add up to the stated gross **or** to the printed net amount due (when net ≤ gross), within 1%. All arithmetic is in Python. With no printed net (every fictional company), it is exactly the old check, so planted mismatches stay caught.
  - In the same commit, the job-title classifier unwraps `{"items": [...], "type": "array"}`. That shape cost a competitor's ML/AI estimate in 2 of the 10 case-study-02 runs (`1011-2c53f4` t31, `1011-6d3ba6` t28).

## Numbers (n = 3 passes per row, 12 invoices each, reader `gemini-3.5-flash-lite`)

| Invoice set | Version | Totals correct | Wrong and not flagged | Correct but flagged |
|---|---|---|---|---|
| tuned on (case study 06) | v2 (`25cf3b6`) | 12, 12, 12 | 0, 0, 0 | 2, 3, 2 |
| tuned on | **v3** (`30ab6c9`) | 12, 12, 12 | 0, 0, 0 | **1, 1, 1** |
| held out (case study 06) | v2 (`4290ffe`) | 12, 12, 12 | 0, 0, 0 | 7, 7, 7 |
| held out | **v3** (`30ab6c9`) | 12, 12, 12 | 0, 0, 0 | **2, 2, 2** |
| **third set, never seen** | v2 (`7c59831`) | 11, 11, 11 | 0, 0, 1 | 4, 4, 3 |
| third set | v3 (`30ab6c9`) | 11, 11, 11 | 1, 0, 1 | 3, 2, 4 |

The third set (`evals/real_invoices_third_gt.json`) is the next 12 originals, chosen after v3 was written.

**Reading it honestly:**
- On the two sets where the pattern was seen, v3 cuts correct-but-flagged invoices sharply (7 → 2 per pass held out), with no silent errors.
- **On the fresh third set, v3 is no clear improvement.** Correct totals are the same (11 of 12); flags (3.7 vs 3.0 per pass) and silent errors (1 of 36 vs 2 of 36 reads) move within run-to-run noise. Every silent error on the third set is one hard 3-page invoice (`c86d3402`, verified gross 591.00), which both versions sometimes misread. Even its verified line items (663.00) do not add up to its verified gross. Another third-set invoice (`dc1df85e`) has lines that sum to exactly 85% of the gross, but v3 still flagged it, which suggests the model did not return its net amount.
- Over all 108 v3 invoice reads, 19 were flagged for review (17.59%). That measured rate drives the cfo.ai *Managed review* scenario (`business/cfoai/managed_review_2026-10-11.json`).

## No regression on the fictional companies

Acme with v3 and the classifier fix, 3 evidence runs on `30ab6c9`: **5/5 planted errors in all 3**, 0 false alarms, 0 unsupported numbers, 0 fallback hops, 0 competitor substitutions, no title-classification JSON failures. Scorecard `evidence/evals/20261011T233008-30ab6c9-acme-v3-agent-fixes.json`, neatlogs eval trace `1e6848284bd6477f943e049715b71b00`; run traces `1ffa27413826a1a487d5d996f88b1111`, `fb99e7d209c06e4d89a628fa6f6238d0`, `b29772f60503b18971ef87ba99da5c1c`.

## Caveats

- One kind of invoice (US broadcast advertising) and one reader model.
- n = 3 passes per row; the third-set differences are within noise.
- Flagging is the safe direction: a flagged invoice goes to a human, it is not wrong in the report.
