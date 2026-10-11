# 06 — On real invoices, the PDF reader copied the net amount instead of the gross total

Our test companies are fictional, so this case study runs the agent's invoice reader on **real** invoices: clean FCC broadcast-advertising invoices from [amazon/ConfBench](https://huggingface.co/datasets/amazon/ConfBench) (public records; CC BY-NC 4.0, evaluation use only), each with a verified `GrossTotal`. The PDFs are downloaded to `cache/` and not committed. Harness: `evals/real_invoices.py`. It takes the same path an agent run takes: the text parser first, then, if that errors or its result fails `verify:totals`, the `reparse_alt` recovery (the LLM PDF reader).

- **Symptom:** the first pass (commit `40607a7`, trace `561e07ead7f7bfbf3b3ee20e87a8abcc`) read 7 of 12 totals correctly. Two misses were exact multiples of 0.85 of the verified total: 450 → 382.50 and 60 → 51.00.
- **Root cause:** these invoices print `Gross Total`, then `Agency Commission` (15%), then `Net Amount Due` (seen in the pdfplumber text of invoice `52f1588f`). The extraction prompt (`read_pdf_llm` v1) said only "copy the stated total as printed", and the model often copied the net figure. On our fictional invoices there is only one total, so this never showed.
- **Fix:** prompt `read_pdf_llm` v2 (commit `25cf3b6`): `stated_total` is the gross total of the charges, before any agency commission, discount or deduction, and never `Net Amount Due` when a gross total is printed.
- **Held-out check:** the fix was written while looking at the first 12 invoices. To check it was not tuned to them, a second set of 12 other originals was chosen **after** the fix (`evals/real_invoices_heldout_gt.json`: the first 12 by id with a positive `GrossTotal` and at most 4 pages, excluding the first set). The old prompt was re-run on it from a worktree where only the prompt change is reverted (`5ed7b0e`).

## Numbers (n = 3 passes per row; each pass is 12 invoices with fresh model calls; reader model `gemini-3.5-flash-lite` in every pass)

"Wrong and not flagged" is a wrong total whose line items still add up, so the agent's own check would not warn anyone. "Correct but flagged" is a right total that the line-items check still sends to a human.

| Invoice set | Prompt | Totals correct | Wrong and not flagged | Correct but flagged |
|---|---|---|---|---|
| tuned on | v1 (`048277e`) | 6, 5, 5 of 12 | 2, 2, 2 | 1, 1, 1 |
| tuned on | v2 (`25cf3b6`) | 12, 12, 12 of 12 | 0, 0, 0 | 2, 3, 2 |
| **held out** | v1 (`5ed7b0e`) | 6, 7, 7 of 12 | 4, 4, 4 | 1, 2, 2 |
| **held out** | v2 (`4290ffe`) | 12, 12, 12 of 12 | 0, 0, 0 | 7, 7, 7 |

Scorecards: `evidence/real-invoices/*.json`, one per pass, each with its neatlogs trace id (variant tags `real-before-prompt-v2`, `real-after-prompt-v2`, `heldout-prompt-v1`, `heldout-prompt-v2`). One trace per side:
- tuned on, v1: `816e23b211567d77b025872e1bb0d8a6`; v2: `36f7827e6ac6c02ca5c95f2188f45da8`
- held out, v1: `2b6af65f4e8cbad311d58e955c8900c3`; v2: `28cbcce7f2808041468d0f67e65f3b03`

## Caveats, stated plainly

- **The fix trades silent errors for review flags.** On the held-out set, 7 of 12 correct totals are still flagged, because many of these invoices print line items that add up to the *net* amount (invoice `08e2649c`: lines sum to 15,563.32, which is its Net Amount Due; the gross is 22,466.00). That is the safe direction (a human looks), but it is noisy. A next step would be to extract the commission and the net amount too, and accept line items that match either.
- **One kind of invoice, one reader model.** All 24 are US broadcast-ad invoices, and every pass used the same model; other invoice types and models may behave differently.
- **The first-pass harness was weaker.** It did not follow the `verify:totals` recovery, so two invoices the text parser misread were scored as read. It is listed but not used in the table.
- **Fictional companies still drive the competitor analysis.** This case study covers invoice reading only.
