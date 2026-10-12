# neatlogs traces

One line per important trace: date (IST) · trace id · what it shows. Dashboard: https://app.neatlogs.com (the trace id is searchable there).

- 2026-10-10 13:38 · `4f62da47ebec7e3189b9481d72ad8bde` · first traced run: WORKFLOW `probe_run` → TOOL `act:echo` → auto-instrumented Gemini call (`gemini-3.5-flash-lite`), secret mask active (`spikes/neatlogs_probe.py`)
- 2026-10-10 13:40 · `3a3a392154ddcf7195bbdaeffe4b5b04` · `llm.complete` with schema (Flash-Lite → `ml_ai`), `llm.choose` native function calling picks `reparse_alt`, injected `llm:429` → `fallback:gemini-3.6-flash` span (`spikes/llm_probe.py`)
- 2026-10-10 13:51 · `6f2d2dd7d3cc60d33157d5ac4f16746a` · run 1010-6f37e8 (killed): planner/recovery spans averaged 120.9 s/call → case study 01 "before"
- 2026-10-10 14:08 · `af0df27e2d3433e0c608fb28a018a22d` · run 1010-b31657: first complete run. 5/5 planted errors caught; `audit:f_ml_ai` overturned (Gemini) + OpenRouter second opinion; `decide:recovery` → `substitute_competitor` ×3 (case study 02 "before"); `recover:json_reask` / `fallback:gemini-3.6-flash` spans
- 2026-10-10 14:15 · `288f07d84bb84e15754a241eef40d779` · run 1010-7bf26d (evidence, LLM cache off): after both fixes; 5/5 peers kept, 6.5 s mean reasoning latency, corrupt PDF → `reparse_alt` → `skip`
- 2026-10-10 14:25 · `36362eb966cdbb85dcb2fb1b280e1034` · run 1010-9e86fc (FIXTURE, dev, LLM cache on): Sentry marketing ×5 fixture → `verify:agreement` failed (19 vs 95) → `audit:f_marketing` downgraded, 6/6 planted caught. Found: the "second opinion" used the same model as the primary verdict (nemotron), so it was not independent (fixed)
- 2026-10-10 17:10 · `6f93a257acc67b3e7df1a245d10673e8`, `b16cc16a4424fc85ad5478646523ad6e`, `682db8d165a0c041fc26ab495438e142` · evidence runs 1010-7d05cb / 4c9a03 / 21b4e0 on fallback models: natural JSON re-ask, re-ask model downgrade (bug), planner path crash (bug) → case study 03
- 2026-10-10 18:37 · `5c512d38b1cc95f99d0682619343c0b0`, `d4a8716f6d2ed79322ca0d252764837e`, `0dcf22977776591d6c8e47e0dffeed33` · gpt-5-nano evidence batch (1010-767322 / bf52d4 / 4d1835): 5/5 planted errors each, 0 fallback hops, mis-categorised invoice confirmed with corrected category
- 2026-10-10 18:43 · `eb46da9f5383934b351975949f9584ba` · FIXTURE run 1010-824ed7 on gpt-5-nano: 6/6; `audit:f_marketing` downgrade by gpt-5-nano, independent second opinion by gemini-3.5-flash-lite says confirm → kept as downgrade
- `953bb991e2547b1591bb2bb6adb555b8`: evidence run 1010-7309e6 after commit 8d11308. Corrupt invoice 13: read_pdf mode=llm fails in 0.8 ms with no LLM span. This closed neatlogs auto-triage fix 2cd5e9df (before: `36362eb966cdbb85dcb2fb1b280e1034`, where the LLM fallback got a Gemini 400). The neatlogs incident it raised (detection spike, 13 negative detections, 108.5x baseline, group Execution Failed; investigation, Sent to Claude Code, Resolved): screenshot `evidence/neatlogs/incident-read_pdf-corrupt-resolved.png` (12 Oct).


## 10–11 Oct: held-out companies and later fixes (times: run start, UTC where known)

