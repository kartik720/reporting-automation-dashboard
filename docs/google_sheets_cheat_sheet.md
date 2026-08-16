# Google Sheets Cheat Sheet — Reporting Automation Dashboard

Same approach as `python_cheat_sheet.md`: explain everything from
scratch, assuming nothing, with the full what/how/why/where/when for
every technique. This is a **living document** — started now, partway
through the Sheets build, and updated as each new stage gets added,
rather than written all at once at the end. Sections are ordered to
match the actual build sequence: raw tabs → staging tabs → Master Data →
Dashboard.

---

## The big picture: why this many tabs?

It would be technically possible to write one giant, complicated formula
that goes straight from "raw imported data" to "finished dashboard
number" in a single step. This project deliberately doesn't do that —
instead, each tab does *one* transformation, handing a slightly cleaner,
more useful table to the next tab in the chain:

```
raw tabs (exactly what the CSVs contain)
    ↓
staging tabs (combined/reshaped, still close to raw)
    ↓
master_data (one clean row per date+client, everything you'd ever need)
    ↓
dashboard (the actual report a viewer sees)
```

**Why build it this way instead of one big formula?** Two reasons.
First, debugging — if a number on the dashboard looks wrong, you can
check each tab in the chain one at a time to find exactly where it broke,
instead of untangling one enormous formula. Second, real BI tools
(Tableau, Power BI, dbt) all work this exact way — raw → staged →
modeled → presented — so building it this way here is genuine practice
for how data pipelines work professionally, not just a Sheets-specific
habit.

---

## Raw tabs — what they are and why they're untouched

Nine tabs, each one a direct, unmodified import of one CSV file from the
Python notebook: `raw_youtube_posts`, `raw_instagram_posts`,
`raw_facebook_posts`, `raw_tiktok_posts`, `raw_aesthetician_ga_store`,
`raw_chiropractor_conversion`, `raw_real_estate_conversion`,
`raw_vlogger_monetization`, `raw_anomaly_metadata`.

**Why keep these in snake_case (`total_engagements`) instead of making
them pretty (`Total Engagements`) right away?** These tabs exist purely
for traceability — if a formula three tabs downstream ever looks wrong,
being able to compare a raw tab's column names directly against the
Python code's column names, with zero renaming in between, makes tracking
down the actual source of a bug much faster. Prettifying happens exactly
once, much later, at the Dashboard layer — where an actual viewer
(not you, debugging) is looking at it.

---

## Formula concept: `ARRAYFORMULA`

Shows up constantly from here on, so worth explaining once, properly.

**Normal Sheets behavior:** you write one formula in one cell, and it
calculates one result for that one cell. If you want the same formula
applied to 1,000 rows, you'd normally have to drag-copy it down 1,000
times.

**What `ARRAYFORMULA` does:** lets you write the formula *once*, and it
automatically "spills" the result down every row it applies to — no
dragging, no copying. If the underlying data changes size (more rows get
added), the formula automatically covers the new rows too, since it's
recalculating the whole range every time, not a fixed copy-pasted set of
cells.

**When to reach for it:** any time you'd otherwise need to drag a formula
down more than a few rows, or when the number of rows might change over
time and you don't want to remember to re-drag it later.

---

## `stg_posts` — stacking the 4 platform tabs into one table

**The problem:** the 4 platform raw tabs each hold different clients
(YouTube has real estate + vlogger; Instagram has aesthetician +
chiropractor + vlogger; etc.) — but for a lot of what comes next, it's
easier to work with *all* posts from *all* platforms in one single table.

**The formula:**
```
={raw_youtube_posts!A1:K; raw_instagram_posts!A2:K; raw_facebook_posts!A2:K; raw_tiktok_posts!A2:K}
```

