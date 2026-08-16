# Automated Multi-Platform Client Reporting Dashboard — Project Spec

**Status:** Complete and published. Google Sheets dashboard, Apps Script automations (Report Generator, PDF export, per-client email alerts), the posting-cadence correlation view, and the aesthetician-only GA/store conditional section are all built, tested, and live. A full per-sheet number-formatting and conditional-formatting pass, plus column/row sizing and a custom-date-range input flow (Apps Script `onEdit` trigger with format-validated prompts), were completed as polish beyond the original scope.
**Tool:** Google Sheets + Apps Script (no Excel/Power Query — see §8)
**Time range:** 2 years of synthetic post-level + funnel data (2024-01-01 to 2025-12-31), enabling year-over-year comparison as a showcased feature

---

## 1. Why this project

Extends the same real-world story as the Marketing Analytics Dashboard (Tableau) — the manual cross-platform reporting grind at MyCreationLab — but closes a skill gap neither of the other two projects covers: **spreadsheet engineering and workflow automation** (advanced formulas, dynamic dashboards, Apps Script-driven automation). Where the Tableau project shows BI/visualization skill, this one shows the "build the tool that replaces the manual work" skill.

## 2. Clients & channel mix

Deliberately uneven channel counts (2/2/2/3) — mirrors real agency work where not every client is on every platform, and forces the lookup/dashboard logic to handle variable client shapes rather than a uniform grid.

| Client | Channels | Notes |
|---|---|---|
| Chiropractor | Instagram, Facebook | Local-service, community trust |
| Aesthetician | Instagram, TikTok, **+ GA/online store (flagship)** | Full funnel — see §4. Store is his **primary income source**, ahead of in-person procedures (various countries) and consulting — sized as an established business, not a side-store |
| Real estate agent | Facebook, YouTube | Listing walkthroughs on YouTube |
| Vlogger | YouTube, TikTok, Instagram | 3 channels — stress-tests dashboard with uneven client shape |

## 3. KPIs per platform

Platform-native metrics, rolled up into shared columns for the unified cross-platform dashboard.

| Platform | Native KPIs |
|---|---|
| YouTube | Views, Watch Time (hrs), Subscriber Growth, Likes, Comments, Engagement Rate |
| Instagram | Reach, Likes, Comments, Shares, Saves, Follower Growth, Engagement Rate |
| Facebook | Reach, Reactions+Comments+Shares, Page Follower Growth, Engagement Rate |
| TikTok | Views, Likes, Comments, Shares, Follower Growth, Engagement Rate |

**Common rollup columns (drive the unified master dashboard):** Reach/Views · Total Engagements · Engagement Rate · Follower Growth

- **Reach/Views** = exposure (did anyone see it)
- **Total Engagements** = raw interaction volume
- **Engagement Rate** = Engagements ÷ Reach — the real "is it working" number, normalized for account size
- **Follower Growth** = long-term trust-building, moves independently of engagement
- **Watch Time** (YouTube only) = retention signal

## 4. Funnel / conversion layer (tiered by client — asymmetric on purpose)

One deep full-funnel flagship + three lightweight, business-relevant conversion metrics. Full parity across all four was considered and deliberately rejected — it would quadruple the data/joining work without adding a meaningfully different technique to demonstrate.

| Client | Conversion layer | Data source |
|---|---|---|
| **Aesthetician (flagship)** | Full funnel: Sessions, Users, **dual Conversion Rate** (non-social vs. social-sourced — social-sourced converts higher, primed by content), Orders/Revenue, **New vs. Returning Customer split**, **Black Friday/Cyber Monday spike**, Traffic Source split (Social vs Direct/Search/Other). See §9 for current ranges. | Separate synthetic GA + online store data, joined to social data by date for a correlation view (see honesty note below) |
| Real estate agent | Inquiries → Showings → Closed deals (thin funnel, not just top-of-funnel inquiries) | One extra set of columns added to existing social data |
| Chiropractor | Booking inquiries + show-up rate + New vs. Returning inquiry split | One extra set of columns added to existing social data |
| Vlogger | Unified est. monetization: ad revenue as the base, plus an occasional sponsorship spike layered on top (single column, not two separate systems) | Post-level attribution (which upload drove which monetization spike) — structurally different from the aesthetician's continuous GA sessions |

