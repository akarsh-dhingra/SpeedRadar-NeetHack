# Spend Radar report — Acme Observability Inc. (fictional)

- Run `1010-9e86fc` · commit `6bc76af` · neatlogs trace `36362eb966cdbb85dcb2fb1b280e1034`
- **Data mode: FIXTURE (eval only)** · LLM models used: gemini-2.5-flash, gemini-3.5-flash-lite, gemini-3.6-flash, gemini-3.8-flash, nvidia/nemotron-3-super-120b-a12b:free
- Competitor comparison is **people cost only** (headcount × Acme's loaded cost, an estimate). Infra/cloud is checked against Acme's own budget only.

## Findings

| Area | Finding | Policy | Confidence | Audit |
|---|---|---|---|---|
| Engineering | Acme engineering is 39.4% of headcount vs competitor median 36.8%–39.3% (5 companies); meets policy 'Engineering share of headcount at least 90% of competitor median'. Matching the competitor median would take 9 fewer to 0 fewer people (≈ $1,611,728 less to $84,091 less a year at Acme's loaded cost; estimate). [1][2][10][11][12][3][4][5][6][7][8][9] | met | 0.48 | confirmed |
| ML/AI | Acme ml_ai is 6.7% of headcount vs competitor median 0.0%–1.7% (5 companies); violates policy 'ML/AI share of headcount within 20% of competitor median'. Matching the competitor median would take 22 fewer to 16 fewer people (≈ $5,280,000 less to $3,936,429 less a year at Acme's loaded cost; estimate). [13][14][15][16][17][18][19][20][21][22][23][24][25] | **violated** | 0.00 | downgraded |
| Sales | Acme sales is 19.4% of headcount vs competitor median 20.9%–21.4% (5 companies); meets policy 'Sales share of headcount within 25% of competitor median'. Matching the competitor median would take 5 more to 7 more people (≈ $765,262 more to $1,040,714 more a year at Acme's loaded cost; estimate). [26][27][28][29][30][31][32][33][34][35][36][37] | met | 0.50 | confirmed |
| Marketing | Acme marketing is 7.3% of headcount vs competitor median 4.1%–4.1% (5 companies); meets policy 'Marketing share of headcount at least 80% of competitor median'. Matching the competitor median would take 10 fewer to 10 fewer people (≈ $1,502,727 less to $1,502,727 less a year at Acme's loaded cost; estimate). [38][39][40][41][42][43][44][45][46][47][48][49] | met | 0.04 | downgraded |
| Internal checks | Totals mismatch in budget:marketing: budget_fy27.xlsx People!row 10: line items sum 3,262,500.00 vs stated 3,310,500.00 (1.45% off). Line items used.  | — | 1.00 | confirmed |
| Internal checks | Totals mismatch in invoices/04_nimbus_2026-07.pdf: line items sum 89,435.00 vs stated 96,935.00 (7.74% off). Line items used.  | — | 1.00 | confirmed |
| Internal checks | Tensorforge GPU: vendor billed to ['marketing', 'ml_ai']; likely mis-categorised invoice.  | — | 1.00 | confirmed |
| Infra/cloud | 1 of 7 infra/cloud invoices exceed the monthly budget $92,000 by more than 5%: INV-202604-001 $98,724. [50][51][52][53][54][55][56] | **violated** | 1.00 | confirmed |

## Overturned claims

None this run. Every finding above survived the self-audit.


## Competitor evidence

| Company | Category | Signal | Headcount | As of | Source |
|---|---|---|---|---|---|
| Honeycomb | total | headcount.total | 294 | 2026-10-10 | [57] |
| Honeycomb | Engineering | role_headcount | 97 | 2026-10-10 | [3] |
| Honeycomb | Engineering | function_timeseries | 97 | 2026-08-01 | [4] |
| Honeycomb | Sales | role_headcount | 63 | 2026-10-10 | [28] |
| Honeycomb | Sales | function_timeseries | 63 | 2026-08-01 | [29] |
| Honeycomb | Marketing | role_headcount | 22 | 2026-10-10 | [40] |
| Honeycomb | Marketing | function_timeseries | 22 | 2026-08-01 | [41] |
| Honeycomb | ML/AI | ml_share_job_search | 21 | 2026-10-10 | [15] — 5/23 engineering titles classified ml_ai × engineering headcount 97 |
| Honeycomb | ML/AI | ml_share_engineering_2y | 21 | 2026-10-10 | [16] — 10/47 engineering titles classified ml_ai × engineering headcount 97 |
| Honeycomb | — | missing | — | — | ml_ai: too few classified titles in recent_titles; ml_ai: too few classified titles in recent_titles |
| Sentry | total | headcount.total | 448 | 2026-10-10 | [58] |
| Sentry | Engineering | role_headcount | 193 | 2026-10-10 | [5] |
| Sentry | Engineering | function_timeseries | 193 | 2026-08-01 | [6] |
| Sentry | Sales | role_headcount | 56 | 2026-10-10 | [30] |
| Sentry | Sales | function_timeseries | 56 | 2026-08-01 | [31] |
| Sentry | Marketing | role_headcount | 95 | 2026-10-10 | [42] |
| Sentry | Marketing | function_timeseries | 19 | 2026-08-01 | [43] |
| Sentry | ML/AI | ml_share_recent_titles | 0 | 2026-10-10 | [17] — 0/4 engineering titles classified ml_ai × engineering headcount 193 |
| Sentry | ML/AI | ml_share_job_search | 5 | 2026-10-10 | [18] — 1/42 engineering titles classified ml_ai × engineering headcount 193 |
| Sentry | ML/AI | ml_share_engineering_2y | 8 | 2026-10-10 | [19] — 2/51 engineering titles classified ml_ai × engineering headcount 193 |
| Arize | total | headcount.total | 242 | 2026-10-10 | [59] |
| Arize | Engineering | role_headcount | 95 | 2026-10-10 | [7] |
| Arize | Engineering | function_timeseries | 95 | 2026-08-01 | [8] |
| Arize | Sales | role_headcount | 50 | 2026-10-10 | [32] |
| Arize | Sales | function_timeseries | 50 | 2026-08-01 | [33] |
| Arize | Marketing | role_headcount | 10 | 2026-10-10 | [44] |
| Arize | Marketing | function_timeseries | 10 | 2026-08-01 | [45] |
| Arize | ML/AI | ml_share_job_search | 48 | 2026-10-10 | [20] — 6/12 engineering titles classified ml_ai × engineering headcount 95 |
| Arize | ML/AI | ml_share_engineering_2y | 32 | 2026-10-10 | [21] — 6/18 engineering titles classified ml_ai × engineering headcount 95 |
| Arize | — | missing | — | — | ml_ai: too few classified titles in recent_titles; ml_ai: too few classified titles in recent_titles |
| Chronosphere | total | headcount.total | 139 | 2026-10-10 | [60] |
| Chronosphere | Engineering | role_headcount | 52 | 2026-10-10 | [9] |
| Chronosphere | Engineering | function_timeseries | 51 | 2026-08-01 | [10] |
| Chronosphere | Sales | role_headcount | 35 | 2026-10-10 | [34] |
| Chronosphere | Sales | function_timeseries | 35 | 2026-08-01 | [35] |
| Chronosphere | Marketing | role_headcount | 3 | 2026-10-10 | [46] |
| Chronosphere | Marketing | function_timeseries | 3 | 2026-08-01 | [47] |
| Chronosphere | ML/AI | ml_share_job_search | 0 | 2026-10-10 | [22] — 0/4 engineering titles classified ml_ai × engineering headcount 52 |
| Chronosphere | ML/AI | ml_share_engineering_2y | 0 | 2026-10-10 | [23] — 0/11 engineering titles classified ml_ai × engineering headcount 52 |
| Chronosphere | — | missing | — | — | hiring: no recent job titles; ml_ai: too few classified titles in recent_titles; ml_ai: too few classified titles in recent_titles |
| Grafana Labs | total | headcount.total | 1910 | 2026-10-10 | [61] |
| Grafana Labs | Engineering | role_headcount | 781 | 2026-10-10 | [11] |
| Grafana Labs | Engineering | function_timeseries | 702 | 2025-11-01 | [12] |
| Grafana Labs | Sales | role_headcount | 431 | 2026-10-10 | [36] |
| Grafana Labs | Sales | function_timeseries | 399 | 2025-11-01 | [37] |
| Grafana Labs | Marketing | role_headcount | 51 | 2026-10-10 | [48] |
| Grafana Labs | Marketing | function_timeseries | 48 | 2025-11-01 | [49] |
| Grafana Labs | ML/AI | ml_share_recent_titles | 0 | 2026-10-10 | [24] — 0/9 engineering titles classified ml_ai × engineering headcount 781 |
| Grafana Labs | ML/AI | ml_share_job_search | 0 | 2026-10-10 | [25] — 0/35 engineering titles classified ml_ai × engineering headcount 781 |

## Acme's own numbers

| Category | Headcount (end FY27) | People cost FY27 | Source |
|---|---|---|---|
| Engineering | 130 | $22,940,000 | [1][2] |
| ML/AI | 22 | $4,320,000 | [13][14] |
| Sales | 64 | $9,455,000 | [26][27] |
| Marketing | 24 | $3,262,500 | [38][39] |
| other | 90 | $10,875,000 | [62][63] |

| Invoice | Vendor | Cost centre → category | Line items | Stated total | Parser | Source |
|---|---|---|---|---|---|---|
| INV-202604-001 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $98,724.00 | $98,724.00 | pdfplumber | [50] |
| INV-202605-002 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $92,083.00 | $92,083.00 | pdfplumber | [51] |
| INV-202606-003 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $92,370.00 | $92,370.00 | pdfplumber | [52] |
| INV-202607-004 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $89,435.00 | $96,935.00 ⚠️ mismatch | llm:gemini-3.5-flash-lite | [53] |
| INV-202608-005 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $85,423.00 | $85,423.00 | pdfplumber | [54] |
| INV-202609-006 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $85,142.00 | $85,142.00 | pdfplumber | [55] |
| INV-202605-007 | Tensorforge GPU | ML Platform → ml_ai | $28,084.00 | $28,084.00 | pdfplumber | [64] |
| INV-202608-008 | Tensorforge GPU | Marketing → marketing | $32,752.00 | $32,752.00 | pdfplumber | [65] |
| INV-202606-009 | Brightloop Media | Marketing → marketing | $38,840.00 | $38,840.00 | pdfplumber | [66] |
| INV-202609-010 | Brightloop Media | Marketing → marketing | $35,456.00 | $35,456.00 | pdfplumber | [67] |
| INV-202607-011 | Pipewise CRM | Sales → sales | $5,400.00 | $5,400.00 | pdfplumber | [68] |
| INV-202610-012 | Nimbus Cloud Ltd | Infrastructure → infra_cloud | $91,287.00 | $91,287.00 | llm:gemini-3.5-flash-lite | [56] |

## Flags, gaps and notes

- ⚠️ budget_fy27.xlsx: budget:marketing: budget_fy27.xlsx People!row 10: line items sum 3,262,500.00 vs stated 3,310,500.00 (1.45% off)
- ⚠️ invoices/04_nimbus_2026-07.pdf: invoices/04_nimbus_2026-07.pdf: line items sum 89,435.00 vs stated 96,935.00 (7.74% off)
- ⚠️ Tensorforge GPU: vendor billed to ['marketing', 'ml_ai']; likely mis-categorised invoice
- Not analysed: `invoices/13_brightloop_2026-10.pdf` — tool_error: LLM PDF reader failed: gemini-3.5-flash-lite: non-retryable: 400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'Request contains an invalid argument.', 'status': 'INVALID_ARGUM
- Sentry: EVAL FIXTURE used (headcount.by_role_absolute.Marketing altered on purpose)

## How the agent recovered

| Task | Failure | Options | Chosen | Rule default | Why |
|---|---|---|---|---|---|
| t03 | verify:totals failed: budget:marketing: budget_fy27.xlsx People!row 10: line items sum 3,2 | narrow_range, mark_low_confidence, skip | **narrow_range** | mark_low_confidence | Re-read People!row 10 line items to verify against a potential parse slip. (gemini-3.8-flash) |
| t03n | verify:totals failed: budget:marketing: budget_fy27.xlsx People!row 10: line items sum 3,2 | narrow_range, mark_low_confidence, skip | **mark_low_confidence** | mark_low_confidence | Line items sum and stated total differ by 1.45% after re-reading; retaining data with low confidence. (gemini-3.8-flash) |
| t07 | verify:totals failed: invoices/04_nimbus_2026-07.pdf: line items sum 89,435.00 vs stated 9 | reparse_alt, mark_low_confidence, skip | **reparse_alt** | mark_low_confidence | Line items sum mismatch in text mode; re-parsing with LLM reader to correctly capture all items. (gemini-3.8-flash) |
| t07r | verify:totals failed: invoices/04_nimbus_2026-07.pdf: line items sum 89,435.00 vs stated 9 | reparse_alt, mark_low_confidence, skip | **mark_low_confidence** | mark_low_confidence | Reparse already attempted; keep the invoice data flagged with low confidence due to unresolved 7.74% totals discrepancy. (gemini-3.8-flash) |
| t15 | tool_error: tool_error: no text layer (likely a scanned image) | reparse_alt, skip | **reparse_alt** | skip | Switch to LLM reader parser since the PDF has no text layer. (gemini-3.8-flash) |
| t16 | tool_error: tool_error: pdfplumber could not open file: PdfminerException: No /Root object | reparse_alt, skip | **reparse_alt** | skip | Switch from text mode to LLM reader parser as pdfplumber failed to parse the file structure (gemini-3.8-flash) |
| t16r | tool_error: tool_error: LLM PDF reader failed: gemini-3.5-flash-lite: non-retryable: 400 I | reparse_alt, skip | **skip** | skip | LLM PDF reader failed with non-retryable 400 error and reparse_alt was already attempted (gemini-3.8-flash) |
| t19 | verify:signals failed: Honeycomb:ml_ai: 1 ML/AI signals | fetch_more_signal, mark_low_confidence | **fetch_more_signal** | mark_low_confidence | The current '1 ML/AI signals' for Honeycomb failed verification, suggesting the count might be incomplete or inaccurate. Fetching more signa (gemini-2.5-flash) |
| t20 | verify:agreement failed: Sentry:marketing: signals 19–95, agreement 0.20 | fetch_more_signal, mark_low_confidence | **fetch_more_signal** | mark_low_confidence | Low agreement between marketing signals; need additional independent signal to improve verification. (nvidia/nemotron-3-super-120b-a12b:free) |
| t25 | verify:signals failed: Arize:ml_ai: 1 ML/AI signals | fetch_more_signal, mark_low_confidence | **fetch_more_signal** | mark_low_confidence | Insufficient ML/AI signals for verification (gemini-2.5-flash) |
| t28 | verify:signals failed: Chronosphere:ml_ai: 1 ML/AI signals | fetch_more_signal, mark_low_confidence | **fetch_more_signal** | mark_low_confidence | Low number of ML/AI signals causing verification failure. (gemini-2.5-flash) |

## Confidence formula

`confidence = checks × signals × freshness`, computed in `spendradar/verify.py` from this run's checks (passed/total), number and agreement of independent signals, and age of the oldest input. Audit downgrades halve it; overturns zero it.

## Sources

1. file: `data/acme/budget_fy27.xlsx` People!row 3, 2027-03 (fetched 2026-10-10T08:53:37)
2. file: `data/acme/budget_fy27.xlsx` People!row 4, sum of 12 months (fetched 2026-10-10T08:53:37)
3. crustdata: `/company/enrich?domain=honeycomb.io` headcount.by_role_absolute.Engineering (fetched 2026-10-10T08:49:18)
4. crustdata: `/company/enrich?domain=honeycomb.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering[2026-08-01] (fetched 2026-10-10T08:49:18)
5. crustdata: `/company/enrich?domain=sentry.io` headcount.by_role_absolute.Engineering (fetched 2026-10-10T08:35:25)
6. crustdata: `/company/enrich?domain=sentry.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering[2026-08-01] (fetched 2026-10-10T08:35:25)
7. crustdata: `/company/enrich?domain=arize.com` headcount.by_role_absolute.Engineering (fetched 2026-10-10T08:35:50)
8. crustdata: `/company/enrich?domain=arize.com` headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering[2026-08-01] (fetched 2026-10-10T08:35:50)
9. crustdata: `/company/enrich?domain=chronosphere.io` headcount.by_role_absolute.Engineering (fetched 2026-10-10T08:36:47)
10. crustdata: `/company/enrich?domain=chronosphere.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering[2026-08-01] (fetched 2026-10-10T08:36:47)
11. crustdata: `/company/enrich?domain=grafana.com` headcount.by_role_absolute.Engineering (fetched 2026-10-10T08:37:20)
12. crustdata: `/company/enrich?domain=grafana.com` headcount.by_function_timeseries.CURRENT_FUNCTION.Engineering[2025-11-01] (fetched 2026-10-10T08:37:20)
13. file: `data/acme/budget_fy27.xlsx` People!row 5, 2027-03 (fetched 2026-10-10T08:53:37)
14. file: `data/acme/budget_fy27.xlsx` People!row 6, sum of 12 months (fetched 2026-10-10T08:53:37)
15. derived: `/job/search?domain=honeycomb.io` job_listings[].job_details.title (since 2025-10-10) (fetched 2026-10-10T08:34:40) — 5/23 engineering titles classified ml_ai × engineering headcount 97
16. derived: `/job/search?domain=honeycomb.io` job_listings[].job_details.title (since 2024-10-10, category=Engineering) (fetched 2026-10-10T08:42:22) — 10/47 engineering titles classified ml_ai × engineering headcount 97
17. derived: `/company/enrich?domain=sentry.io` hiring.recent_titles_csv (fetched 2026-10-10T08:35:25) — 0/4 engineering titles classified ml_ai × engineering headcount 193
18. derived: `/job/search?domain=sentry.io` job_listings[].job_details.title (since 2025-10-10) (fetched 2026-10-10T08:35:26) — 1/42 engineering titles classified ml_ai × engineering headcount 193
19. derived: `/job/search?domain=sentry.io` job_listings[].job_details.title (since 2024-10-10, category=Engineering) (fetched 2026-10-10T08:53:55) — 2/51 engineering titles classified ml_ai × engineering headcount 193
20. derived: `/job/search?domain=arize.com` job_listings[].job_details.title (since 2025-10-10) (fetched 2026-10-10T08:35:51) — 6/12 engineering titles classified ml_ai × engineering headcount 95
21. derived: `/job/search?domain=arize.com` job_listings[].job_details.title (since 2024-10-10, category=Engineering) (fetched 2026-10-10T08:43:21) — 6/18 engineering titles classified ml_ai × engineering headcount 95
22. derived: `/job/search?domain=chronosphere.io` job_listings[].job_details.title (since 2025-10-10) (fetched 2026-10-10T08:36:49) — 0/4 engineering titles classified ml_ai × engineering headcount 52
23. derived: `/job/search?domain=chronosphere.io` job_listings[].job_details.title (since 2024-10-10, category=Engineering) (fetched 2026-10-10T08:43:46) — 0/11 engineering titles classified ml_ai × engineering headcount 52
24. derived: `/company/enrich?domain=grafana.com` hiring.recent_titles_csv (fetched 2026-10-10T08:37:20) — 0/9 engineering titles classified ml_ai × engineering headcount 781
25. derived: `/job/search?domain=grafana.com` job_listings[].job_details.title (since 2025-10-10) (fetched 2026-10-10T08:37:22) — 0/35 engineering titles classified ml_ai × engineering headcount 781
26. file: `data/acme/budget_fy27.xlsx` People!row 7, 2027-03 (fetched 2026-10-10T08:53:37)
27. file: `data/acme/budget_fy27.xlsx` People!row 8, sum of 12 months (fetched 2026-10-10T08:53:37)
28. crustdata: `/company/enrich?domain=honeycomb.io` headcount.by_role_absolute.Sales+Business Development (fetched 2026-10-10T08:49:18)
29. crustdata: `/company/enrich?domain=honeycomb.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Sales+Business Development[2026-08-01] (fetched 2026-10-10T08:49:18)
30. crustdata: `/company/enrich?domain=sentry.io` headcount.by_role_absolute.Sales+Business Development (fetched 2026-10-10T08:35:25)
31. crustdata: `/company/enrich?domain=sentry.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Sales+Business Development[2026-08-01] (fetched 2026-10-10T08:35:25)
32. crustdata: `/company/enrich?domain=arize.com` headcount.by_role_absolute.Sales+Business Development (fetched 2026-10-10T08:35:50)
33. crustdata: `/company/enrich?domain=arize.com` headcount.by_function_timeseries.CURRENT_FUNCTION.Sales+Business Development[2026-08-01] (fetched 2026-10-10T08:35:50)
34. crustdata: `/company/enrich?domain=chronosphere.io` headcount.by_role_absolute.Sales+Business Development (fetched 2026-10-10T08:36:47)
35. crustdata: `/company/enrich?domain=chronosphere.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Sales+Business Development[2026-08-01] (fetched 2026-10-10T08:36:47)
36. crustdata: `/company/enrich?domain=grafana.com` headcount.by_role_absolute.Sales+Business Development (fetched 2026-10-10T08:37:20)
37. crustdata: `/company/enrich?domain=grafana.com` headcount.by_function_timeseries.CURRENT_FUNCTION.Sales+Business Development[2025-11-01] (fetched 2026-10-10T08:37:20)
38. file: `data/acme/budget_fy27.xlsx` People!row 9, 2027-03 (fetched 2026-10-10T08:53:37)
39. file: `data/acme/budget_fy27.xlsx` People!row 10, sum of 12 months (fetched 2026-10-10T08:53:37)
40. crustdata: `/company/enrich?domain=honeycomb.io` headcount.by_role_absolute.Marketing (fetched 2026-10-10T08:49:18)
41. crustdata: `/company/enrich?domain=honeycomb.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Marketing[2026-08-01] (fetched 2026-10-10T08:49:18)
42. crustdata: `/company/enrich?domain=sentry.io` headcount.by_role_absolute.Marketing (fetched 2026-10-10T08:35:25)
43. crustdata: `/company/enrich?domain=sentry.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Marketing[2026-08-01] (fetched 2026-10-10T08:35:25)
44. crustdata: `/company/enrich?domain=arize.com` headcount.by_role_absolute.Marketing (fetched 2026-10-10T08:35:50)
45. crustdata: `/company/enrich?domain=arize.com` headcount.by_function_timeseries.CURRENT_FUNCTION.Marketing[2026-08-01] (fetched 2026-10-10T08:35:50)
46. crustdata: `/company/enrich?domain=chronosphere.io` headcount.by_role_absolute.Marketing (fetched 2026-10-10T08:36:47)
47. crustdata: `/company/enrich?domain=chronosphere.io` headcount.by_function_timeseries.CURRENT_FUNCTION.Marketing[2026-08-01] (fetched 2026-10-10T08:36:47)
48. crustdata: `/company/enrich?domain=grafana.com` headcount.by_role_absolute.Marketing (fetched 2026-10-10T08:37:20)
49. crustdata: `/company/enrich?domain=grafana.com` headcount.by_function_timeseries.CURRENT_FUNCTION.Marketing[2025-11-01] (fetched 2026-10-10T08:37:20)
50. file: `data/acme/invoices/01_nimbus_2026-04.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
51. file: `data/acme/invoices/02_nimbus_2026-05.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
52. file: `data/acme/invoices/03_nimbus_2026-06.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
53. file: `data/acme/invoices/04_nimbus_2026-07.pdf` line items, parser=llm:gemini-3.5-flash-lite (fetched 2026-10-10T08:53:37)
54. file: `data/acme/invoices/05_nimbus_2026-08.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
55. file: `data/acme/invoices/06_nimbus_2026-09.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
56. file: `data/acme/invoices/12_nimbus_2026-10.pdf` line items, parser=llm:gemini-3.5-flash-lite (fetched 2026-10-10T08:53:37)
57. crustdata: `/company/enrich?domain=honeycomb.io` headcount.total (fetched 2026-10-10)
58. crustdata: `/company/enrich?domain=sentry.io` headcount.total (fetched 2026-10-10)
59. crustdata: `/company/enrich?domain=arize.com` headcount.total (fetched 2026-10-10)
60. crustdata: `/company/enrich?domain=chronosphere.io` headcount.total (fetched 2026-10-10)
61. crustdata: `/company/enrich?domain=grafana.com` headcount.total (fetched 2026-10-10)
62. file: `data/acme/budget_fy27.xlsx` People!row 11, 2027-03 (fetched 2026-10-10T08:53:37)
63. file: `data/acme/budget_fy27.xlsx` People!row 12, sum of 12 months (fetched 2026-10-10T08:53:37)
64. file: `data/acme/invoices/07_tensorforge_2026-05.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
65. file: `data/acme/invoices/08_tensorforge_2026-08.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
66. file: `data/acme/invoices/09_brightloop_2026-06.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
67. file: `data/acme/invoices/10_brightloop_2026-09.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)
68. file: `data/acme/invoices/11_pipewise_2026-07.pdf` line items, parser=pdfplumber (fetched 2026-10-10T08:53:37)

## Run cost

- LLM: gemini-3.8-flash: 0 calls, 0+0 tokens, gemini-3.5-flash-lite: 2 calls, 781+1383 tokens, gemini-2.5-flash: 0 calls, 0+0 tokens, nvidia/nemotron-3-super-120b-a12b:free: 7 calls, 2286+5343 tokens, gemini-3.6-flash: 0 calls, 0+0 tokens
- Crustdata credits (this run): 1.80
- LLM response cache: on
