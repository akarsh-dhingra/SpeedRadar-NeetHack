# Recovery paths: one saved trace each

| # | Path | Natural or injected | Run · trace | What happened |
|---|---|---|---|---|
| 1 | Corrupt PDF → other parser → skip | natural (planted corrupt file) | 1010-7bf26d · `288f07d84bb84e15754a241eef40d779` | pdfplumber `PdfminerException` → LLM chose `reparse_alt` → Gemini 400 → LLM chose `skip` → listed under "Not analysed" |
| 1b | Scanned PDF → other parser | natural (planted) | 1010-7bf26d · same | no text layer → `reparse_alt` → Gemini reads the PDF bytes → total 91,287, matching what is printed |
| 2 | Crustdata 429 → backoff → retry | injected `crustdata:429` | 1010-a32118 · `6fcb0c5ef827b202df85e61406ca16d8` | attempt 0 failed (injected), attempt 1 succeeded (2.0 credits) |
| 3 | Competitor with no usable data → substitute | natural, but over-triggered (bug) | 1010-b31657 · `af0df27e2d3433e0c608fb28a018a22d` | `substitute_competitor` ×3; fixed in case study 02. Correct trigger is now limited to no-data competitors |
| 4 | Totals mismatch → narrow range → flag | natural (planted) | 1010-7bf26d · `288f07d84bb84e15754a241eef40d779` | budget marketing row: `narrow_range` (LLM, not the rule default) → still mismatched → `mark_low_confidence`, line items used |
| 5 | Malformed JSON → re-ask with validation error | not yet observed in a saved run | — | `recover:json_reask` span exists in `llm.complete`; no run has produced malformed JSON yet |
| 6 | LLM 429 → other Gemini model → OpenRouter | natural (free-tier quota) | 1010-b31657 · `af0df27e2d3433e0c608fb28a018a22d` | `gemini-3.8-flash` hit a real 429 PerDay → 4 `fallback:gemini-3.6-flash` hops |
| 6b | LLM 429 (injected) | injected `llm:429` | direct test, no run id | fallback 3.5-flash-lite → 3.1-flash-lite. In run 1010-a32118 the fault was configured but nothing showed it firing (fired faults were not recorded then; they are now) |

Also: resume after crash, see `resume-after-crash.md`.