**Shared schema addition — done, all four clients:** every client has a `primary_outcome_count` + `primary_outcome_label` column pair — Completed Visits for the chiropractor, Closed Deals for real estate, Est. Revenue for the vlogger, Orders for the aesthetician — so the dashboard (§6) can render "this month's {primary_outcome_label}: {primary_outcome_count}" generically, with zero client-specific branching in Apps Script. The aesthetician's pair was retrofitted into Cell 9 after the gap was caught (it was missing when Cells 13–15 were built, since only Cells 10–12 had originally added it) — same two-line pattern as the other three clients, added right after `revenue` is computed.

**Pre-Cell-10 modifications (before building the three remaining conversion layers):**
1. **Cap verification (Cell 9):** confirm the 4%/8% conversion-rate caps are actually non-binding as claimed — a one-line check (count of rows at/above the cap) turns that from an assumption into a verified fact in the notebook.
2. **Cadence independence check (Cells 2–3):** confirm posts/week is a genuinely independent input, not derived from the same formula that drives engagement — otherwise the future posting-cadence correlation view (§7.3) would be circular, discovering a relationship that was accidentally baked in.
3. **Shared schema columns** (above) built into all three new clients from the start.

**Honesty note on the aesthetician's social→sales link:** because this link is coded into the generator (social-sourced sessions get their own conversion mechanic), it's *causal by construction* in this dataset — not something discovered from evidence, the way it would be on real data. The "correlation, not causation" framing describes the right *analysis technique* to demonstrate on the dashboard (posting-cadence vs. performance, traffic-source vs. revenue, etc.) — but the honest caveat is that this project demonstrates *how to investigate* that relationship on real data, not proof that social drives sales here.

## 5. Seasonality (international/generic market, 2-year range)

| Client | Seasonal pattern |
|---|---|
| Real estate agent | Spring/summer listing surge, slower winter, minor bump early fall |
| Chiropractor | January New Year's fitness spike, spring/fall marathon-season bumps, summer sports-injury upticks, slower mid-winter lull |
| Aesthetician | Pre-summer skin-prep spike (May–June), holiday bridal + gifting spike (Nov–Dec, with a distinct sharp BFCM spike layered on top — see §9), June wedding-season bump |
| Vlogger | One seasonal engagement dip (vacation/back-to-school window) + one algorithm-change dip unrelated to content quality (sudden onset, ~2-week gradual recovery, Year 2 only) |

## 6. Architecture — Option B (one workbook, one system)

**Actual tab chain, as built (raw → staging → master → dashboard):**
- **Raw data tabs (done)** — `raw_youtube_posts`, `raw_instagram_posts`, `raw_facebook_posts`, `raw_tiktok_posts` (one per platform, all clients mixed together with a `client` column), plus `raw_aesthetician_ga_store`, `raw_chiropractor_conversion`, `raw_real_estate_conversion`, `raw_vlogger_monetization`, `raw_anomaly_metadata`. All lowercase_with_underscores, exact CSV filenames.
- **Staging tabs (done)** — `stg_posts` (all 4 platform tabs stacked, 2,933 rows), `stg_posts_daily` (grouped to one row per date+client, 1,826 rows — sparse, only dates a client actually posted), `stg_conversions` (the 4 conversion tabs stacked with a manually-added client label, 2,924 rows — dense, every date × every client), `stg_followers_by_platform` (9 client-platform pairs, each in its own merged-label 2-column block, used specifically for follower forward-fill — see §12).
- **Master Data tab (done)** — `master_data`, one row per (date, client), 2,924 rows: `date`, `client`, `total_followers`, `reach_views`, `total_engagements`, `engagement_rate`, `follower_growth`, `primary_outcome_count`, `primary_outcome_label`. Built via `QUERY`/`SUMIF`/`LOOKUP` chains, not Apps Script — Apps Script is reserved for §7's add-ons, not the core merge layer.
- **Dashboard tab (done)** — client-selector dropdown showing pretty display names ("Aesthetician," "Real Estate Agent," etc.) that translate to the internal snake_case key via a hidden `VLOOKUP` cell. Date-range picker with fixed calendar-period presets (2024, 2025, each quarter, All Time, Custom with a real calendar-picker + locale-correct validated bounds). Six KPI cards pulling filtered numbers from Master Data via the selected client + date range.
- **Report Generator (Apps Script)** — reads the currently selected client, exports a formatted, client-specific report on demand. Menu-driven ("Reports" custom menu), single source-of-truth read (`readCurrentSnapshot()`) shared by both snapshot logging and PDF export so they can never drift apart. Snapshots append to `report_log` with colors baked in at write-time via `setBackground()` (not live conditional formatting), matching the dashboard's exact threshold bands.
- Aesthetician's GA/store section appears only when that client is selected — expected asymmetry, not a bug to hide. 7-field summary (Total Sessions, Social/Non-Social Mix, Non-Social & Social Conversion Rate, Revenue, AOV, Orders Shortfall vs. Baseline) on `dashboard!F5:G12`, fully `IF($B$2="aesthetician", ..., "")`-wrapped including labels (not just values — an early version left labels static, corrected). Revenue and AOV also carry prior-year + % change columns (H/I). Social Conversion Rate and Orders Shortfall carry YoY-based conditional-formatting flags (same ±5%/±15% bands as the KPI cards); a 3-tier fill (no-fill for non-aesthetician, gray for aesthetician-but-no-prior-year, then green/yellow/red) replaced an earlier 2-tier version that conflated those two states. Section background color (headers/non-flagged cells) uses `=$B$2="aesthetician"` as a conditional-formatting rule rather than static fill, so it reacts correctly to the dropdown instead of staying colored for every client.