- 2026-10-10 16:58 · `d148c048822af4954479e25dd567a2ea` · run 1010-f3a894 (Kestrel Metrics Inc., evidence): held-out baseline; 5/6 planted, 0 false alarms, 0 fallback hops.
- 2026-10-10 17:05 · `8a5762c951ba6e8ea6d1108368753167` · run 1010-dd2fc1 (Ledgerly Payments Inc., evidence): held-out baseline; 4/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-10 17:10 · `8985b2010ca297275006a2ffdf241b02` · run 1010-a49f44 (Carebridge Health Inc., evidence): held-out baseline; 4/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-10 17:16 · `21f52eb2627e8d4da8d67840dd9c3bc3` · run 1010-da4413 (Carebridge Health Inc., evidence): after held-out fixes (1 fallback hop); 5/5 planted, 0 false alarms, 1 fallback hops.
- 2026-10-10 17:25 · `d9f640f09022a87f323639df6203aa09` · run 1010-d514dc (Kestrel Metrics Inc., evidence): after held-out fixes; 6/6 planted, 0 false alarms, 0 fallback hops.
- 2026-10-10 17:32 · `19d1939a2077ba4f7e55850c4e881932` · run 1010-d94102 (Ledgerly Payments Inc., evidence): after held-out fixes; 5/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 03:33 · `c098222291f070c118eabe38bc2f7372` · run 1011-5b0668 (Bastion Security Inc., evidence): Bastion before the Windows coverage fix; 6/6 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 03:42 · `4f7f2b6de83d5dca471a783c264cc9a1` · run 1011-ae5e18 (Bastion Security Inc., evidence): Bastion before the Windows coverage fix; 4/6 planted, 0 false alarms, 2 fallback hops.
- 2026-10-11 04:19 · `b690299d894691d4e218075418b3aac2` · run 1011-4f1f02 (Acme Observability Inc., evidence): Acme before the audit line-item fix; 4/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 04:28 · `ad9a239b6ca814eaf44350ecad3dfb79` · run 1011-d2d05c (Acme Observability Inc., evidence): Acme before the audit line-item fix; 4/5 planted, 0 false alarms, 0 fallback hops (did not finish).
- 2026-10-11 04:46 · `81b4302db46e25c31d0480d232cb79cc` · run 1011-f679dc (Bastion Security Inc., evidence): after the coverage fix; 6/6 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 04:54 · `ded48ea6ad9529088706079bafa3abfe` · run 1011-257f61 (Bastion Security Inc., evidence): after the coverage fix; 6/6 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 05:03 · `ef7cbfa5c43720b57e212318e8d4aba3` · run 1011-3cd178 (Ledgerly Payments Inc., evidence): fault injection crustdata:429 + llm:429; 5/5 planted, 0 false alarms, 0 fallback hops recorded (one gemini-3.1-flash-lite fallback call happened; the counter missed it until `de18e4f`).
- 2026-10-11 05:08 · `60b5ee52695e0b117c49c8d44992c52d` · run 1011-4d998b (Bastion Security Inc., evidence): fault injection crustdata:429 + llm:429; 6/6 planted, 0 false alarms, 0 fallback hops recorded (one gemini-3.1-flash-lite fallback call happened; the counter missed it until `de18e4f`).
- 2026-10-11 05:30 · `9254be96468c5c234473b080cb6cd216` · run 1011-777bb7 (Acme Observability Inc., evidence): after the audit line-item fix; 5/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 05:37 · `56891cde8dd9038fbf37d9551f11efad` · run 1011-5eb1a9 (Acme Observability Inc., evidence): after the audit line-item fix; 5/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 05:44 · `8e06009c9c9edde53af208f08d6d135c` · run 1011-ac4bf5 (Acme Observability Inc., evidence): after the audit line-item fix; 5/5 planted, 0 false alarms, 0 fallback hops.
- 2026-10-11 16:03 · `139c076ca99acaf06901377eeadee8c1` · run 1011-324f77 (Acme Observability Inc., evidence): case study 02 rerun, BEFORE (fix reverted, d311fb5): 3 competitor substitutions, 2 of 5 chosen peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:13 · `1a44aa4ab5a1639bcd4c717331bb6b4a` · run 1011-45b4f4 (Acme Observability Inc., evidence): case study 02 rerun, BEFORE (fix reverted, d311fb5): 3 competitor substitutions, 2 of 5 chosen peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:21 · `5ac7dfbf67c150363b148f4c8f29b935` · run 1011-e6132c (Acme Observability Inc., evidence): case study 02 rerun, BEFORE (fix reverted, d311fb5): 3 competitor substitutions, 2 of 5 chosen peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:29 · `d6161cf81ecb0e543ec46d5c1d1b1f7a` · run 1011-2c53f4 (Acme Observability Inc., evidence): case study 02 rerun, BEFORE (fix reverted, d311fb5): 3 competitor substitutions, 2 of 5 chosen peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:39 · `5ed5fa88833bdb19058c5c068cc26719` · run 1011-e8b645 (Acme Observability Inc., evidence): case study 02 rerun, BEFORE (fix reverted, d311fb5): 3 competitor substitutions, 2 of 5 chosen peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:03 · `2d28f557b12e42454b035de19eeb1ff0` · run 1011-efdab4 (Acme Observability Inc., evidence): case study 02 rerun, AFTER (current code): 0 substitutions, 5 of 5 peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:11 · `0756f9d7f7d9d52a490222261d3824b9` · run 1011-51f5c4 (Acme Observability Inc., evidence): case study 02 rerun, AFTER (current code): 0 substitutions, 5 of 5 peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:17 · `2a7e255d1182a16ef2fba3a1bd62ffbb` · run 1011-6d3ba6 (Acme Observability Inc., evidence): case study 02 rerun, AFTER (current code): 0 substitutions, 5 of 5 peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:23 · `927c096b9a1b4fac3b587f866c71d833` · run 1011-1078e9 (Acme Observability Inc., evidence): case study 02 rerun, AFTER (current code): 0 substitutions, 5 of 5 peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 16:31 · `098a8bc9808af2151c277a2b01315bb1` · run 1011-09fd9f (Acme Observability Inc., evidence): case study 02 rerun, AFTER (current code): 0 substitutions, 5 of 5 peers kept; 5/5 planted, 0 fallback hops.
- 2026-10-11 21:38 IST · `561e07ead7f7bfbf3b3ee20e87a8abcc` · real invoices, real-invoices (first harness) (real_invoices_gt.json): 7/12 totals correct (case study 06).
- 2026-10-11 21:42 IST · `816e23b211567d77b025872e1bb0d8a6` · real invoices, real-before-prompt-v2 (real_invoices_gt.json): 6/12 totals correct (case study 06).
- 2026-10-11 21:43 IST · `1fe1b76ffa3784f67c388093cae9b41b` · real invoices, real-before-prompt-v2 (real_invoices_gt.json): 5/12 totals correct (case study 06).
- 2026-10-11 21:44 IST · `486c4a926fc14752bc2c87717358de41` · real invoices, real-before-prompt-v2 (real_invoices_gt.json): 5/12 totals correct (case study 06).
- 2026-10-11 21:46 IST · `36f7827e6ac6c02ca5c95f2188f45da8` · real invoices, real-after-prompt-v2 (real_invoices_gt.json): 12/12 totals correct (case study 06).
- 2026-10-11 21:47 IST · `bb363b38437d8b665bb19e0fd3c31807` · real invoices, real-after-prompt-v2 (real_invoices_gt.json): 12/12 totals correct (case study 06).
- 2026-10-11 21:48 IST · `7c65a3da6faf8e4d6985bd6ed712bdbf` · real invoices, real-after-prompt-v2 (real_invoices_gt.json): 12/12 totals correct (case study 06).
- 2026-10-11 21:51 IST · `2b6af65f4e8cbad311d58e955c8900c3` · real invoices, heldout-prompt-v1 (real_invoices_heldout_gt.json): 6/12 totals correct (case study 06).
- 2026-10-11 21:53 IST · `b81d454b66b94846f6bc30260687af4d` · real invoices, heldout-prompt-v1 (real_invoices_heldout_gt.json): 7/12 totals correct (case study 06).
- 2026-10-11 21:54 IST · `2ce86cba4c400c6dbaaf0cb70b82480b` · real invoices, heldout-prompt-v1 (real_invoices_heldout_gt.json): 7/12 totals correct (case study 06).
- 2026-10-11 21:55 IST · `28cbcce7f2808041468d0f67e65f3b03` · real invoices, heldout-prompt-v2 (real_invoices_heldout_gt.json): 12/12 totals correct (case study 06).
- 2026-10-11 21:56 IST · `9e9a2708a2fe2759df60f4a31749a574` · real invoices, heldout-prompt-v2 (real_invoices_heldout_gt.json): 12/12 totals correct (case study 06).
- 2026-10-11 21:57 IST · `7182ef015c37b912412faf51363a10f9` · real invoices, heldout-prompt-v2 (real_invoices_heldout_gt.json): 12/12 totals correct (case study 06).
- 2026-10-11 23:13 IST · `cf55d24ac3f01006d112520a22cd57db` · real invoices, third-v2 (real_invoices_third_gt.json): 11/12 totals correct (case study 07).
- 2026-10-11 23:14 IST · `fb6a8835526576f1dd45e1407523541a` · real invoices, third-v2 (real_invoices_third_gt.json): 11/12 totals correct (case study 07).
- 2026-10-11 23:15 IST · `1bf5ec7534603b06e47966cbef5711bd` · real invoices, third-v2 (real_invoices_third_gt.json): 11/12 totals correct (case study 07).
- 2026-10-11 23:16 IST · `340027bf9eaa50f6c9f58f50e87e6b48` · real invoices, third-v3 (real_invoices_third_gt.json): 11/12 totals correct (case study 07).
- 2026-10-11 23:17 IST · `f292a68bebee0164874bc62f26671155` · real invoices, third-v3 (real_invoices_third_gt.json): 11/12 totals correct (case study 07).
- 2026-10-11 23:18 IST · `043440bbf840a96878de2dafcdb14fa7` · real invoices, third-v3 (real_invoices_third_gt.json): 11/12 totals correct (case study 07).
- 2026-10-11 23:19 IST · `fca38dfdeefc437117cc4650ed3b9578` · real invoices, tuned-v3 (real_invoices_gt.json): 12/12 totals correct (case study 07).
- 2026-10-11 23:20 IST · `5ce4da1caa71da22076242a88807f342` · real invoices, tuned-v3 (real_invoices_gt.json): 12/12 totals correct (case study 07).
- 2026-10-11 23:21 IST · `4d729b6277ec53f5aaa71f12c5b3192f` · real invoices, tuned-v3 (real_invoices_gt.json): 12/12 totals correct (case study 07).
- 2026-10-11 23:22 IST · `7918b737c9aba2024f7bb996c2480599` · real invoices, heldout-v3 (real_invoices_heldout_gt.json): 12/12 totals correct (case study 07).
- 2026-10-11 23:23 IST · `11f7b26851b67a1be786c8067b692686` · real invoices, heldout-v3 (real_invoices_heldout_gt.json): 12/12 totals correct (case study 07).
- 2026-10-11 23:24 IST · `38356fb2ad0cfc6dee50fbf231b5bb81` · real invoices, heldout-v3 (real_invoices_heldout_gt.json): 12/12 totals correct (case study 07).
- 2026-10-11 17:42 · `1ffa27413826a1a487d5d996f88b1111` · run 1011-c4ebfc (Acme Observability Inc., evidence): agent fixes v3 + title unwrap (30ab6c9); 5/5 planted, 0 fallback hops.
- 2026-10-11 17:47 · `fb99e7d209c06e4d89a628fa6f6238d0` · run 1011-2a8424 (Acme Observability Inc., evidence): agent fixes v3 + title unwrap (30ab6c9); 5/5 planted, 0 fallback hops.
- 2026-10-11 17:54 · `b29772f60503b18971ef87ba99da5c1c` · run 1011-2a9596 (Acme Observability Inc., evidence): agent fixes v3 + title unwrap (30ab6c9); 5/5 planted, 0 fallback hops.