**What the curly braces `{...}` do:** in Sheets, wrapping ranges in curly
braces with semicolons between them **stacks them vertically** — like
stapling 4 separate tables on top of each other into one. YouTube's range
starts at row 1 (so its header row — `date`, `client`, `platform`, etc. —
becomes the combined table's header too), while the other three start at
row 2, deliberately skipping *their* header rows so they don't get
duplicated in the middle of the combined data.

**The padding-blank-rows problem, and the fix:** Google Sheets tabs often
have far more rows available than they actually contain data (e.g. 1,000
rows even though only 673 have real content) — a whole-column-style
reference like this would pull in all those extra genuinely-blank rows
too. Fixed by wrapping the whole thing in `QUERY(..., "select * where
Col1 is not null", 1)` — this drops every row where the date column is
blank, which cleanly removes the padding regardless of exactly how many
blank rows each source tab happens to have.

**Result:** 2,933 rows (every single post, across all 4 platforms and all
4 clients, in one table) + 1 header row.

---

## `stg_posts_daily` — collapsing posts down to one row per day+client

**The problem:** `stg_posts` has one row *per post*. A client who posted
twice on Instagram the same day has 2 rows for that day. For a lot of
downstream work, you want just *one* row per (date, client) — with the
day's numbers already added up.

**The formula uses `QUERY`'s SQL-like grouping:**
```
=QUERY(stg_posts!A1:K, "select A, B, sum(D), sum(E), sum(J) where A is not null group by A, B label sum(D) 'total_followers', ...", 1)
```

**What "GROUP BY" means, if SQL is new:** it's a way of saying "take
every row that shares the same value in these columns, and squash them
into just one row, adding up (or averaging, or counting) whatever other
columns I ask for." Here, "group by A, B" means "group by date and
client" — every post that same client made on that same day gets
squashed into one row, with `followers`, `reach`, and `total_engagements`
all **summed** together.

**Result:** 1,826 rows. Notice this is *less* than the maximum possible
2,924 (4 clients × 731 days) — this table is deliberately **sparse**; a
client only gets a row here on days they actually posted *something*,
on *any* platform.

---

## `stg_conversions` — the 4 conversion/funnel tabs, combined with a client label

**The problem this one solves is different from `stg_posts`:** the 4
conversion source tabs (`raw_aesthetician_ga_store`, etc.) don't have a
`client` column at all — each entire *file* represents one specific
client, so there was never a need for a client column inside it.
Combining them into one table means manually attaching that missing
label as part of the combining step.

**How the client label gets added:**
```
ARRAYFORMULA(IF(raw_aesthetician_ga_store!A2:A732="","","aesthetician"))
```
This produces a column that says `"aesthetician"` on every row that has a
date, and stays blank on any row that doesn't — effectively "stamping"
the client name onto every row from that specific source, as part of
stacking it together with the other three.

**Only 4 columns get pulled through, not everything:** `date`, `client`
(the newly stamped-on label), `primary_outcome_count`, and
`primary_outcome_label`. The other columns each conversion tab has
(sessions, conversion rates, etc.) stay behind in their raw tabs — only
pulled in later, directly from the raw tabs, if and when a dashboard view
actually needs that level of client-specific detail.

**Result:** 2,924 rows — this table is **dense**, not sparse, unlike
`stg_posts_daily`. Every single conversion tab has one row for every one
of the 731 days, regardless of whether the client posted anything that
day, since conversion/funnel numbers (bookings, revenue, etc.) get
tracked daily independent of social posting activity.

---

## `stg_followers_by_platform` — the fix for a real bug

This tab exists specifically to solve a problem that was caught while
building `master_data`, not planned from the start — worth understanding
*why* it exists, not just what it does.

**The bug, explained simply:** `followers` is a **snapshot** number (how
many followers does the account currently have), not something that
happens fresh each day the way `reach` does. But the data only records a
follower count on days a post actually happened — there's no separate
"here's how many followers they had today, whether or not they posted"
record. Naively summing `stg_posts_daily`'s follower numbers by
date+client meant that on any day a client *didn't* post, their follower
count showed up as **0** — technically true (there's no follower number
recorded for that specific day), but deeply misleading (the account
obviously didn't lose every single follower just because nobody posted
that day).

**The fix — one column-pair per client-platform combination:**
```
=QUERY(raw_instagram_posts!A2:K, "select A, D where B='aesthetician' order by A", 0)
```
For each of the 9 client-platform pairs (aesthetician+Instagram,
aesthetician+TikTok, chiropractor+Instagram, and so on), this pulls just
that pair's own dates and follower counts, sorted oldest to newest,
into its own labeled 2-column block. The header row uses a **merged
cell** (e.g. "aesthetician + instagram" spanning both columns) purely for
human readability — it doesn't change how the formula underneath works,
it just makes the tab far easier to visually scan later.

---

## `LOOKUP` — the forward-fill technique

This is the actual fix for the followers bug above, and a genuinely
reusable technique worth remembering for any future spreadsheet work.

```
=LOOKUP(target_date, sorted_date_column, value_to_return_column)
```

**What `LOOKUP` does that `VLOOKUP` doesn't:** `VLOOKUP` needs an *exact*
match — if the exact date you're asking about isn't in the lookup table,
you get an error. `LOOKUP` does an **approximate match** — it finds the
*largest value in the sorted column that's still less than or equal to*
your target, and returns whatever's next to it. Given a sorted list of
dates a client actually posted, asking `LOOKUP` for a date they *didn't*
post gives you back their most recent *actual* follower count as of
their last real post before that date — exactly what "forward-fill"
means (carrying the last known value forward until a new one appears).

**Why this needs a genuinely sorted, ascending column to work correctly:**
`LOOKUP`'s approximate-match logic assumes the range it's searching is
already sorted smallest to largest — that's *why* `stg_followers_by_platform`'s
`QUERY` formulas explicitly include `order by A`. Feeding `LOOKUP` an
unsorted range produces silently wrong results, not an error — worth
double-checking sort order any time this technique gets reused elsewhere.

**When would you reach for this again?** Any time you have sparse,
irregular snapshots of something (a price, a headcount, an inventory
level — anything that only gets recorded occasionally) and need a value
for *every* day, not just the days it happened to be recorded.

---

## `master_data` — the date × client grid, and building it from scratch

**The goal:** one clean row for *every single* (date, client) combination
that could possibly exist — 731 days × 4 clients = 2,924 rows, with zero
gaps — regardless of whether that client actually did anything on that
specific day.

**Building the grid with `SEQUENCE`, `INT`, and `MOD`:**
```
Column A (date): =ARRAYFORMULA(DATE(2024,1,1)+INT(SEQUENCE(2924,1,0,1)/4))
Column B (client): =ARRAYFORMULA(CHOOSE(MOD(ROW(A2:A2925)-2,4)+1,"aesthetician","chiropractor","real_estate_agent","vlogger"))
```

**What `SEQUENCE` does:** generates a simple list of numbers — here,
0, 1, 2, 3, ... up to 2,923. It's a way to get "a list of N numbers in
order" without typing them out manually.

**What `INT` and `MOD` do, and why both are needed:** `INT` (integer
division — "how many whole times does this divide") and `MOD`
(remainder — "what's left over after dividing") are a classic combo for
turning one flat counting sequence into two separate cycling patterns.
`INT(n/4)` — dividing by 4 and dropping any decimal — produces
`0,0,0,0,1,1,1,1,2,2,2,2,...`: exactly what's needed to advance the date
by one day every 4 rows. `MOD(n,4)` — the remainder after dividing by 4 —
produces `0,1,2,3,0,1,2,3,...`: a repeating cycle of exactly 4 values,
used to pick which of the 4 clients each row belongs to.

**`CHOOSE`:** given a number and a list of options, returns whichever
option matches that number's position — `CHOOSE(2, "a", "b", "c")`
returns `"b"`. Combined with the `MOD` cycle above, this is what turns
`0,1,2,3,0,1,2,3...` into
`"aesthetician","chiropractor","real_estate_agent","vlogger",...`
repeating.

**The rest of the columns, briefly:**
- `total_followers` — sums the right `stg_followers_by_platform` columns
  per client (using the `LOOKUP` forward-fill technique above)
- `reach_views` / `total_engagements` — pulled from `stg_posts_daily`
  using a `date|client` concatenated key + `SUMIF` (see below for why)
- `engagement_rate` — recalculated fresh as `engagements ÷ reach` on the
  already-summed totals, not averaged from individual post-level rates
  (averaging rates directly would weight a low-reach day's rate equally
  with a high-reach day's, which distorts the true overall rate)
- `follower_growth` — today's `total_followers` minus the same client's
  value from exactly 4 rows up (since the grid cycles through 4 clients
  per date, "yesterday, same client" is always exactly 4 rows back)
- `primary_outcome_count` / `primary_outcome_label` — pulled from
  `stg_conversions`

---

## Why `SUMIF` with a concatenated key, instead of `SUMIFS` with two criteria

A real bug worth remembering, not just a style preference.

**What was tried first:**
```
=SUMIFS(stg_posts_daily!C:C, stg_posts_daily!A:A, A2:A2925, stg_posts_daily!B:B, B2:B2925)
```
`SUMIFS` normally lets you sum a column while matching *multiple*
separate conditions at once (here: date matches *and* client matches).
Wrapped in `ARRAYFORMULA` to run this across thousands of rows at once,
it silently failed — it computed a result for only the very first row
and left every row below it blank, with no error message explaining why.

**The fix — combine both conditions into one:**
```
=SUMIF(stg_posts_daily!$F$2:$F$1827, A2:A2925&"|"&B2:B2925, stg_posts_daily!$C$2:$C$1827)
```
Instead of asking Sheets to match two separate conditions simultaneously,
this builds a single combined "key" column ahead of time (e.g.
`"2024-01-01|aesthetician"`, joining date and client together with a `|`
separator), then uses the simpler single-condition `SUMIF` to match
against that one combined key. `SUMIF` (one condition) reliably works
correctly inside `ARRAYFORMULA` across thousands of rows in a way that
`SUMIFS` (multiple conditions) doesn't.

**The general lesson:** if `ARRAYFORMULA` combined with a multi-criteria
function (`SUMIFS`, `COUNTIFS`, `AVERAGEIFS`) mysteriously only fills the
first row, try collapsing the multiple criteria into one concatenated key
column and switching to the single-criteria version of the function
instead.

---

## `dashboard` — the client dropdown

**The goal:** a dropdown showing nice, readable names ("Aesthetician,"
"Real Estate Agent"), while every formula behind the scenes keeps working
with the plain snake_case names (`aesthetician`, `real_estate_agent`)
that every tab built so far already uses.

**How the translation works:** a small reference table (pretty name in
one column, matching snake_case key right next to it) sits off to the
side. The dropdown itself (built via **Data Validation**, restricting the
cell to only accept values from that reference table's pretty-name
column) shows the pretty name. A second, mostly-hidden cell then runs:
```
=VLOOKUP(B1, M1:N4, 2, FALSE)
```
This looks up whatever pretty name is currently selected in `B1`, finds
its matching row in the reference table, and returns the snake_case
version from the *2nd* column of that row (`FALSE` at the end means
"require an exact match, don't guess"). Every future formula on the
dashboard references *this* translated cell, never the dropdown cell
directly — so the viewer always sees a nice name, while the formulas
underneath never have to deal with anything except the exact snake_case
values they already understand.

---

## `dashboard` — the date-range picker

**Why calendar periods (2024, Q1 2025, etc.), not "Last 30 Days":**
rolling windows like "Last 30 Days" only make sense relative to a real,
moving "today." This dataset is **frozen** — it only ever covers Jan
2024 through Dec 2025, so there's no live "today" to roll from. A fixed
calendar period (an actual year, an actual quarter) is the version of a
date filter that genuinely fits a static, historical dataset like this
one.

**Data Validation, and the "reject vs. warn" distinction:** Data
Validation restricts what can be typed into a cell. It has two very
different failure behaviors: "Show a warning" lets an invalid value in
anyway, just marking the cell with a small, easy-to-miss red triangle;
"Reject the input" refuses the value outright. **Always use Reject for
anything a formula downstream depends on** — a silently-accepted invalid
value is far more dangerous than an outright refusal, since nothing
visibly signals that something's wrong.

**A real gotcha — locale-sensitive typed dates:** typing `31/12/2025`
(day-first) into a validation rule's boundary field on a spreadsheet set
to a month-first (US) locale doesn't produce an error — it just silently
fails to register as a real date at all, which breaks the *entire rule*
(it can no longer evaluate "is this date between two boundaries" if one
of the boundaries isn't a real date). The fix is simply typing dates in
whatever format the spreadsheet's actual locale expects (check via File →
Settings → Locale) — but the *symptom* (a validation rule that seems to
just not do anything) can be genuinely confusing until you know to check
this specifically.

**A cell can only hold one Data Validation rule at a time** — adding a
second rule to an already-validated cell *replaces* the first one
instead of combining with it. If you need multiple conditions enforced
on one cell, they need to be combined into a single rule (e.g. one
"Date is between" rule with both bounds, rather than a separate "is a
valid date" rule plus a separate range-check rule).

**Data Validation only checks values at the moment of entry** — it never
retroactively re-scans a value that's already sitting in a cell,
including one entered before the rule existed or was tightened. Worth
keeping a formula-level backup check (something like
`IF(AND(start<>"", end<>"", start>end), "Invalid range", ...)`)
downstream for exactly this gap — it catches bad values regardless of
*how* they got into the cell, not just ones typed fresh after the rule
was already in place.

---

## KPI cards — the six numbers on the dashboard

Six cells (`B6:B11`), each a single scalar pulled from `master_data`,
filtered by whatever's currently in the client dropdown (`$B$2`) and
date-range cells (`$B$3`/`$C$3`).

**Why some cards `SUMIFS` and one doesn't.** Reach, Engagements, Follower
Growth's components, and the primary outcome count are all *flow*
metrics — they only make sense summed across the period, since each
day's number is independent of every other day's. `SUMIFS` handles this
directly:

```
=SUMIFS(master_data!$D$2:$D$2925, master_data!$A$2:$A$2925, ">="&$B$3,
        master_data!$A$2:$A$2925, "<="&$C$3,
        master_data!$B$2:$B$2925, $B$2)
```

Total Followers is different — it's a *stock* metric (see the
`total_followers` forward-fill lesson earlier in this doc). Summing 92
days of follower counts would produce a meaningless number roughly 92x
too large. The correct read is the value on exactly one day — the last
day of the selected range:

```
=SUMIFS(master_data!$C$2:$C$2925, master_data!$A$2:$A$2925, $C$3,
        master_data!$B$2:$B$2925, $B$2)
```

(matching `A2:A2925` to exactly `$C$3`, not a range, is what makes this
a snapshot lookup instead of a sum)

**Engagement Rate is recomputed, never averaged.** Averaging 92 daily
engagement-rate values would treat a low-reach day's rate as equally
important as a high-reach day's — the same distortion the
`total_followers` bug caused, just for a different metric. The fix is
the same principle: sum the two raw components across the period first,
then divide once.

```
=[Total Engagements cell] / [Reach/Views cell]
```

**Follower Growth is a net change, not a sum of daily deltas.** "How
many followers did we gain this period" means *end value minus the
value right before the period started* — not the sum of each day's
`follower-growth` column (which would double-count in some read
of the numbers and isn't what "growth over this period" actually means).

```
=[Total Followers, end of period]
 - [Total Followers, the day before the period started]
```

**Edge case: this breaks on the dataset's actual first day.** If the
period starts exactly on `2024-01-01`, "the day before" doesn't exist in
`master_data` — that lookup returns 0, which would make Follower Growth
look artificially huge (as if the entire starting follower count grew
from zero). Guarded with an `IF` that falls back to "value on the start
date itself" only for that one boundary case.

**Primary Outcome's label is dynamic, not hardcoded.** Each client has a
different name for their core conversion event (Orders vs. Closed Deals
vs. whatever the chiropractor or vlogger's equivalent is) — hardcoding
"Orders" would be wrong for 3 of 4 clients. Since the label doesn't vary
by date, a simple `VLOOKUP` on the client key alone is enough:

```
=VLOOKUP($B$2, master_data!$B$2:$I$2925, 8, FALSE)
```

**The reverse lookup (snake_case → pretty name) needs `INDEX`/`MATCH`,
not `VLOOKUP`.** The pretty-name-to-key reference table has the
snake_case column sitting to the *right* of the pretty name column —
`VLOOKUP` can only search left-to-right, so it can't look backward
across its own reference range. `INDEX`/`MATCH` has no such direction
restriction: `MATCH` finds *where* the key sits, `INDEX` grabs whatever's
in the target column at that same row position.

---

## Conditional formatting — YoY flags on the KPI cards

**The comparison basis is same-period-prior-year, not a fixed target.**
With only 2 years of frozen historical data, YoY is the one comparison
that's actually meaningful — it holds seasonality constant (Q4 2025 and
Q4 2024 both carry the same BFCM shape) in a way a fixed target
couldn't without just being invented.

**`EDATE(date, -12)` shifts a date back exactly one year**, safer than
subtracting 365 days across a leap year. Each KPI gets a prior-year
value cell computing the same metric, shifted:

```
=IF(YEAR($B$3)=2024, "N/A",
    SUMIFS(master_data!$D$2:$D$2925,
           master_data!$A$2:$A$2925, ">="&EDATE($B$3,-12),
           master_data!$A$2:$A$2925, "<="&EDATE($C$3,-12),
           master_data!$B$2:$B$2925, $B$2))
```

**2024 has no prior year — this needs an explicit fallback, not a
silent error.** The `IF(YEAR($B$3)=2024, "N/A", ...)` wrapper is what
makes that boundary safe; without it, 2024 periods would either error or
(worse) silently return 0, which a downstream `%` change formula would
then read as "down 100%" — a completely false flag.

**% change cell, one per KPI:**

```
=IF(ISTEXT([prior-year cell]), "N/A",
    ([current cell]-[prior-year cell])/[prior-year cell])
```

**Threshold bands vary by metric, because not all metrics are equally
noisy.** Engagement Rate and the primary outcome (the "is it actually
working" numbers) use a tight ±5%/±15% three-tier band. Reach/Views and
Engagements (noisier, single-week swings shouldn't trip a flag) use a
looser ±20% two-tier band. Total Followers and Follower Growth (slow-
moving stock metrics where even a small % move is meaningful) use ±10%.

**The bug that actually broke things: relative row references inside a
combined "Apply to range."** A rule written with `$D9` (column locked,
row not) and applied to `B9,B11` together doesn't check `$D9` and `$D11`
respectively — Sheets shifts the relative row per cell in the list
exactly like a dragged formula would, so the second cell in the range
ends up checking the wrong row entirely. This produced flag colors that
looked almost-but-not-quite right (correct sometimes, silently wrong
other times) rather than an obvious error — much harder to spot than a
formula that fails outright. **Fix: always fully lock both column and
row (`$D$9`), and scope conditional formatting rules to one cell at a
time** rather than combined ranges, even after references are absolute —
debugging one rule per cell is meaningfully easier than debugging a rule
shared across several.

**Rule order matters when a "N/A" text guard coexists with numeric
rules.** The gray/blank rule (`=ISTEXT($D$9)`) has to sit *first* in
each cell's rule list, so Sheets short-circuits on it before the numeric
rules try to evaluate a `>=` comparison against the text `"N/A"`.

---

## Aesthetician GA/store section — conditional visibility

**Every cell needs its own `IF` wrapper — labels included, not just
values.** An early version wrapped only the value cells
(`G6:G12`) in `IF($B$2="aesthetician", ..., "")`, leaving the adjacent
label cells (`F6:F12`) as static text. Result: switching away from
Aesthetician correctly blanked the numbers but left "Total Sessions,"
"Revenue," etc. still visibly labeling nothing — a half-fixed
conditional section is easy to miss because the *value* side looks
correctly handled.

**Conversion rates here need to be weighted, not simple-averaged** — the
same distortion the `total_followers` and `engagement_rate` lessons
already cover, applied a third time to a new metric:

```
=SUMPRODUCT((date >= start) * (date <= end) * rate * sessions)
 / SUMPRODUCT((date >= start) * (date <= end) * sessions)
```

`SUMPRODUCT` does the row-by-row multiply-and-sum in one array formula,
without needing a helper column — each day's rate gets weighted by that
day's actual session volume before the average is taken, so a
high-traffic day counts more than a low-traffic day, correctly.

**A wrong comparison denominator produces a flag that looks like it
works but structurally can't fire.** An early Social Conversion Rate
flag compared the current period's social rate against that *same
period's* non-social rate (`social >= non_social * 0.9`). Since social
converts structurally higher than non-social in this dataset by design
(§9 baselines), that ratio is almost never below the threshold
regardless of what's actually happening — the flag was "always green,"
which looked like a passing rule but had never actually been capable of
tripping. The fix: compare the metric to *itself, prior year* — same
proven YoY pattern as the KPI cards, not a new cross-metric comparison
invented for this one field.

**Three fill states, not two.** A cell in a conditionally-shown section
can be in one of three situations, and collapsing any two of them into
the same gray was hiding real information:
- Not Aesthetician at all → no fill (matches the surrounding blank sheet)
- Aesthetician, but no prior year exists (2024) → gray
- Aesthetician, with a real comparison → green/yellow/red

```
Rule 1 (no fill): =AND($B$2<>"aesthetician", G9="")
Rule 2 (gray):    =AND($B$2="aesthetician", ISTEXT($I9))
Rule 3-5: the normal green/yellow/red numeric bands
```

**Section background color needs to be a conditional formatting rule,
not a manual paint job.** Manually filling header/label cells with a
color makes them stay that color for every client, since a static fill
has no awareness of the dropdown at all. The fix is the same mechanism
as everything else in this section — a rule keyed on
`=$B$2="aesthetician"` — so the color itself reacts to the dropdown
instead of needing to be manually repainted.

---

## Custom date-range input — Apps Script `onEdit` trigger

**The problem this solves:** switching the date-range dropdown to
"Custom" left the custom start/end cells empty until manually filled —
in the gap between selecting "Custom" and actually typing both dates,
every formula dividing by a date-derived range (which is most of the
dashboard) divides by zero and crashes. Switching *away* from Custom
back to a preset had the same problem in reverse: stale custom dates
left in those cells could silently get picked up again later.

**`onEdit(e)` is a simple trigger** — a function with that exact name
runs automatically on every edit to the spreadsheet, no manual wiring
needed. It receives an event object (`e`) describing what changed:

```javascript
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'dashboard') return;
  var editedCell = e.range;
  if (editedCell.getA1Notation() !== 'E1') return; // the dropdown cell
  var newValue = editedCell.getValue();
  // ...
}
```

Guarding on both the sheet name and the exact cell address matters —
without it, this function would fire (and do nothing useful, but still
run) on literally every edit anywhere in the entire spreadsheet.

**When switching to Custom:** `ui.prompt()` shows a native dialog asking
for a date, one field at a time (start, then end). **Format ambiguity
was a real problem here** — an early version's example date
(`2025-01-01`) didn't make clear whether the month or day came first,
leading to an actual mis-entered date. Fixed two ways: the prompt text
explicitly says "yyyy-mm-dd," and the example uses day 31
(`2025-01-31`) specifically, since 31 can only ever be a day, never a
month — a self-disambiguating example.

**Format is validated before parsing, with a regex, not just trusted:**

```javascript
var dateFormatPattern = /^\d{4}-\d{2}-\d{2}$/;
if (!dateFormatPattern.test(startText) || !dateFormatPattern.test(endText)) {
  ui.alert('Dates must be entered as yyyy-mm-dd...');
  return;
}
```

This catches a wrong format *before* attempting to build a `Date`
object from it — parsing a malformed string can silently produce an
unexpected date rather than an obvious error, so checking the shape
first is safer than trying to parse first and catch a failure after.

**`T00:00:00` anchors the parsed date to local midnight**, avoiding a
subtle timezone bug where `new Date("2025-01-31")` alone can parse as
UTC midnight — which, depending on the timezone, can display as Jan 30
instead of Jan 31.

**When switching away from Custom:** the same function's `else` branch
clears both custom cells (`clearContent()`), so no stale date can ever
persist into a period where it doesn't apply.

---

## Report Generator, PDF export, and auto-alerts — Apps Script

**One shared read function prevents the snapshot log, PDF export, and
alerts from ever showing different numbers for the "same" report.**
Both `generateReportSnapshot()` and `exportCurrentViewAsPDF()` call the
same `readCurrentSnapshot()` helper, which reads the dashboard's live
cells once and returns a single object — rather than each function
independently re-reading (and potentially catching the dashboard
mid-recalculation, or drifting if one function's read logic gets edited
later and the other doesn't).

**Colors are baked into the log at write-time (`setBackground()`), not
left as live conditional formatting.** A live conditional formatting
rule re-evaluates every time the sheet recalculates — completely wrong
for a historical log, where a March snapshot's flag color should stay
whatever it was in March even if the underlying thresholds get tuned
later. `getFlagColor()` runs the exact same threshold logic as the
dashboard's conditional formatting rules once, at the moment of
logging, and paints the cell directly:

```javascript
function getFlagColor(kpiKey, pctChange) {
  if (pctChange === 'N/A' || isNaN(pctChange)) return COLORS.gray;
  var band = THRESHOLD_BANDS[kpiKey];
  if (band.type === 'binary') {
    return pctChange < band.red ? COLORS.red : COLORS.green;
  } else {
    if (pctChange < band.red) return COLORS.red;
    if (pctChange < band.yellow) return COLORS.yellow;
    return COLORS.green;
  }
}
```

**The PDF is built by temporarily creating a real sheet, then deleting
it** — Apps Script's PDF export works on actual sheet tabs, not
arbitrary in-memory layouts, so the branded one-pager (title, period,
colored KPI table) gets built as a genuine (if short-lived) tab,
exported via the spreadsheet's `/export?format=pdf` endpoint, saved to
Drive, and the temp tab is deleted immediately after — so it never
lingers in the tab list.

**The 4 client alerts are genuinely independent, not one loop with a
combined output.** Looping through all 4 clients and sending one email
per client, only when that specific client has a real red flag, means a
chiropractor's stakeholder never sees the vlogger's numbers — each
`MailApp.sendEmail()` call is addressed and scoped to exactly one
client's data.

**Alert checks are manually triggered, not scheduled** — a scheduled
daily check against a frozen, non-live dataset would just re-report the
identical result every single day, which is automation with no real
function to serve (same reasoning behind cutting the auto-refresh
add-on entirely — see the spec's §7).

**Recomputing KPIs for 4 clients independently means reading
`master_data` directly, not the dashboard cells.** The dashboard only
ever shows whichever one client is currently selected — checking all 4
requires the same `SUMIFS`/weighted-average logic as the dashboard's own
formulas, just re-implemented in Apps Script against the raw
`master_data` rows rather than reading pre-filtered dashboard output.

---

## Posting-cadence correlation — `QUERY`-based pivoting

**`QUERY`'s `group by` needs an actual column to group on, not an
inline date-truncation expression.** Grouping "by week" isn't natively
supported inline — the fix is a helper column computed first
(`week_start = date - WEEKDAY(date,2) + 1`, a Monday-anchored week
start), then grouping on that real column:

```
=QUERY(stg_posts!A1:L, "select L, B, count(A), sum(E), sum(J)
 where A is not null group by L, B order by L, B
 label count(A) 'post_count', sum(E) 'reach_views',
 sum(J) 'total_engagements'", 1)
```

**Fill-down only works correctly on the tab actually holding the source
data.** The helper column formula was initially typed into the *output*
tab (`stg_posting_cadence`) instead of the source tab (`stg_posts`) —
since that output tab's own column A was empty at the time, every row
evaluated the same "date minus WEEKDAY of an empty cell" arithmetic,
silently producing the identical wrong number (`-5`) in every single row
rather than an obvious error. A formula outputting a suspiciously
*identical* value across every row is usually a sign it's not actually
reading what you think it's reading, not a sign the math is broken.

**A `GROUP BY` output naturally has fewer rows than a full date × client
grid**, because a group only appears when at least one row matches it —
a client-week with zero posts produces no output row at all, rather than
a row showing `post_count = 0`. Seeing meaningfully fewer rows than
"weeks × clients" isn't a bug; it reflects real weeks some client didn't
post in.

**A literal Insert → Pivot Table can't natively follow a cell
reference for its filter** — that's what makes the `QUERY`-based
version (filtered on `dashboard!$B$2` inline in the formula) the
functionally correct choice for something that needs to react to a
dropdown live. A real pivot table object was still built separately
(`pivot_posting_cadence`) purely as a standalone reference artifact,
since it's a genuinely different, useful skill to demonstrate on its
own.

**A flat, non-varying x-axis makes a correlation question structurally
unanswerable, not just weakly answered.** The vlogger's posting cadence
sits at a constant 15/week across the entire 2-year range — there's no
variation to correlate engagement rate against, so "does posting more
correlate with better engagement" isn't a question with a weak answer
for that client specifically, it's a question that doesn't apply at
all. Worth checking whether the independent variable actually varies
before interpreting a flat or noisy correlation result as "no
relationship."

---

## Number formatting and sizing — a per-sheet pass

**Formatting is a cell/column property, not a formula concern** —
values like `-0.082` were already mathematically correct throughout this
build; a cell displaying `0.082` instead of `-8.2%` needed its **number
format** changed (`Format → Number → Percent`), not its formula rewritten.
Conditional formatting rules that check the raw decimal (`$D$6 < -0.05`)
keep working exactly the same regardless of how the cell displays —
formatting and the underlying value are independent.

**Paint Format copies both number formatting and conditional formatting
together, across tabs** — useful for structurally identical tabs (the 4
raw platform tabs share the exact same columns), but it's a *positional*
copy, not a name-matched one. Painting from a tab with one column layout
onto a tab with a different layout silently applies the wrong format to
the wrong column, since Paint Format has no idea what a column is
named, only where it sits.

---

## Quick-reference: techniques that showed up more than once

- **`ARRAYFORMULA`** — turns a single-cell formula into one that spills
  down every row automatically
- **`QUERY` with `where ... is not null`** — the standard fix for
  padding-blank-row problems when stacking or referencing ranges that are
  bigger than their actual data
- **`QUERY` with `group by`** — SQL-style row-squashing, used to collapse
  post-level data down to one row per day+client
- **Concatenated key + `SUMIF`, instead of `SUMIFS`** — the fix for
  `ARRAYFORMULA` + multi-criteria functions silently only filling one row
- **`LOOKUP`'s approximate match** — the forward-fill technique for
  sparse, irregularly-recorded snapshot data
- **`SEQUENCE` + `INT`/`MOD` + `CHOOSE`** — the standard combo for
  building a repeating, cycling grid (like "4 clients per date") from one
  flat counting sequence
- **Reject vs. warn in Data Validation** — always Reject for anything a
  downstream formula depends on
- **Locale-sensitive manually-typed dates** — a day-first date silently
  breaks validation under a month-first locale, with no visible error
- **`SUMPRODUCT` for weighted averages** — multiplies rate × volume
  row-by-row and sums in one array formula, no helper column needed;
  the fix anywhere a simple average would wrongly treat a low-volume
  day as equal to a high-volume day
- **Fully-locked references (`$D$9`, not `$D9`) in conditional
  formatting** — the fix for rules that silently check the wrong row
  when applied to a combined multi-cell range
- **`EDATE(date, -12)`** — the safe way to shift a date back exactly one
  calendar year, avoiding leap-year drift from subtracting 365 days
- **Three fill states for a conditionally-shown flagged cell** — no
  fill (section doesn't apply), gray (applies, but no comparison data),
  and the real color bands — collapsing any two of these loses real
  information
- **`onEdit(e)` simple triggers** — run automatically on any edit,
  guarded by checking `e.range`'s sheet and address so the function only
  acts on the one cell it's meant to watch
- **One shared read function feeding multiple outputs** — the fix for
  a log, a PDF, and an alert ever showing different numbers for what's
  supposed to be the same snapshot
- **Colors baked in at write-time (`setBackground()`) for historical
  logs** — live conditional formatting would let old records silently
  reflect newly-tuned thresholds; a written color is a permanent record
  of what was true at that moment
- **A suspiciously identical value across every row** — usually a sign
  a formula is reading the wrong tab or wrong cell, not that the
  underlying math is actually broken
- **Paint Format copies positionally, not by column name** — safe
  between structurally identical tabs, unsafe between differently
  laid-out ones

---