**Date-range picker UX addition (beyond original scope):** switching to "Custom" now triggers an Apps Script `onEdit` prompt flow — asks for start date, then end date, in a strictly validated `yyyy-mm-dd` format (regex-checked, explicit example using day 31 to avoid month/day ambiguity), writes them into the custom-input cells, and clears those cells automatically when switching away from "Custom" to any preset. Fixes a real bug where stale custom dates caused divide-by-zero crashes across both the KPI cards and the GA/store section when switching from Custom to a preset without manually clearing the custom cells first.

**Date-range picker design note:** presets are fixed calendar periods (2024, 2025, Q1 2024...Q4 2025, All Time), not rolling "Last 30/90 Days" windows. Rolling windows are meaningless against a frozen, non-live dataset — there's no real "today" to roll from, so "This Month" would permanently mean the same fixed month forever, which isn't actually a *rolling* window at all. Fixed calendar periods are the honest fit for a static 2-year historical export; a true rolling-window feature is a legitimate future addition once/if this ever sits on Apps Script triggers with a real "today." **Hard boundary:** custom date entry is restricted (via data validation) to 2024-01-01–2025-12-31 — a structural limit of synthetic data, not a feature gap.

## 7. The 3 add-ons (+ 1 cut)

1. **Auto-alert on KPI dip** — **built.** Reframed from "runs on refresh" to a manual menu trigger ("Check All Clients for Alerts") once it became clear daily/scheduled alerts don't make sense against a frozen dataset — a scheduled check would just re-report the same result every time. Sends **4 independent, per-client emails** (not one combined alert), each only when that specific client has a real red flag on the most recently completed quarter (computed directly from `master_data`, independent of whatever's currently selected on the dashboard) — a client's stakeholder should only see their own numbers. Recipients configurable per client via `CLIENT_EMAILS`.
2. **Auto-export report as PDF** — **built.** Reads the live dashboard state directly (shares `readCurrentSnapshot()` with the snapshot logger, so PDF and log can never show different numbers), builds a temporary formatted one-page sheet (dark header band, client name, period, colored KPI table matching the dashboard's flag colors, top-left anchored with internally centered/padded table cells per final design), exports via the spreadsheet's PDF export endpoint, saves to Drive, deletes the temp sheet. Completes the original "one-click, client-ready" pitch for real.
3. **Posting-cadence vs. performance correlation** — **built**, see full write-up below.
4. **Auto-refresh trigger** — **cut, deliberately.** Originally scoped as a Build Phase 7 item alongside the other three. On inspection, "auto-refresh" presumes live data to refresh into — this dataset is a static, one-time synthetic import with no new rows ever arriving, so there's nothing for a refresh to actually do. Reframing it as "a scheduled trigger that re-runs the alert/snapshot functions on a timer" was considered and rejected too, since a timer re-checking a frozen dataset only ever produces the same result — automation with no real function to serve. Cut for the same reason rolling date windows and a 3rd synthetic data year were cut earlier in this project: a technically-present feature with no functional purpose isn't worth building just for scope completeness.

**Built as:** `stg_posting_cadence` (weekly post_count + reach/engagement rollups per client, grouped via `QUERY` off a Monday-anchored `week_start` helper column in `stg_posts`) feeding two views — a dashboard-dropdown-reactive `QUERY`-pivot in `correlation_view` (dynamic, follows `$B$2`), plus a literal native Sheets pivot table (`pivot_posting_cadence`) as a secondary reference artifact, since a real pivot table's filter can't natively follow a cell reference.

**Findings, checked across all 4 clients (real signal, not a bug):**
- **Aesthetician** — near-flat posting cadence (mostly 6–8/week), engagement rate choppy but not clearly tracking post count. Weak/no visible correlation.
- **Chiropractor & Real Estate Agent** — cadence varies more week to week (2–4 range), and engagement rate shows more visible co-movement with it than the aesthetician does. Best candidates for a "here's where it shows up" example.
- **Vlogger** — posting cadence is a flat, unchanging 15/week across the entire 2-year range. No variance in the x-axis means correlation is **undefined for this client**, not just weak — there's structurally nothing to correlate engagement rate against.

**Takeaway:** the relationship between posting cadence and performance isn't universal — it depends on whether a given client's posting behavior actually varies at all. A client on a fixed schedule (vlogger) makes the question inapplicable, not just unanswered. This is a more nuanced, defensible finding than a single blanket "cadence doesn't matter" takeaway, and it's consistent with (not a repeat of) the Tableau project's cadence-independent finding.

## 8. Tool note: Google Sheets vs Excel

No functional loss for what this project needs:
- XLOOKUP, INDEX-MATCH, pivot tables, conditional formatting — all native, no compromise
- No GUI "Power Query" — but `QUERY()` (SQL-like, cell-native) + Apps Script cover cleaning/merging, arguably with more flexibility
- Macros → Apps Script (JS-based) — full programmatic control instead of VBA macro-recording, and supports time-based triggers (auto-refresh without the file open), which VBA can't do standalone

## 9. Baseline metrics & posting cadence (finalized)

"Normal week, nothing special happening" numbers — seasonality (§5), funnel layers (§4), and anomalies get layered on top of these during code generation.

| Client | Platform(s) | Follower range | Posting cadence |
|---|---|---|---|
| Chiropractor | Instagram, Facebook | 5,000–40,000 | 1–2 posts/week |
| Real estate agent | Facebook, YouTube | 8,000–70,000 | 1–2 posts/week |
| Aesthetician | Instagram, TikTok | 50,000–500,000 | 3–4 posts/week |
| Vlogger | YouTube, TikTok, Instagram | 200,000–4,000,000 | ~5 posts/week per platform |

**Funnel/conversion baselines (normal week) — updated from original draft:**

| Client | Conversion metric | Baseline range |
|---|---|---|
| **Aesthetician (GA/store)** | Baseline (non-social) Sessions/day | **500–900** *(was 80–250 — rescaled: store is his primary income, sized as an established business)* |
| | Non-social Conversion Rate | **1.0–2.5%**, seasonally lifted (~40% the strength of the traffic lift), capped at 4% |
| | Social-sourced Conversion Rate | **2.5–5.0%**, boosted further by that day's engagement rate, capped at 8% |
| | Social click-through | **1.5–4% of that day's combined-platform `total_engagements`** becomes a session, with a ~2-day decay tail *(originally based on reach — reach is impressions-scale, so even a small % of it overran the non-social baseline; switched to engagements, a smaller "warmer" pool, then tightened from an initial 3–9% down to 1.5–4% after that still landed social at ~47% of total sessions, too dominant for a referral/word-of-mouth-heavy local business — 1.5–4% lands social at ~25–30% of total, the target)* |
| | Avg order value (AOV) | **$55–$95**, with ~8% drift upward over the 2 years *(was $35–$1,000)* |
| | New vs. Returning Customer split | Returning share rises slowly over the 2 years (repeat-purchase product line) |
| | Black Friday/Cyber Monday spike | 1.8–2.5x multiplier, ~4-day window, late Nov each year — distinct sharp event on top of the smooth seasonal ramp |
| Real estate agent | Inquiries per week | 3–10 (unchanged) |
| | Showing rate | **45–65%** of inquiries convert to a scheduled showing |
| | Close rate | **6–12%** of showings *from ~35 days earlier* result in a close, Poisson-drawn (rare, discrete events, not a rounded fraction) — **35-day closing lag** modeled explicitly |
| Chiropractor | Bookings/week | 8–20 (unchanged) |
| | Show-up rate | **75–90%** base, with a seasonal dip in Nov–Dec (holiday travel/schedule chaos → more no-shows) |
| | New vs. Returning inquiry split | **40% → 55%** returning over the 2 years — higher-starting than the aesthetician's 30%-to-55%, since chiropractic returning visits sit within one active multi-session treatment plan (weeks apart, not months) |
| Vlogger | Est. monetization *(replaces "Merch sales per video" — see §4)* | Ad revenue: blended RPM **$0.3–1.5/1,000 views** across YouTube/TikTok/Instagram, scales directly off actual daily `reach` (inherits growth/seasonality/algo-dip for free). Sponsorship: **3–8%** of posts flagged sponsored, valued at **$0.002–0.007/follower** — corrected down from an initial pass that produced an implausible ~$10M/yr; final result lands ~$1.5M/yr total (sponsorship > ad revenue, matching how most real creators' income splits) |

Per-post reach/views and engagement-rate baselines are derived proportionally from the follower ranges above during code generation, rather than hardcoded separately — keeps the two tables from drifting out of sync as follower counts scale.

**Reproducibility note:** Cells 7–15 each use their own dedicated seeded random generator (`random.Random(107)` through `(115)` + matching `np.random.default_rng()`), instead of the shared global seed from Cell 1. Real bug this fixes: Python's `random` module and numpy's legacy `np.random.*` share one internal state across the whole notebook — re-running any single cell mid-session (common while debugging) shifts every random draw after that point, even after a kernel restart, unless every cell is re-run exactly once top-to-bottom with zero repeats. Per-cell dedicated generators make each cell's output depend only on its own code, regardless of what ran before it. Cells 1–6 still use the shared global seed and haven't shown this problem in practice — not retrofitted, low priority unless they start getting re-edited.

**Additional caveat for Cells 13–15 (anomaly injection):** these three go a step further than "reproducible" — they're **not safely re-runnable within a session at all**, dedicated generator or not. Cells 7–12 only ever *add* new columns, so re-running one mid-session just recomputes the same columns identically. Cells 13–15 *mutate* existing data in place (`final_df` row drops, `chiro_df`/`re_df`/`ga_df` value rescaling) — running one twice without a full kernel restart + top-to-bottom re-run will suppress the affected numbers a second time.

## 10. Project structure (local + GitHub — single unified layout)

**Documentation plan (as published):** `reporting-automation-spec.md` (this doc), `python_cheat_sheet.md`, and `google_sheets_cheat_sheet.md` live in `docs/` and ship to GitHub. `python_deep_dive.md` and `cheat_sheet.md` stay local-only, excluded via `.gitignore`. `README.md` lives at the repo root as the single public-facing landing page.

| File | Purpose | GitHub? |
|---|---|---|
| `reporting-automation-spec.md` | This doc — every decision made, why, and the project structure. | Public — `docs/` |
| `python_deep_dive.md` | Cell-by-cell code walkthrough — what each function does, how it works, plus reasoning notes from along the way. | Local-only |
| `python_cheat_sheet.md` | Teaching-style doc covering everything the notebook does, explained from first principles for anyone reading the code cold. | Public — `docs/` |
| `google_sheets_cheat_sheet.md` | Same teaching approach for the Sheets/formula side — every technique used across the dashboard build. | Public — `docs/` |
| `cheat_sheet.md` | Personal reference notes. | Local-only |
| `README.md` | Project overview + links to the live dashboard and the other two projects in the series. | **Public** — repo root |

One consistent naming scheme used identically on-device and on GitHub — no renaming step before publishing, since that renaming step was what caused a publishing error on an earlier project when its folder was moved.

```
reporting-automation-dashboard/
├── data/                 → all CSVs exported from the notebook (Cell 17)
│   ├── youtube/          → youtube_posts.csv (real estate agent, vlogger)
│   ├── instagram/        → instagram_posts.csv (aesthetician, chiropractor, vlogger)
│   ├── facebook/         → facebook_posts.csv (chiropractor, real estate agent)
│   ├── tiktok/           → tiktok_posts.csv (aesthetician, vlogger)
│   ├── ga_store/         → aesthetician_ga_store.csv — aesthetician-only GA/e-commerce funnel
│   ├── conversions/      → chiropractor_conversion.csv, real_estate_conversion.csv,
│   │                       vlogger_monetization.csv — daily conversion layers for the other
│   │                       three clients (same kind of data as ga_store, sibling folder)
│   └── anomaly_metadata.csv  → spans all four clients, sits at the data/ root
├── notebooks/            → data_generation.ipynb — the standalone data-generation notebook
├── apps_script/          → report_generator.gs — Report Generator, PDF export, email alerts,
│                           custom-date onEdit trigger, manually copied out of the bound
│                           Apps Script editor to keep in sync
├── docs/                 → reporting-automation-spec.md (this doc), python_cheat_sheet.md,
│                           google_sheets_cheat_sheet.md — public. python_deep_dive.md and
│                           cheat_sheet.md stay local-only, excluded via .gitignore
├── images/
│   ├── dashboard/        → screenshots of the live dashboard (KPI cards, YoY formatting,
│   │                       Report Generator output, GA/store section, etc.)
│   └── python_charts/    → seasonality/anomaly plots generated in the notebook
├── .venv/                → local-only, gitignored
├── .gitignore            → excludes .venv/, docs/python_deep_dive.md, docs/cheat_sheet.md
└── README.md             → project overview + links to the live dashboard and the other
                            two projects in the series — the repo's landing page
```

Data organized **by platform** (not by client) — one folder per platform, all clients mixed inside with a `Client` column — matches how the raw tabs in Sheets will actually be structured, keeping local files and Sheets tabs mentally 1:1.

Local path: `T7 Shield/Work 2nd/Projects/reporting-automation-dashboard/`
GitHub: `kartik720/reporting-automation-dashboard` (own repo, sibling to `rfm-segmentation` and `marketing-analytics-dashboard`)

## 11. Anomaly injection (done — Cells 13–16)

Per-client realistic anomalies, not one shared "bad month" event — same deliberately-uneven design language used everywhere else in this spec (channel mix, seasonality, funnel tiering). A synchronized dip across all four clients would look like a data error, not range.

| Client | Anomaly scenario | Window | Suppression | Cell |
|---|---|---|---|---|
| Real estate agent | Personal gap compounding the already-slow winter season | 2024-12-07 to 2024-12-17 (11d) | ~37% inquiries; closed_deals via binomial thinning | 14 |
| Chiropractor | Owner takes a 2–3 week vacation/injury break, stops posting | 2025-02-08 to 2025-02-21 (14d) | ~15% booking inquiries | 13 |
| Vlogger | Algorithm-change dip (pre-existing, Cell 5) | 2025-03-10, 5 weeks | 30% reach/engagement | 5 |
| Aesthetician | Negative review-cycle shock, deliberately timed through BFCM | 2025-11-15 to 2025-12-08 (24d) | ~48% conversion rate | 15 |

**Design notes worth remembering:**
- **One anomaly type per client**, staggered across both years (2024: real estate; 2025: the other three, spread Feb/Mar/Nov) so no two compete for attention in the same stretch and YoY comparisons still carry signal.
- **Two anomalies target the top of the funnel** (posting cessation + inquiry suppression: chiropractor, real estate), **one targets the bottom** (aesthetician — sessions/traffic left completely untouched, only conversion rate suppressed) — deliberately different shapes, not the same mechanism copy-pasted three times.
- **Real estate's closed_deals required binomial thinning, not an independent Poisson redraw.** Rare-event caveat: closed_deals is ~0.03–0.09/day baseline, and an independent redraw at a lower lambda isn't guaranteed to go down — it can land higher by pure chance (confirmed: it did, on the first attempt). Thinning the *original* draws by the suppression ratio can only ever reduce the count, and is the more mechanistically honest model besides.
- **Aesthetician's shock exposed a real analysis trap, deliberately kept rather than avoided:** the window overlaps BFCM, where the traffic surge (+58%) is large enough to roughly cancel out the ~48% conversion suppression numerically — actual daily orders stay *flat* through the shock, not visibly down. Added an `orders_expected_baseline` / `orders_shortfall` counterfactual column pair (actual sessions × original conversion rate) specifically so the effect is visible and honest instead of hidden by the raw orders trendline.
- **Cells 13–15 mutate data in place** (see the reproducibility note above) — not safely re-runnable without a full kernel restart.
- **Cell 16** combines all four clients' anomaly metadata (including the vlogger's, assembled for the first time from Cell 5's constants) into one `anomaly_metadata_df`, with a `suppression_multiplier` column pulled directly from each cell's own variables (not hand-retyped, so it can't drift out of sync) and a Gantt-style timeline plot confirming no overlap/clustering.

## 12. Google Sheets build — key lessons

Worth remembering beyond this project, not just project-specific trivia:

- **`SUMIFS` with two array criteria doesn't reliably vectorize inside `ARRAYFORMULA`.** With multiple criteria at once, Sheets often evaluates it only once instead of looping down the full range — the formula silently fills just the first row instead of spilling. Fix: build a single concatenated key column (e.g. `date&"|"&client`) and match against that with plain `SUMIF`, which does vectorize correctly.
- **Followers is a stock/snapshot metric, not a flow — this was a real bug, not a style choice.** `total_followers` was originally built via `SUMIF` against post-level data, which returns 0 on any day a client didn't post. That's correct for flow metrics (reach, engagement — genuinely zero if nothing happened that day) but wrong for a stock metric (an account doesn't lose all its followers on a day it didn't post). The zero-fill was corrupting `follower_growth`, producing nonsensical single-day swings as large as the metric's entire value. **Fix:** built `stg_followers_by_platform` (9 client-platform pairs, sorted ascending) and used `LOOKUP`'s approximate-match behavior — "find the largest date ≤ this one" — to forward-fill each platform's last known follower count on non-posting days, summing only the platforms each client actually uses. Precision matters here: summing at the *client* level without this would still undercount on days only one of a client's platforms posted.
- **Google Sheets data validation is locale-sensitive when boundary values are typed manually.** A day-first-typed date (`31/12/2025`) silently fails to register as a real date under a month-first (US) locale — the rule doesn't error, it just stops enforcing anything, since it can't evaluate "between" against an unparseable boundary. Always type validation boundaries in the sheet's actual locale format; confirm via File → Settings → Locale rather than assuming.
- **A single cell can only hold one active data validation rule at a time.** Adding a second rule to an already-validated cell replaces the first rather than stacking — lost the calendar-picker behavior this way once, by adding a custom-formula rule on top of an existing Date rule.
- **Data validation only checks values at the moment of entry, never retroactively.** A value already sitting in a cell before a rule was added/tightened stays there unchecked until something new is typed into that specific cell — worth keeping a formula-level safety net (e.g. `IF(AND(...), "Invalid range", ...)`) for values that predate or bypass a validation rule.
- **Conditional formatting formulas with a relative row reference silently shift when applied to a multi-cell "Apply to range" list.** A rule using `$D9` (column locked, row relative) applied to a combined range like `B9,B11` doesn't check `$D9` and `$D11` respectively — Sheets shifts the relative row per cell in the list the same way a dragged formula would, landing on the wrong row for every cell after the first. Symptom looked like random inconsistent flag colors, not an obvious formula error. **Fix:** always fully lock both column and row (`$D$9`, not `$D9`) in conditional formatting formulas, and prefer single-cell "Apply to range" scoping over combined ranges even once references are absolute — debugging a shared rule across multiple cells is meaningfully harder than debugging one cell at a time.
- **Labels need the same conditional-blanking treatment as values, not just values.** Wrapping a value cell in `IF($B$2="aesthetician", ..., "")` but leaving its adjacent label cell as static text means the label stays visible (e.g. "Total Sessions") even when the value goes blank for other clients — half-fixed, easy to miss since the value looks correctly handled. Every cell in a conditionally-shown section needs its own `IF` wrapper, labels included.
- **A percent value with a wrong denominator produces a plausible-looking but structurally meaningless flag.** An early Social Conversion Rate flag compared the current-period rate against the same period's Non-Social rate (`$G9 >= $G8*0.9`) rather than against its own prior year — since social converts structurally higher than non-social in this dataset's design (per §9 baselines), that ratio almost never dips below the threshold regardless of what's actually happening, producing an "always green" flag that looked like a working rule but couldn't have caught anything. The fix was switching to the same self-referential YoY pattern already proven on the KPI cards (compare the metric to itself, prior year) rather than inventing a new cross-metric comparison.
- **A flat/no-variance x-axis makes a correlation question structurally unanswerable, not just weakly answered.** The vlogger's posting cadence is a constant 15 posts/week across the full 2-year range (deliberate, reflecting a disciplined content schedule) — there's no variation to correlate engagement rate against, so "does posting more correlate with better engagement" isn't a question with a weak answer for this client, it's a question that doesn't apply. Worth checking a correlation's premise (does the independent variable actually vary?) before interpreting a flat/noisy result as "no relationship."

## 13. Build phases

1. ~~Lock client profiles, channel mix, KPIs, funnel layers, seasonality, baselines, structure~~ ✅ (this document)
2. ~~Generate synthetic raw data (Python → CSV) — staged: base metric ranges per platform → seasonality curves → per-client parameter table → funnel/conversion layers → anomaly injection (bad months) → CSV export~~ ✅ **DONE, Cells 1–17.** Full aesthetician GA/store funnel (7–9), chiropractor (10), real estate agent (11), vlogger (12) conversion layers; anomaly injection for chiropractor/real estate/aesthetician (13–15) plus the vlogger's pre-existing Cell 5 dip; combined anomaly metadata table (16); CSV export to the `data/` folder structure (17), with a row-count sanity check confirming zero silent drops between `final_df` and the four per-platform CSVs. See §11 for the anomaly design summary.
3. ~~Import as raw per-platform tabs in Sheets; build cleaning/merge layer~~ ✅ **DONE.** 9 raw tabs imported; `stg_posts`, `stg_posts_daily`, `stg_conversions` staging tabs built and verified against source CSVs (row counts match exactly, zero drift).
4. ~~Cross-platform lookups into a unified per-client master view~~ ✅ **DONE.** `master_data` built (2,924 rows, date × client grid) with all 9 columns verified. Includes `stg_followers_by_platform` (9 client-platform pairs) and per-platform `LOOKUP`-based forward-fill for `total_followers` — a real stock-vs-flow bug caught and fixed here, not just a lookup exercise (see §12).
5. ~~Pivot tables + KPI dashboard, dropdown-driven per client, with date-range picker (§6)~~ ✅ **DONE.** Dashboard tab's data-selection layer (client dropdown + date-range picker) built and tested; all 6 KPI cards built and verified across every client/date combination with no errors.
6. ~~Conditional formatting KPI flag rules~~ ✅ **DONE.** YoY-based red/yellow/green/gray flags on all 6 KPI cards, absolute-referenced and single-cell scoped after catching the relative-reference/combined-range bug (see §12).
7. ~~Apps Script: one-click report generator, PDF export, email alert on dip~~ ✅ **DONE**, all three. Auto-refresh (originally scoped here) was **cut** — see §7 note. Also includes an unscoped addition: an `onEdit`-triggered custom-date-range prompt flow with strict `yyyy-mm-dd` format validation, fixing a real divide-by-zero crash on stale custom date cells.
8. ~~Posting-cadence correlation view~~ ✅ **DONE.** `stg_posting_cadence` staging tab, dashboard-reactive `QUERY`-pivot in `correlation_view` with a dual-axis combo chart, plus a literal native pivot table (`pivot_posting_cadence`) as a secondary reference artifact. Findings checked and documented across all 4 clients — see §7.
9. ~~Polish, publish, documentation~~ ✅ **DONE.** Notebook markdown-cleanup pass completed — rebuilt as a fully standalone document with zero cross-references to any external doc, every markdown cell and code comment naming a spec section or another file rewritten, code comments standardized to a consistent `# ---- Section ----` header style throughout. A full per-sheet number-formatting and conditional-formatting pass, plus uniform column/row sizing (150px columns, 25px rows, 35px header rows), completed as unscoped polish. All docs finalized; repo published to GitHub.

---
*Living document — update as decisions change during the build. Build Phases (§13) stays as the last section on every future update.*
