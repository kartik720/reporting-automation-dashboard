# Automated Multi-Platform Client Reporting Dashboard

A dropdown-driven, year-over-year-aware social media reporting
dashboard built in Google Sheets + Apps Script, backed by two years of
synthetic multi-platform data for four fictional clients. Modeled on
real manual cross-platform reporting work — the goal was to automate
what used to be a spreadsheet stitched together by hand every month.

Third project in a series: [RFM Segmentation](https://github.com/kartik720/rfm-segmentation) (SQL/Python) →
Tableau Marketing Analytics Dashboard
([Campaign Performance](https://public.tableau.com/views/marketing-campaign-performance/CampaignPerformanceOverview) /
[Social Media Engagement](https://public.tableau.com/views/social_media_engagement/SocialMediaOverview))
→ this one. Where the first two covered analysis and BI visualization,
this project targets spreadsheet engineering and workflow automation
specifically.

**[Open the live dashboard →](https://docs.google.com/spreadsheets/d/1QoUyExvuSc7Q-9Rwma-AdPDiGOgiB44eRMSqh-ZAytI/edit?usp=sharing)**

---

## What it does

- **Filters instantly** by client (Aesthetician, Chiropractor, Real
  Estate Agent, Vlogger) and date range (fixed calendar presets or a
  validated custom range) via two dropdowns
- **Six auto-calculating KPI cards** — Total Followers, Reach/Views,
  Total Engagements, Engagement Rate, Follower Growth, and a
  client-specific primary outcome (Orders / Closed Deals / etc.) — each
  flagged red/yellow/green against the same period last year
- **A dedicated section for the Aesthetician client only**, surfacing
  GA/store-level detail (session sources, conversion rate split,
  revenue, AOV, and a shortfall-vs-baseline counterfactual) that the
  other three clients don't have — shown and hidden automatically based
  on the client dropdown
- **One-click report generation** — logs a colored, timestamped snapshot
  of whatever's currently selected to a running history tab
- **One-click branded PDF export** of the current view, saved directly
  to Drive
- **Per-client automated email alerts** — checks all four clients' most
  recent quarter and emails only the ones with a real red flag, so no
  client's stakeholder sees another client's numbers
- **A posting-cadence vs. performance correlation view**, combining a
  dynamic dropdown-reactive pivot with a native Sheets pivot table

---

## Architecture

```
raw tabs (exactly what the data generator produced, untouched)
    ↓
staging tabs (cleaned, reshaped, still close to raw)
    ↓
master_data (one row per date × client — everything downstream needs)
    ↓
dashboard (the actual report a viewer sees)
```

Same layered pattern real BI/data pipelines use — raw → staged →
modeled → presented — chosen deliberately over one giant formula, both
for debuggability (trace a wrong number back one tab at a time) and as
genuine practice for how professional data tooling is structured.

**Why Google Sheets, not Excel or a BI tool?** Sheets natively covers
everything this needed (`QUERY`, pivot tables, conditional formatting)
plus Apps Script for real automation without leaving the tool — no VBA
or Power Query workaround required. A BI tool was already the focus of
an earlier project in this series; this one deliberately stayed in
spreadsheet territory.

---

## Data

Two years (2024–2025) of synthetic daily post-level and conversion data
for 4 clients across 4 platforms — 9 real client-platform pairs total
(not every client uses every platform, matching realistic client mix).
Generated in Python (seasonality curves, per-client funnel logic, and
one deliberately-injected performance anomaly per client, staggered
across both years so none overlap).

**Known limitation, stated upfront:** because the same process
generates both the social engagement data and the downstream conversion
data, the social-to-sales relationship in this dataset is causal by
construction — a known and expected property of synthetic data, not
something being presented as a real-world finding.

---

## Repo structure

```
data/            synthetic CSV exports
notebooks/       data generation (Python/Jupyter)
apps_script/     Report Generator, PDF export, alerts, custom date input
docs/            reporting-automation-spec.md, google_sheets_cheat_sheet.md,
                 python_cheat_sheet.md
images/          dashboard screenshots, python-generated charts
```

---

## Notable technical decisions

- **Stock vs. flow metrics matter for aggregation.** Follower count is
  a snapshot (stock), not a daily total (flow) — summing it like reach
  or engagement produces a meaningless number. Fixed with a per-platform
  forward-fill.
- **Rates get recomputed from summed components, never averaged
  directly**, and where volume varies day to day, weighted
  (`SUMPRODUCT`) rather than simple-averaged — applied consistently to
  engagement rate, conversion rate, and AOV throughout.
- **Rolling date windows and a 3rd year of synthetic data were both
  considered and deliberately rejected** — both would be technically
  buildable but functionally meaningless against a frozen, static
  dataset with no real "today" to roll from.
- **An auto-refresh trigger was cut for the same reason** — no live
  data source exists for it to refresh into; a scheduled trigger
  re-checking a static dataset would only ever produce the same result.

See `docs/reporting-automation-spec.md` for the full build log and
every design decision with its reasoning, and
`docs/google_sheets_cheat_sheet.md` / `docs/python_cheat_sheet.md` for
a technique-by-technique walkthrough of how each piece was built.
